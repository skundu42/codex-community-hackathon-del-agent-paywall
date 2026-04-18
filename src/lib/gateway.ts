import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import type {
  ApiInvocationResult,
  ApiRoute,
  ApiRouteInput,
  CurrencyCode,
  HttpMethod,
  JsonObject,
  JsonValue,
  LandingPageRoastInput,
  PublicApiRoute,
} from "@/lib/types";

export const DEFAULT_CURRENCY: CurrencyCode = "USDC";
export const DEFAULT_PRICE_AMOUNT = "0.02";
export const FEATURED_ROUTE_SLUG = "landing-page-roast";

const SUPPORTED_METHODS: HttpMethod[] = ["GET", "POST"];
const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "host.docker.internal",
  "gateway.docker.internal",
]);

function normalizeOptional(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function sanitizeHeaderName(value: string) {
  if (!/^[A-Za-z0-9-]+$/.test(value)) {
    throw new Error(
      "Authorization header name can only contain letters, numbers, and hyphens.",
    );
  }

  return value;
}

export function createSlug(value: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Slug cannot be empty.");
  }

  return slug;
}

function parsePositiveAmount(value: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Price amount must be a positive number.");
  }

  if (parsed > 1000) {
    throw new Error("Price amount is unrealistically high for this MVP.");
  }

  return parsed.toFixed(2);
}

function isPrivateIpAddress(address: string) {
  if (address === "::1") {
    return true;
  }

  const version = isIP(address);
  if (version === 0) {
    return false;
  }

  if (version === 4) {
    const parts = address.split(".").map((part) => Number(part));
    const [a, b] = parts;

    if (a === 10 || a === 127 || a === 0) {
      return true;
    }

    if (a === 169 && b === 254) {
      return true;
    }

    if (a === 172 && b >= 16 && b <= 31) {
      return true;
    }

    if (a === 192 && b === 168) {
      return true;
    }

    return false;
  }

  const normalized = address.toLowerCase();
  return (
    normalized === "::1" ||
    normalized === "::" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80") ||
    normalized.startsWith("::ffff:127.")
  );
}

async function validateUpstreamUrl(
  rawUrl: string,
  options?: {
    allowLocalUpstream?: boolean;
  },
) {
  let upstreamUrl: URL;

  try {
    upstreamUrl = new URL(rawUrl);
  } catch {
    throw new Error("Upstream URL must be a valid absolute URL.");
  }

  if (!["http:", "https:"].includes(upstreamUrl.protocol)) {
    throw new Error("Only http and https upstream URLs are supported.");
  }

  const hostname = upstreamUrl.hostname.toLowerCase();

  if (options?.allowLocalUpstream) {
    return upstreamUrl.toString();
  }

  if (
    BLOCKED_HOSTS.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  ) {
    throw new Error("Loopback and local-network upstream URLs are not allowed.");
  }

  if (isIP(hostname) && isPrivateIpAddress(hostname)) {
    throw new Error("Private-network upstream IPs are not allowed.");
  }

  if (!isIP(hostname)) {
    try {
      const records = await lookup(hostname, { all: true });
      if (records.length === 0) {
        throw new Error("hostname did not resolve");
      }

      for (const record of records) {
        if (isPrivateIpAddress(record.address)) {
          throw new Error("resolved to private address");
        }
      }
    } catch {
      throw new Error(
        "Upstream URL must resolve to a public address before it can be registered.",
      );
    }
  }

  return upstreamUrl.toString();
}

