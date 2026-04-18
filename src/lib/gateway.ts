import type {
  ApiInvocationResult,
  ApiRoute,
  ApiRouteInput,
  CurrencyCode,
  HttpMethod,
  InvocationInput,
  JsonObject,
  JsonValue,
} from "@/lib/types";

export const DEFAULT_CURRENCY: CurrencyCode = "USDC";
export const DEFAULT_PRICE_AMOUNT = "0.02";

const SUPPORTED_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function normalizeOptional(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function sanitizeHeaderName(value: string) {
  if (!/^[A-Za-z0-9-]+$/.test(value)) {
    throw new Error("Authorization header name can only contain letters, numbers, and hyphens.");
  }

  return value;
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

function validateUpstreamUrl(rawUrl: string) {
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
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1";

  if (process.env.NODE_ENV === "production" && isLocalHost) {
    throw new Error("Localhost upstream URLs are not allowed in production.");
  }

  return upstreamUrl.toString();
}

export function validateRouteInput(input: ApiRouteInput) {
  const providerName = input.providerName?.trim();
  const routeName = input.routeName?.trim();
  const description = normalizeOptional(input.description);
  const authHeaderName = normalizeOptional(input.authHeaderName);
  const authHeaderValue = normalizeOptional(input.authHeaderValue);
  const sampleRequestBody = normalizeOptional(input.sampleRequestBody);
  const method = input.httpMethod?.toUpperCase() as HttpMethod | undefined;

  if (!providerName) {
    throw new Error("Provider name is required.");
  }

  if (!routeName) {
    throw new Error("Route name is required.");
  }

  if (!method || !SUPPORTED_METHODS.includes(method)) {
    throw new Error(`HTTP method must be one of: ${SUPPORTED_METHODS.join(", ")}.`);
  }

  if (authHeaderName && !authHeaderValue) {
    throw new Error("Auth header value is required when auth header name is set.");
  }

  if (!authHeaderName && authHeaderValue) {
    throw new Error("Auth header name is required when auth header value is set.");
  }

  return {
    providerName,
    routeName,
    description,
    upstreamUrl: validateUpstreamUrl(input.upstreamUrl),
    httpMethod: method,
    priceAmount: parsePositiveAmount(input.priceAmount ?? DEFAULT_PRICE_AMOUNT),
    currency: DEFAULT_CURRENCY,
    authHeaderName: authHeaderName ? sanitizeHeaderName(authHeaderName) : undefined,
    authHeaderValue,
    sampleRequestBody,
  };
}

export function parseInvocationBody(rawBody?: string) {
  const trimmed = rawBody?.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed) as JsonValue;
  } catch {
    throw new Error("Invocation body must be valid JSON.");
  }
}

export function validateInvocationInput(input: InvocationInput) {
  if (!input.routeId?.trim()) {
    throw new Error("routeId is required.");
  }

  return {
    routeId: input.routeId.trim(),
    requestBody: input.requestBody,
  };
}

function canSendBody(method: HttpMethod) {
  return !["GET", "DELETE"].includes(method);
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
    upstreamStatus: response.status,
    upstreamHeaders: pickResponseHeaders(response.headers),
    responseBody,
  };
}

export function getSampleInvocationPayload(route: ApiRoute): JsonObject {
  if (route.sampleRequestBody) {
    const parsed = parseInvocationBody(route.sampleRequestBody);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
  }

  return {
    customerSegment: "AI agent builders",
    action: "score",
    message: "Wrap this API behind a paid MPP route.",
  };
}
