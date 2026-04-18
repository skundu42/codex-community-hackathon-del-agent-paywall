export type CurrencyCode = "USDC";
export type HttpMethod = "GET" | "POST";
export type PaymentProvider = "mock" | "tempo_testnet" | "stripe_mpp";
export type RouteKind = "internal_demo" | "external_proxy";
export type CallerMode = "browser" | "agent";

export type InvocationStatus =
  | "created"
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "completed"
  | "failed";

export type PaymentStatus = "pending" | "paid" | "failed" | "expired";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonObject
  | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export interface ApiRouteInput {
  providerName: string;
  routeName: string;
  description?: string;
  slug?: string;
  routeKind: RouteKind;
  upstreamUrl?: string;
  httpMethod?: HttpMethod;
  priceAmount: string;
  authHeaderName?: string;
  authHeaderValue?: string;
  featured?: boolean;
}

export interface Provider {
  id: string;
  providerName: string;
  email: string;
  passwordHash: string;
  walletAddress: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicProvider {
  id: string;
  providerName: string;
  email: string;
  walletAddress: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderSession {
  id: string;
  providerId: string;
  sessionTokenHash: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiRoute {
  id: string;
  providerId?: string;
  slug: string;
  routeKind: RouteKind;
  providerName: string;
  routeName: string;
  description?: string;
  upstreamUrl?: string;
  httpMethod?: HttpMethod;
  priceAmount: string;
  currency: CurrencyCode;
  authHeaderName?: string;
  authHeaderValue?: string;
  status: "active";
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicApiRoute {
  id: string;
  slug: string;
  routeKind: RouteKind;
  providerName: string;
  routeName: string;
  description?: string;
  httpMethod?: HttpMethod;
  priceAmount: string;
  currency: CurrencyCode;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LandingPageRoastInput {
  url?: string;
  marketingCopy?: string;
  brandName?: string;
  targetAudience?: string;
}

export interface LandingPageRoastResult {
  kind: "landing_page_roast";
  summary: string;
  clarityScore: number;
  headlineFeedback: string;
  ctaFeedback: string;
  conversionSuggestions: string[];
  quickWins: string[];
  inputEcho: {
    url?: string;
    marketingCopy?: string;
    brandName?: string;
    targetAudience?: string;
  };
}

export interface ProxyInvocationResult {
  kind: "proxy";
  upstreamStatus: number;
  upstreamHeaders: Record<string, string>;
  responseBody: JsonValue | string | null;
}

export type ApiInvocationResult = LandingPageRoastResult | ProxyInvocationResult;

export interface ApiInvocation {
  id: string;
  routeId: string;
  callerMode: CallerMode;
  requestBody?: JsonValue;
  priceAmount: string;
  currency: CurrencyCode;
  status: InvocationStatus;
  paymentSessionId?: string;
  transactionReference?: string;
  resultPayload?: ApiInvocationResult;
  errorMessage?: string;
  idempotencyKey?: string;
  processingStartedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentReceiptPayload {
  method: string;
  reference: string;
  externalId?: string;
  status: "success";
  timestamp: string;
}

export interface PaymentSession {
  id: string;
  invocationId: string;
  amount: string;
  currency: CurrencyCode;
  provider: PaymentProvider;
  status: PaymentStatus;
  mppReference: string;
  stripePaymentIntentId?: string;
  payToAddress?: string;
  supportedTokenContract?: string;
  tempoTxHash?: string;
  receiptPayload?: PaymentReceiptPayload;
  verificationTimestamp?: string;
  expiresAt?: string;
  statusMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvocationBundle {
  invocation: ApiInvocation;
  route: ApiRoute;
  payment?: PaymentSession;
}
