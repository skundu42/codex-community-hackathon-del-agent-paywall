export type CurrencyCode = "USDC";
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type InvocationStatus =
  | "created"
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "completed"
  | "failed";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "expired";

export type PaymentProvider = "mock" | "stripe_mpp";

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
  upstreamUrl: string;
  httpMethod: HttpMethod;
  priceAmount: string;
  authHeaderName?: string;
  authHeaderValue?: string;
  sampleRequestBody?: string;
}

export interface ApiRoute {
  id: string;
  providerName: string;
  routeName: string;
  description?: string;
  upstreamUrl: string;
  httpMethod: HttpMethod;
  priceAmount: string;
  currency: CurrencyCode;
  authHeaderName?: string;
  authHeaderValue?: string;
  sampleRequestBody?: string;
  status: "active";
  createdAt: string;
  updatedAt: string;
}

export interface ApiInvocationResult {
  upstreamStatus: number;
  upstreamHeaders: Record<string, string>;
  responseBody: JsonValue | string | null;
}

export interface InvocationInput {
  routeId: string;
  requestBody?: JsonValue;
}

export interface ApiInvocation {
  id: string;
  routeId: string;
  requestBody?: JsonValue;
  priceAmount: string;
  currency: CurrencyCode;
  status: InvocationStatus;
  paymentSessionId?: string;
  transactionReference?: string;
  resultPayload?: ApiInvocationResult;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentSession {
  id: string;
  invocationId: string;
  amount: string;
  currency: CurrencyCode;
  provider: PaymentProvider;
  status: PaymentStatus;
  mppReference: string;
  tempoTxHash?: string;
  payToAddress?: string;
  supportedTokenContract?: string;
  verificationTimestamp?: string;
  statusMessage: string;
  createdAt: string;
  updatedAt: string;
}
