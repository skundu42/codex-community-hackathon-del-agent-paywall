import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { appEnv } from "@/lib/env";
import { DEFAULT_CURRENCY, FEATURED_ROUTE_SLUG } from "@/lib/gateway";
import type {
  ApiInvocation,
  ApiInvocationResult,
  ApiRoute,
  InvocationBundle,
  Provider,
  ProviderSession,
  PaymentReceiptPayload,
  PaymentSession,
  PaymentStatus,
  RouteKind,
  CallerMode,
  InvocationStatus,
  JsonValue,
} from "@/lib/types";

type RouteRecord = ApiRoute;
type InvocationRecord = ApiInvocation;
type PaymentRecord = PaymentSession;
type ProviderRecord = Provider;
type ProviderSessionRecord = ProviderSession;

const memoryRoutes = new Map<string, RouteRecord>();
const memoryInvocations = new Map<string, InvocationRecord>();
const memoryPayments = new Map<string, PaymentRecord>();
const memoryProviders = new Map<string, ProviderRecord>();
const memoryProviderSessions = new Map<string, ProviderSessionRecord>();
const memoryMppStore = new Map<string, unknown>();

const pool = appEnv.databaseUrl
  ? new Pool({
      connectionString: appEnv.databaseUrl,
      ssl:
        /localhost|127\.0\.0\.1/.test(appEnv.databaseUrl) || appEnv.databaseUrl.includes("sslmode=disable")
          ? undefined
          : { rejectUnauthorized: false },
    })
  : null;

let schemaPromise: Promise<void> | null = null;
let memorySeeded = false;

function now() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asTimestamp(value: string | Date | null | undefined) {
  if (!value) {
    return undefined;
  }

  return new Date(value).toISOString();
}

