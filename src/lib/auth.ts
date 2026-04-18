import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

import { cookies } from "next/headers";

import {
  createProvider,
  createProviderSession,
  deleteProviderSessionByTokenHash,
  getProvider,
  getProviderByEmail,
  getProviderSessionByTokenHash,
} from "@/lib/store";
import type { Provider, PublicProvider } from "@/lib/types";

const scrypt = promisify(scryptCallback);

export const SESSION_COOKIE_NAME = "agentpaywall_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function validateEmail(value: string) {
  const email = normalizeEmail(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email must be a valid email address.");
  }
  return email;
}

function validatePassword(value: string) {
  if (value.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return value;
}

export function validateWalletAddress(value: string) {
  const walletAddress = value.trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    throw new Error("Wallet address must be a valid EVM address.");
  }
  return walletAddress;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [salt, expectedHash] = passwordHash.split(":");
  if (!salt || !expectedHash) {
    return false;
  }

  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHash, "hex");
  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function serializeSessionCookie(token: string, expiresAt: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}${secure}`;
}

export function serializeClearedSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(0).toUTCString()}${secure}`;
}

function parseCookieHeader(header: string | null) {
  if (!header) {
    return {};
  }

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1
          ? [part, ""]
          : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function toPublicProvider(provider: Provider): PublicProvider {
  return {
    id: provider.id,
    providerName: provider.providerName,
    email: provider.email,
    walletAddress: provider.walletAddress,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
  };
}

export async function registerProviderAccount(input: {
  providerName: string;
  email: string;
  password: string;
  walletAddress: string;
}) {
  const providerName = input.providerName.trim();
  if (!providerName) {
    throw new Error("Provider name is required.");
  }

  const email = validateEmail(input.email);
  const password = validatePassword(input.password);
  const walletAddress = validateWalletAddress(input.walletAddress);

  const existing = await getProviderByEmail(email);
  if (existing) {
    throw new Error("An account already exists for this email address.");
  }

  return createProvider({
    id: randomBytes(16).toString("hex"),
    providerName,
    email,
    passwordHash: await hashPassword(password),
    walletAddress,
  });
}

export async function authenticateProviderAccount(input: {
  email: string;
  password: string;
}) {
  const email = validateEmail(input.email);
  const provider = await getProviderByEmail(email);
  if (!provider) {
    throw new Error("Invalid email or password.");
  }

  const valid = await verifyPassword(validatePassword(input.password), provider.passwordHash);
  if (!valid) {
    throw new Error("Invalid email or password.");
  }

  return provider;
}

export async function createProviderAuthSession(providerId: string) {
  const sessionToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const session = await createProviderSession({
    id: randomBytes(16).toString("hex"),
    providerId,
    sessionTokenHash: hashSessionToken(sessionToken),
    expiresAt,
  });

  return {
    session,
    sessionToken,
  };
}

async function getProviderForSessionToken(sessionToken: string | undefined) {
  if (!sessionToken) {
    return undefined;
  }

  const session = await getProviderSessionByTokenHash(hashSessionToken(sessionToken));
  if (!session) {
    return undefined;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await deleteProviderSessionByTokenHash(session.sessionTokenHash);
    return undefined;
  }

  return getProvider(session.providerId);
}

export async function getAuthenticatedProviderFromRequest(request: Request) {
  const parsed = parseCookieHeader(request.headers.get("cookie"));
  return getProviderForSessionToken(parsed[SESSION_COOKIE_NAME]);
}

export async function getAuthenticatedProviderFromCookies() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return getProviderForSessionToken(sessionToken);
}

export async function logoutProviderFromRequest(request: Request) {
  const parsed = parseCookieHeader(request.headers.get("cookie"));
  const sessionToken = parsed[SESSION_COOKIE_NAME];
  if (!sessionToken) {
    return;
  }

  await deleteProviderSessionByTokenHash(hashSessionToken(sessionToken));
}
