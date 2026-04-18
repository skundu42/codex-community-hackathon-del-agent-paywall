import type {
  ApiInvocation,
  ApiInvocationResult,
  ApiRoute,
  PaymentSession,
  PaymentStatus,
  InvocationStatus,
} from "@/lib/types";

const routes = new Map<string, ApiRoute>();
const invocations = new Map<string, ApiInvocation>();
const payments = new Map<string, PaymentSession>();

function now() {
  return new Date().toISOString();
}

function mergeUpdatedAt<T extends { updatedAt: string }>(
  current: T,
  updates: Partial<T>,
): T {
  return {
    ...current,
    ...updates,
    updatedAt: now(),
  };
}

export function listRoutes() {
  return [...routes.values()];
}

export function createRoute(
  route: Omit<ApiRoute, "createdAt" | "updatedAt">,
): ApiRoute {
  const created = {
    ...route,
    createdAt: now(),
    updatedAt: now(),
  };

  routes.set(created.id, created);
  return created;
}

export function getRoute(routeId: string) {
  return routes.get(routeId);
}

export function createInvocation(
  invocation: Omit<ApiInvocation, "createdAt" | "updatedAt">,
): ApiInvocation {
  const created = {
    ...invocation,
    createdAt: now(),
    updatedAt: now(),
  };

  invocations.set(created.id, created);
  return created;
}

export function getInvocation(invocationId: string) {
  return invocations.get(invocationId);
}

export function updateInvocation(
  invocationId: string,
  updates: Partial<ApiInvocation>,
): ApiInvocation | undefined {
  const existing = invocations.get(invocationId);

  if (!existing) {
    return undefined;
  }

  const updated = mergeUpdatedAt(existing, updates);
  invocations.set(invocationId, updated);
  return updated;
}

export function setInvocationStatus(
  invocationId: string,
  status: InvocationStatus,
  errorMessage?: string,
) {
  return updateInvocation(invocationId, {
    status,
    errorMessage,
  });
}

export function attachInvocationResult(
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

export function createPaymentSession(
  session: Omit<PaymentSession, "createdAt" | "updatedAt">,
): PaymentSession {
  const created = {
    ...session,
    createdAt: now(),
    updatedAt: now(),
  };

  payments.set(created.id, created);
  return created;
}

export function getPaymentSession(paymentId: string) {
  return payments.get(paymentId);
}

export function updatePaymentSession(
  paymentId: string,
  updates: Partial<PaymentSession>,
): PaymentSession | undefined {
  const existing = payments.get(paymentId);

  if (!existing) {
    return undefined;
  }

  const updated = mergeUpdatedAt(existing, updates);
  payments.set(paymentId, updated);
  return updated;
}

export function setPaymentStatus(
  paymentId: string,
  status: PaymentStatus,
  extra: Partial<PaymentSession> = {},
) {
  return updatePaymentSession(paymentId, {
    status,
    ...extra,
  });
}