function getFeaturedSeedRoute(): ApiRoute {
  const timestamp = now();

  return {
    id: "route_landing_page_roast",
    slug: FEATURED_ROUTE_SLUG,
    routeKind: "internal_demo",
    providerName: "AgentPaywall",
    routeName: "Landing Page Roast",
    description:
      "Pay per run to get headline feedback, CTA critique, a clarity score, and fast conversion suggestions for a landing page or block of marketing copy.",
    httpMethod: "POST",
    priceAmount: "0.02",
    currency: DEFAULT_CURRENCY,
    status: "active",
    featured: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mapRouteRow(row: Record<string, unknown>): ApiRoute {
  return {
    id: String(row.id),
    providerId: (row.provider_id as string | null) ?? undefined,
    slug: String(row.slug),
    routeKind: row.route_kind as RouteKind,
    providerName: String(row.provider_name),
    routeName: String(row.route_name),
    description: (row.description as string | null) ?? undefined,
    upstreamUrl: (row.upstream_url as string | null) ?? undefined,
    httpMethod: (row.http_method as ApiRoute["httpMethod"] | null) ?? undefined,
    priceAmount: String(row.price_amount),
    currency: row.currency as ApiRoute["currency"],
    authHeaderName: (row.auth_header_name as string | null) ?? undefined,
    authHeaderValue: (row.auth_header_value as string | null) ?? undefined,
    status: row.status as ApiRoute["status"],
    featured: Boolean(row.featured),
    createdAt: asTimestamp(row.created_at as string | Date)!,
    updatedAt: asTimestamp(row.updated_at as string | Date)!,
  };
}

function mapProviderRow(row: Record<string, unknown>): Provider {
  return {
    id: String(row.id),
    providerName: String(row.provider_name),
    email: String(row.email),
    passwordHash: String(row.password_hash),
    walletAddress: String(row.wallet_address),
    createdAt: asTimestamp(row.created_at as string | Date)!,
    updatedAt: asTimestamp(row.updated_at as string | Date)!,
  };
}

function mapProviderSessionRow(row: Record<string, unknown>): ProviderSession {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    sessionTokenHash: String(row.session_token_hash),
    expiresAt: asTimestamp(row.expires_at as string | Date)!,
    createdAt: asTimestamp(row.created_at as string | Date)!,
    updatedAt: asTimestamp(row.updated_at as string | Date)!,
  };
}

function mapInvocationRow(row: Record<string, unknown>): ApiInvocation {
  return {
    id: String(row.id),
    routeId: String(row.route_id),
    callerMode: row.caller_mode as CallerMode,
    requestBody: (row.request_body as JsonValue | null) ?? undefined,
    priceAmount: String(row.price_amount),
    currency: row.currency as ApiInvocation["currency"],
    status: row.status as InvocationStatus,
    paymentSessionId: (row.payment_session_id as string | null) ?? undefined,
    transactionReference: (row.transaction_reference as string | null) ?? undefined,
    resultPayload: (row.result_payload as ApiInvocationResult | null) ?? undefined,
    errorMessage: (row.error_message as string | null) ?? undefined,
    idempotencyKey: (row.idempotency_key as string | null) ?? undefined,
    processingStartedAt: asTimestamp(
      row.processing_started_at as string | Date | null,
    ),
    createdAt: asTimestamp(row.created_at as string | Date)!,
    updatedAt: asTimestamp(row.updated_at as string | Date)!,
  };
}

function mapPaymentRow(row: Record<string, unknown>): PaymentSession {
  return {
    id: String(row.id),
    invocationId: String(row.invocation_id),
    amount: String(row.amount),
    currency: row.currency as PaymentSession["currency"],
    provider: row.provider as PaymentSession["provider"],
    status: row.status as PaymentStatus,
    mppReference: String(row.mpp_reference),
    stripePaymentIntentId:
      (row.stripe_payment_intent_id as string | null) ?? undefined,
    payToAddress: (row.pay_to_address as string | null) ?? undefined,
    supportedTokenContract:
      (row.supported_token_contract as string | null) ?? undefined,
    tempoTxHash: (row.tempo_tx_hash as string | null) ?? undefined,
    receiptPayload:
      (row.receipt_payload as PaymentReceiptPayload | null) ?? undefined,
    verificationTimestamp: asTimestamp(
      row.verification_timestamp as string | Date | null,
    ),
    expiresAt: asTimestamp(row.expires_at as string | Date | null),
    statusMessage: String(row.status_message),
    createdAt: asTimestamp(row.created_at as string | Date)!,
    updatedAt: asTimestamp(row.updated_at as string | Date)!,
  };
}

async function ensureSchema() {
  if (!pool) {
    return;
  }

  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS providers (
          id TEXT PRIMARY KEY,
          provider_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          wallet_address TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS provider_sessions (
          id TEXT PRIMARY KEY,
          provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
          session_token_hash TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS api_routes (
          id TEXT PRIMARY KEY,
          provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
          slug TEXT NOT NULL UNIQUE,
          route_kind TEXT NOT NULL,
          provider_name TEXT NOT NULL,
          route_name TEXT NOT NULL,
          description TEXT,
          upstream_url TEXT,
          http_method TEXT,
          price_amount NUMERIC(12, 2) NOT NULL,
          currency TEXT NOT NULL,
          auth_header_name TEXT,
          auth_header_value TEXT,
          status TEXT NOT NULL,
          featured BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS invocations (
          id TEXT PRIMARY KEY,
          route_id TEXT NOT NULL REFERENCES api_routes(id) ON DELETE CASCADE,
          caller_mode TEXT NOT NULL,
          request_body JSONB,
          price_amount NUMERIC(12, 2) NOT NULL,
          currency TEXT NOT NULL,
          status TEXT NOT NULL,
          payment_session_id TEXT,
          transaction_reference TEXT,
          result_payload JSONB,
          error_message TEXT,
          idempotency_key TEXT,
          processing_started_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS payment_sessions (
          id TEXT PRIMARY KEY,
          invocation_id TEXT NOT NULL REFERENCES invocations(id) ON DELETE CASCADE,
          amount NUMERIC(12, 2) NOT NULL,
          currency TEXT NOT NULL,
          provider TEXT NOT NULL,
          status TEXT NOT NULL,
          mpp_reference TEXT NOT NULL,
          stripe_payment_intent_id TEXT,
          pay_to_address TEXT UNIQUE,
          supported_token_contract TEXT,
          tempo_tx_hash TEXT,
          receipt_payload JSONB,
          verification_timestamp TIMESTAMPTZ,
          expires_at TIMESTAMPTZ,
          status_message TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS mpp_kv (
          store_key TEXT PRIMARY KEY,
          store_value JSONB,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE api_routes
          ADD COLUMN IF NOT EXISTS provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL;

        CREATE INDEX IF NOT EXISTS idx_provider_sessions_token_hash ON provider_sessions(session_token_hash);
        CREATE INDEX IF NOT EXISTS idx_api_routes_provider_id ON api_routes(provider_id);
        CREATE INDEX IF NOT EXISTS idx_invocations_route_id ON invocations(route_id);
        CREATE INDEX IF NOT EXISTS idx_invocations_idempotency ON invocations(route_id, idempotency_key);
        CREATE INDEX IF NOT EXISTS idx_payment_sessions_invocation_id ON payment_sessions(invocation_id);
      `);

      const featured = getFeaturedSeedRoute();
      await pool.query(
        `
          INSERT INTO api_routes (
            id, provider_id, slug, route_kind, provider_name, route_name, description,
            upstream_url, http_method, price_amount, currency, auth_header_name,
            auth_header_value, status, featured
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14, $15
          )
          ON CONFLICT (slug) DO NOTHING
        `,
        [
          featured.id,
          featured.providerId ?? null,
          featured.slug,
          featured.routeKind,
          featured.providerName,
          featured.routeName,
          featured.description ?? null,
          featured.upstreamUrl ?? null,
          featured.httpMethod ?? null,
          featured.priceAmount,
          featured.currency,
          featured.authHeaderName ?? null,
          featured.authHeaderValue ?? null,
          featured.status,
          featured.featured,
        ],
      );
    })();
  }

  await schemaPromise;
}

function ensureMemorySeeded() {
  if (memorySeeded) {
    return;
  }

  const featured = getFeaturedSeedRoute();
  memoryRoutes.set(featured.id, featured);
  memorySeeded = true;
}

function updateMemoryInvocation(
  invocationId: string,
  updates: Partial<ApiInvocation>,
) {
  const existing = memoryInvocations.get(invocationId);
  if (!existing) {
    return undefined;
  }

  const updated = {
    ...existing,
    ...updates,
    updatedAt: now(),
  };

  memoryInvocations.set(invocationId, clone(updated));
  return clone(updated);
}

function updateMemoryPayment(
  paymentId: string,
  updates: Partial<PaymentSession>,
) {
  const existing = memoryPayments.get(paymentId);
  if (!existing) {
    return undefined;
  }

  const updated = {
    ...existing,
    ...updates,
    updatedAt: now(),
  };

  memoryPayments.set(paymentId, clone(updated));
  return clone(updated);
}

function updateMemoryProvider(
  providerId: string,
  updates: Partial<Provider>,
) {
  const existing = memoryProviders.get(providerId);
  if (!existing) {
    return undefined;
  }

  const updated = {
    ...existing,
    ...updates,
    updatedAt: now(),
  };

  memoryProviders.set(providerId, clone(updated));
  return clone(updated);
}

function buildUpdateStatement(
  updates: Record<string, unknown>,
  columnMap: Record<string, string>,
) {
  const entries = Object.entries(updates).filter(([, value]) => value !== undefined);
  const values = entries.map(([, value]) => value);
  const sets = entries.map(
    ([key], index) => `${columnMap[key] ?? key} = $${index + 2}`,
  );

  return {
    values,
    sql: sets.length > 0 ? `${sets.join(", ")}, updated_at = NOW()` : "updated_at = NOW()",
  };
}

export function isDatabaseConfigured() {
  return Boolean(pool);
}

export async function resetStoreForTests() {
  memoryRoutes.clear();
  memoryInvocations.clear();
  memoryPayments.clear();
  memoryProviders.clear();
  memoryProviderSessions.clear();
  memoryMppStore.clear();
  memorySeeded = false;
  ensureMemorySeeded();
}

export async function listRoutes() {
  if (!pool) {
    ensureMemorySeeded();
    return [...memoryRoutes.values()].map((route) => clone(route));
  }

  await ensureSchema();
  const result = await pool.query(
    `SELECT * FROM api_routes ORDER BY featured DESC, created_at ASC`,
  );
  return result.rows.map(mapRouteRow);
}

export async function listRoutesForProvider(providerId: string) {
  if (!pool) {
    ensureMemorySeeded();
    return [...memoryRoutes.values()]
      .filter((route) => route.providerId === providerId)
      .map((route) => clone(route));
  }

  await ensureSchema();
  const result = await pool.query(
    `
      SELECT * FROM api_routes
      WHERE provider_id = $1
      ORDER BY created_at DESC
    `,
    [providerId],
  );
  return result.rows.map(mapRouteRow);
}

export async function createRoute(
  route: Omit<ApiRoute, "createdAt" | "updatedAt">,
) {
  if (!pool) {
    ensureMemorySeeded();
    const timestamp = now();
    const created: ApiRoute = {
      ...route,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memoryRoutes.set(created.id, clone(created));
    return clone(created);
  }

  await ensureSchema();
  const result = await pool.query(
    `
      INSERT INTO api_routes (
        id, provider_id, slug, route_kind, provider_name, route_name, description,
        upstream_url, http_method, price_amount, currency,
        auth_header_name, auth_header_value, status, featured
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14, $15
      )
      RETURNING *
    `,
    [
      route.id,
      route.providerId ?? null,
      route.slug,
      route.routeKind,
      route.providerName,
      route.routeName,
      route.description ?? null,
      route.upstreamUrl ?? null,
      route.httpMethod ?? null,
      route.priceAmount,
      route.currency,
      route.authHeaderName ?? null,
      route.authHeaderValue ?? null,
      route.status,
      route.featured,
    ],
  );

  return mapRouteRow(result.rows[0]);
}

export async function getFeaturedRoute() {
  if (!pool) {
    ensureMemorySeeded();
    return clone(
      [...memoryRoutes.values()].find((route) => route.featured) ?? getFeaturedSeedRoute(),
    );
  }

  await ensureSchema();
  const result = await pool.query(
    `SELECT * FROM api_routes WHERE featured = TRUE ORDER BY updated_at DESC LIMIT 1`,
  );

  return result.rows[0] ? mapRouteRow(result.rows[0]) : undefined;
}

export async function getRoute(routeId: string) {
  if (!pool) {
    ensureMemorySeeded();
    const route = memoryRoutes.get(routeId);
    return route ? clone(route) : undefined;
  }

  await ensureSchema();
  const result = await pool.query(`SELECT * FROM api_routes WHERE id = $1 LIMIT 1`, [
    routeId,
  ]);

  return result.rows[0] ? mapRouteRow(result.rows[0]) : undefined;
}

export async function getRouteForProvider(routeId: string, providerId: string) {
  const route = await getRoute(routeId);
  if (!route || route.providerId !== providerId) {
    return undefined;
  }

  return route;
}

export async function getRouteBySlug(slug: string) {
  if (!pool) {
    ensureMemorySeeded();
    const route = [...memoryRoutes.values()].find((item) => item.slug === slug);
    return route ? clone(route) : undefined;
  }

  await ensureSchema();
  const result = await pool.query(
    `SELECT * FROM api_routes WHERE slug = $1 LIMIT 1`,
    [slug],
  );

  return result.rows[0] ? mapRouteRow(result.rows[0]) : undefined;
}

export async function createProvider(
  provider: Omit<Provider, "createdAt" | "updatedAt">,
) {
  if (!pool) {
    const timestamp = now();
    const created: Provider = {
      ...provider,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memoryProviders.set(created.id, clone(created));
    return clone(created);
  }

  await ensureSchema();
  const result = await pool.query(
    `
      INSERT INTO providers (
        id, provider_name, email, password_hash, wallet_address
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      provider.id,
      provider.providerName,
      provider.email,
      provider.passwordHash,
      provider.walletAddress,
    ],
  );

  return mapProviderRow(result.rows[0]);
}

export async function updateProvider(
  providerId: string,
  updates: Partial<Provider>,
) {
  if (!pool) {
    return updateMemoryProvider(providerId, updates);
  }

  await ensureSchema();
  const statement = buildUpdateStatement(
    {
      providerName: updates.providerName,
      email: updates.email,
      passwordHash: updates.passwordHash,
      walletAddress: updates.walletAddress,
    },
    {
      providerName: "provider_name",
      passwordHash: "password_hash",
      walletAddress: "wallet_address",
    },
  );

  const result = await pool.query(
    `UPDATE providers SET ${statement.sql} WHERE id = $1 RETURNING *`,
    [providerId, ...statement.values],
  );
  return result.rows[0] ? mapProviderRow(result.rows[0]) : undefined;
}

export async function getProvider(providerId: string) {
  if (!pool) {
    const provider = memoryProviders.get(providerId);
    return provider ? clone(provider) : undefined;
  }

  await ensureSchema();
  const result = await pool.query(
    `SELECT * FROM providers WHERE id = $1 LIMIT 1`,
    [providerId],
  );
  return result.rows[0] ? mapProviderRow(result.rows[0]) : undefined;
}

export async function getProviderByEmail(email: string) {
  if (!pool) {
    const provider = [...memoryProviders.values()].find(
      (item) => item.email.toLowerCase() === email.toLowerCase(),
    );
    return provider ? clone(provider) : undefined;
  }

  await ensureSchema();
  const result = await pool.query(
    `SELECT * FROM providers WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  return result.rows[0] ? mapProviderRow(result.rows[0]) : undefined;
}

export async function createProviderSession(
  session: Omit<ProviderSession, "createdAt" | "updatedAt">,
) {
  if (!pool) {
    const timestamp = now();
    const created: ProviderSession = {
      ...session,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memoryProviderSessions.set(created.id, clone(created));
    return clone(created);
  }

  await ensureSchema();
  const result = await pool.query(
    `
      INSERT INTO provider_sessions (
        id, provider_id, session_token_hash, expires_at
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [session.id, session.providerId, session.sessionTokenHash, session.expiresAt],
  );
  return mapProviderSessionRow(result.rows[0]);
}

export async function getProviderSessionByTokenHash(sessionTokenHash: string) {
  if (!pool) {
    const session = [...memoryProviderSessions.values()].find(
      (item) => item.sessionTokenHash === sessionTokenHash,
    );
    return session ? clone(session) : undefined;
  }

  await ensureSchema();
  const result = await pool.query(
    `
      SELECT * FROM provider_sessions
      WHERE session_token_hash = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [sessionTokenHash],
  );
  return result.rows[0] ? mapProviderSessionRow(result.rows[0]) : undefined;
}

export async function deleteProviderSession(sessionId: string) {
  if (!pool) {
    memoryProviderSessions.delete(sessionId);
    return;
  }

  await ensureSchema();
  await pool.query(`DELETE FROM provider_sessions WHERE id = $1`, [sessionId]);
}

export async function deleteProviderSessionByTokenHash(sessionTokenHash: string) {
  const session = await getProviderSessionByTokenHash(sessionTokenHash);
  if (!session) {
    return;
  }

  await deleteProviderSession(session.id);
}

export async function createInvocation(
  invocation: Omit<ApiInvocation, "createdAt" | "updatedAt">,
) {
  if (!pool) {
    ensureMemorySeeded();
    const timestamp = now();
    const created: ApiInvocation = {
      ...invocation,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memoryInvocations.set(created.id, clone(created));
    return clone(created);
  }

  await ensureSchema();
  const result = await pool.query(
    `
      INSERT INTO invocations (
        id, route_id, caller_mode, request_body, price_amount, currency, status,
        payment_session_id, transaction_reference, result_payload, error_message,
        idempotency_key, processing_started_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13
      )
      RETURNING *
    `,
    [
      invocation.id,
      invocation.routeId,
      invocation.callerMode,
      invocation.requestBody ?? null,
      invocation.priceAmount,
      invocation.currency,
      invocation.status,
      invocation.paymentSessionId ?? null,
      invocation.transactionReference ?? null,
      invocation.resultPayload ?? null,
      invocation.errorMessage ?? null,
      invocation.idempotencyKey ?? null,
      invocation.processingStartedAt ?? null,
    ],
  );

  return mapInvocationRow(result.rows[0]);
}

export async function getInvocation(invocationId: string) {
  if (!pool) {
    const invocation = memoryInvocations.get(invocationId);
    return invocation ? clone(invocation) : undefined;
  }

  await ensureSchema();
  const result = await pool.query(`SELECT * FROM invocations WHERE id = $1 LIMIT 1`, [
    invocationId,
  ]);

  return result.rows[0] ? mapInvocationRow(result.rows[0]) : undefined;
}

export async function getInvocationBundle(invocationId: string): Promise<InvocationBundle | undefined> {
  const invocation = await getInvocation(invocationId);
  if (!invocation) {
    return undefined;
  }

  const route = await getRoute(invocation.routeId);
  if (!route) {
    return undefined;
  }

  const payment = invocation.paymentSessionId
    ? await getPaymentSession(invocation.paymentSessionId)
    : undefined;

  return {
    invocation,
    route,
    payment,
  };
}

export async function listInvocationsForRoute(routeId: string, limit = 10) {
  if (!pool) {
    return [...memoryInvocations.values()]
      .filter((invocation) => invocation.routeId === routeId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((invocation) => clone(invocation));
  }

  await ensureSchema();
  const result = await pool.query(
    `
      SELECT * FROM invocations
      WHERE route_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [routeId, limit],
  );
  return result.rows.map(mapInvocationRow);
}

export async function findInvocationByRouteAndIdempotencyKey(
  routeId: string,
  idempotencyKey: string,
) {
  if (!pool) {
    const invocation = [...memoryInvocations.values()].find(
      (item) => item.routeId === routeId && item.idempotencyKey === idempotencyKey,
    );
    return invocation ? clone(invocation) : undefined;
  }

  await ensureSchema();
  const result = await pool.query(
    `
      SELECT * FROM invocations
      WHERE route_id = $1 AND idempotency_key = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [routeId, idempotencyKey],
  );

  return result.rows[0] ? mapInvocationRow(result.rows[0]) : undefined;
}

export async function updateInvocation(
  invocationId: string,
  updates: Partial<ApiInvocation>,
) {
  if (!pool) {
    return updateMemoryInvocation(invocationId, updates);
  }

  await ensureSchema();
  const statement = buildUpdateStatement(
    {
      routeId: updates.routeId,
      callerMode: updates.callerMode,
      requestBody: updates.requestBody,
      priceAmount: updates.priceAmount,
      currency: updates.currency,
      status: updates.status,
      paymentSessionId: updates.paymentSessionId,
      transactionReference: updates.transactionReference,
      resultPayload: updates.resultPayload,
      errorMessage: updates.errorMessage,
      idempotencyKey: updates.idempotencyKey,
      processingStartedAt: updates.processingStartedAt,
    },
    {
      routeId: "route_id",
      callerMode: "caller_mode",
      requestBody: "request_body",
      priceAmount: "price_amount",
      paymentSessionId: "payment_session_id",
      transactionReference: "transaction_reference",
      resultPayload: "result_payload",
      errorMessage: "error_message",
      idempotencyKey: "idempotency_key",
      processingStartedAt: "processing_started_at",
    },
  );

  const result = await pool.query(
    `UPDATE invocations SET ${statement.sql} WHERE id = $1 RETURNING *`,
    [invocationId, ...statement.values],
  );

  return result.rows[0] ? mapInvocationRow(result.rows[0]) : undefined;
}

export async function setInvocationStatus(
  invocationId: string,
  status: InvocationStatus,
  errorMessage?: string,
) {
  return updateInvocation(invocationId, {
    status,
    errorMessage,
  });
}

export async function beginInvocationProcessing(invocationId: string) {
  if (!pool) {
    const invocation = memoryInvocations.get(invocationId);
    if (!invocation) {
      return undefined;
    }

    if (invocation.status === "completed") {
      return clone(invocation);
    }

    if (invocation.status === "processing") {
      return clone(invocation);
    }

    if (invocation.status !== "paid") {
      return clone(invocation);
    }

    return updateMemoryInvocation(invocationId, {
      status: "processing",
      processingStartedAt: now(),
      errorMessage: undefined,
    });
  }

  await ensureSchema();
  const updated = await pool.query(
    `
      UPDATE invocations
      SET status = 'processing',
          processing_started_at = NOW(),
          error_message = NULL,
          updated_at = NOW()
      WHERE id = $1 AND status = 'paid'
      RETURNING *
    `,
    [invocationId],
  );

  if (updated.rows[0]) {
    return mapInvocationRow(updated.rows[0]);
  }

  const existing = await getInvocation(invocationId);
  return existing;
}

export async function attachInvocationResult(
  invocationId: string,
  result: ApiInvocationResult,
  transactionReference?: string,
) {
  return updateInvocation(invocationId, {
    status: "completed",
    resultPayload: result,
    transactionReference,
    errorMessage: undefined,
  });
}

export async function failInvocation(invocationId: string, errorMessage: string) {
  return updateInvocation(invocationId, {
    status: "failed",
    errorMessage,
  });
}

export async function createPaymentSession(
  session: Omit<PaymentSession, "createdAt" | "updatedAt">,
) {
  if (!pool) {
    const timestamp = now();
    const created: PaymentSession = {
      ...session,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    memoryPayments.set(created.id, clone(created));
    return clone(created);
  }

  await ensureSchema();
  const result = await pool.query(
    `
      INSERT INTO payment_sessions (
        id, invocation_id, amount, currency, provider, status, mpp_reference,
        stripe_payment_intent_id, pay_to_address, supported_token_contract,
        tempo_tx_hash, receipt_payload, verification_timestamp, expires_at,
        status_message
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14,
        $15
      )
      RETURNING *
    `,
    [
      session.id,
      session.invocationId,
      session.amount,
      session.currency,
      session.provider,
      session.status,
      session.mppReference,
      session.stripePaymentIntentId ?? null,
      session.payToAddress ?? null,
      session.supportedTokenContract ?? null,
      session.tempoTxHash ?? null,
      session.receiptPayload ?? null,
      session.verificationTimestamp ?? null,
      session.expiresAt ?? null,
      session.statusMessage,
    ],
  );

  return mapPaymentRow(result.rows[0]);
}

export async function getPaymentSession(paymentId: string) {
  if (!pool) {
    const payment = memoryPayments.get(paymentId);
    return payment ? clone(payment) : undefined;
  }

  await ensureSchema();
  const result = await pool.query(
    `SELECT * FROM payment_sessions WHERE id = $1 LIMIT 1`,
    [paymentId],
  );

  return result.rows[0] ? mapPaymentRow(result.rows[0]) : undefined;
}

export async function getPaymentSessionForInvocation(invocationId: string) {
  if (!pool) {
    const payment = [...memoryPayments.values()].find(
      (item) => item.invocationId === invocationId,
    );
    return payment ? clone(payment) : undefined;
  }

  await ensureSchema();
  const result = await pool.query(
    `
      SELECT * FROM payment_sessions
      WHERE invocation_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [invocationId],
  );

  return result.rows[0] ? mapPaymentRow(result.rows[0]) : undefined;
}

export async function getPaymentSessionByPayToAddress(payToAddress: string) {
  if (!pool) {
    const payment = [...memoryPayments.values()].find(
      (item) => item.payToAddress === payToAddress,
    );
    return payment ? clone(payment) : undefined;
  }

  await ensureSchema();
  const result = await pool.query(
    `SELECT * FROM payment_sessions WHERE pay_to_address = $1 LIMIT 1`,
    [payToAddress],
  );

  return result.rows[0] ? mapPaymentRow(result.rows[0]) : undefined;
}

export async function updatePaymentSession(
  paymentId: string,
  updates: Partial<PaymentSession>,
) {
  if (!pool) {
    return updateMemoryPayment(paymentId, updates);
  }

  await ensureSchema();
  const statement = buildUpdateStatement(
    {
      invocationId: updates.invocationId,
      amount: updates.amount,
      currency: updates.currency,
      provider: updates.provider,
      status: updates.status,
      mppReference: updates.mppReference,
      stripePaymentIntentId: updates.stripePaymentIntentId,
      payToAddress: updates.payToAddress,
      supportedTokenContract: updates.supportedTokenContract,
      tempoTxHash: updates.tempoTxHash,
      receiptPayload: updates.receiptPayload,
      verificationTimestamp: updates.verificationTimestamp,
      expiresAt: updates.expiresAt,
      statusMessage: updates.statusMessage,
    },
    {
      invocationId: "invocation_id",
      mppReference: "mpp_reference",
      stripePaymentIntentId: "stripe_payment_intent_id",
      payToAddress: "pay_to_address",
      supportedTokenContract: "supported_token_contract",
      tempoTxHash: "tempo_tx_hash",
      receiptPayload: "receipt_payload",
      verificationTimestamp: "verification_timestamp",
      expiresAt: "expires_at",
      statusMessage: "status_message",
    },
  );

  const result = await pool.query(
    `UPDATE payment_sessions SET ${statement.sql} WHERE id = $1 RETURNING *`,
    [paymentId, ...statement.values],
  );

  return result.rows[0] ? mapPaymentRow(result.rows[0]) : undefined;
}

export async function setPaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  extra: Partial<PaymentSession> = {},
) {
  return updatePaymentSession(paymentId, {
    status,
    ...extra,
  });
}

export function createInvocationRecord(input: {
  routeId: string;
  callerMode: CallerMode;
  requestBody?: JsonValue;
  priceAmount: string;
  status?: InvocationStatus;
  paymentSessionId?: string;
  idempotencyKey?: string;
}) {
  return {
    id: randomUUID(),
    routeId: input.routeId,
    callerMode: input.callerMode,
    requestBody: input.requestBody,
    priceAmount: input.priceAmount,
    currency: DEFAULT_CURRENCY,
    status: input.status ?? "created",
    paymentSessionId: input.paymentSessionId,
    idempotencyKey: input.idempotencyKey,
  } satisfies Omit<ApiInvocation, "createdAt" | "updatedAt">;
}

export function createPaymentSessionRecord(input: {
  invocationId: string;
  provider: PaymentSession["provider"];
  amount: string;
  statusMessage: string;
  status?: PaymentStatus;
  stripePaymentIntentId?: string;
  payToAddress?: string;
  supportedTokenContract?: string;
  expiresAt?: string;
}) {
  return {
    id: randomUUID(),
    invocationId: input.invocationId,
    amount: input.amount,
    currency: DEFAULT_CURRENCY,
    provider: input.provider,
    status: input.status ?? "pending",
    mppReference: `mpp_${input.invocationId.slice(0, 8)}`,
    stripePaymentIntentId: input.stripePaymentIntentId,
    payToAddress: input.payToAddress,
    supportedTokenContract: input.supportedTokenContract,
    expiresAt: input.expiresAt,
    statusMessage: input.statusMessage,
  } satisfies Omit<PaymentSession, "createdAt" | "updatedAt">;
}

export async function getMppStoreValue(key: string) {
  if (!pool) {
    return clone(memoryMppStore.get(key) ?? null);
  }

  await ensureSchema();
  const result = await pool.query(
    `SELECT store_value FROM mpp_kv WHERE store_key = $1 LIMIT 1`,
    [key],
  );
  return result.rows[0] ? clone(result.rows[0].store_value) : null;
}

export async function putMppStoreValue(key: string, value: unknown) {
  if (!pool) {
    memoryMppStore.set(key, clone(value));
    return;
  }

  await ensureSchema();
  await pool.query(
    `
      INSERT INTO mpp_kv (store_key, store_value)
      VALUES ($1, $2)
      ON CONFLICT (store_key)
      DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = NOW()
    `,
    [key, value],
  );
}

export async function deleteMppStoreValue(key: string) {
  if (!pool) {
    memoryMppStore.delete(key);
    return;
  }

  await ensureSchema();
  await pool.query(`DELETE FROM mpp_kv WHERE store_key = $1`, [key]);
}

export async function updateMppStoreValue<Result>(
  key: string,
  fn: (current: unknown | null) => {
    op: "noop";
    result: Result;
  } | {
    op: "set";
    value: unknown;
    result: Result;
  } | {
    op: "delete";
    result: Result;
  },
) {
  if (!pool) {
    const current = memoryMppStore.has(key) ? clone(memoryMppStore.get(key)) : null;
    const change = fn(current);
    if (change.op === "set") {
      memoryMppStore.set(key, clone(change.value));
    } else if (change.op === "delete") {
      memoryMppStore.delete(key);
    }
    return change.result;
  }

  await ensureSchema();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [key]);
    const currentResult = await client.query(
      `SELECT store_value FROM mpp_kv WHERE store_key = $1 LIMIT 1`,
      [key],
    );
    const current = currentResult.rows[0]?.store_value ?? null;
    const change = fn(current);
    if (change.op === "set") {
      await client.query(
        `
          INSERT INTO mpp_kv (store_key, store_value)
          VALUES ($1, $2)
          ON CONFLICT (store_key)
          DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = NOW()
        `,
        [key, change.value],
      );
    } else if (change.op === "delete") {
      await client.query(`DELETE FROM mpp_kv WHERE store_key = $1`, [key]);
    }
    await client.query("COMMIT");
    return change.result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