export async function validateRouteInput(
  input: ApiRouteInput,
  options?: {
    allowLocalUpstream?: boolean;
  },
) {
  const providerName = input.providerName?.trim();
  const routeName = input.routeName?.trim();
  const description = normalizeOptional(input.description);
  const authHeaderName = normalizeOptional(input.authHeaderName);
  const authHeaderValue = normalizeOptional(input.authHeaderValue);
  const routeKind = input.routeKind;

  if (!providerName) {
    throw new Error("Provider name is required.");
  }

  if (!routeName) {
    throw new Error("Route name is required.");
  }

  if (routeKind !== "internal_demo" && routeKind !== "external_proxy") {
    throw new Error("routeKind must be either internal_demo or external_proxy.");
  }

  if (authHeaderName && !authHeaderValue) {
    throw new Error("Auth header value is required when auth header name is set.");
  }

  if (!authHeaderName && authHeaderValue) {
    throw new Error("Auth header name is required when auth header value is set.");
  }

  if (routeKind === "internal_demo") {
    return {
      providerName,
      routeName,
      description,
      slug: createSlug(input.slug ?? routeName),
      routeKind,
      upstreamUrl: undefined,
      httpMethod: "POST" as HttpMethod,
      priceAmount: parsePositiveAmount(input.priceAmount ?? DEFAULT_PRICE_AMOUNT),
      currency: DEFAULT_CURRENCY,
      authHeaderName: undefined,
      authHeaderValue: undefined,
      featured: Boolean(input.featured),
    };
  }

  const method = input.httpMethod?.toUpperCase() as HttpMethod | undefined;
  if (!method || !SUPPORTED_METHODS.includes(method)) {
    throw new Error(`HTTP method must be one of: ${SUPPORTED_METHODS.join(", ")}.`);
  }

  return {
    providerName,
    routeName,
    description,
    slug: createSlug(input.slug ?? routeName),
    routeKind,
    upstreamUrl: await validateUpstreamUrl(input.upstreamUrl ?? "", options),
    httpMethod: method,
    priceAmount: parsePositiveAmount(input.priceAmount ?? DEFAULT_PRICE_AMOUNT),
    currency: DEFAULT_CURRENCY,
    authHeaderName: authHeaderName ? sanitizeHeaderName(authHeaderName) : undefined,
    authHeaderValue,
    featured: Boolean(input.featured),
  };
}

export function validateLandingPageRoastInput(
  input: JsonValue | undefined,
): LandingPageRoastInput {
  const payload =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as JsonObject)
      : {};

  const url =
    typeof payload.url === "string" && payload.url.trim()
      ? payload.url.trim()
      : undefined;
  const marketingCopy =
    typeof payload.marketingCopy === "string" && payload.marketingCopy.trim()
      ? payload.marketingCopy.trim()
      : undefined;

  if (!url && !marketingCopy) {
    throw new Error("Provide either a website URL or a block of marketing copy.");
  }

  if (url) {
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error("The URL must be a valid http or https URL.");
    }
  }

  return {
    url,
    marketingCopy,
    brandName:
      typeof payload.brandName === "string" && payload.brandName.trim()
        ? payload.brandName.trim()
        : undefined,
    targetAudience:
      typeof payload.targetAudience === "string" && payload.targetAudience.trim()
        ? payload.targetAudience.trim()
        : undefined,
  };
}

export function validateInvocationPayloadForRoute(
  route: ApiRoute,
  requestBody: JsonValue | undefined,
) {
  if (route.routeKind === "internal_demo") {
    return validateLandingPageRoastInput(requestBody) as unknown as JsonValue;
  }

  return requestBody;
}

function canSendBody(method: HttpMethod) {
  return method !== "GET";
}

function buildForwardHeaders(route: ApiRoute) {
  const headers = new Headers({
    accept: "application/json, text/plain;q=0.8, */*;q=0.5",
  });

  if (route.authHeaderName && route.authHeaderValue) {
    headers.set(route.authHeaderName, route.authHeaderValue);
  }

  return headers;
}

function pickResponseHeaders(headers: Headers) {
  const picked: Record<string, string> = {};

  for (const name of ["content-type", "cache-control", "x-request-id"]) {
    const value = headers.get(name);
    if (value) {
      picked[name] = value;
    }
  }

  return picked;
}

async function parseResponseBody(response: Response): Promise<JsonValue | string | null> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as JsonValue;
  }

  return await response.text();
}

export async function proxyUpstreamRequest(
  route: ApiRoute,
  requestBody?: JsonValue,
): Promise<ApiInvocationResult> {
  if (!route.upstreamUrl || !route.httpMethod) {
    throw new Error("External proxy routes require an upstream URL and HTTP method.");
  }

  const headers = buildForwardHeaders(route);
  const requestInit: RequestInit = {
    method: route.httpMethod,
    headers,
    cache: "no-store",
  };

  if (requestBody !== undefined && canSendBody(route.httpMethod)) {
    headers.set("content-type", "application/json");
    requestInit.body = JSON.stringify(requestBody);
  }

  const response = await fetch(route.upstreamUrl, requestInit);
  const responseBody = await parseResponseBody(response);

  return {
    kind: "proxy",
    upstreamStatus: response.status,
    upstreamHeaders: pickResponseHeaders(response.headers),
    responseBody,
  };
}

export function toPublicRoute(route: ApiRoute): PublicApiRoute {
  return {
    id: route.id,
    slug: route.slug,
    routeKind: route.routeKind,
    providerName: route.providerName,
    routeName: route.routeName,
    description: route.description,
    httpMethod: route.httpMethod,
    priceAmount: route.priceAmount,
    currency: route.currency,
    featured: route.featured,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
  };
}
