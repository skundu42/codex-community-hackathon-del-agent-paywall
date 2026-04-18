import { randomUUID } from "node:crypto";

import { appEnv } from "@/lib/env";
import { DEFAULT_CURRENCY } from "@/lib/gateway";
import {
  createPaymentSession,
  getInvocation,
  getPaymentSession,
  setPaymentStatus,
  setInvocationStatus,
  updateInvocation,
} from "@/lib/store";
import type { PaymentSession } from "@/lib/types";

export function getPaymentProviderLabel() {
  return appEnv.provider === "mock" ? "Mock Tempo" : "Stripe MPP";
}

export async function initiatePaymentForInvocation(invocationId: string) {
  const invocation = getInvocation(invocationId);

  if (!invocation) {
    throw new Error("Invocation not found.");
  }

  if (invocation.paymentSessionId) {
    const existing = getPaymentSession(invocation.paymentSessionId);
    if (existing) {
      return existing;
    }
  }

  if (appEnv.provider === "stripe_mpp") {
    throw new Error(
      "The browser demo uses mock settlement. Use the MPP route for real agent payments.",
    );
  }

  const session = createPaymentSession({
    id: randomUUID(),
    invocationId: invocation.id,
    amount: invocation.priceAmount,
    currency: invocation.currency ?? DEFAULT_CURRENCY,
    provider: "mock",
    status: "pending",
    mppReference: `mpp_demo_${invocation.id.slice(0, 8)}`,
    statusMessage: "Awaiting payment approval in demo mode.",
  });

  updateInvocation(invocationId, {
    paymentSessionId: session.id,
    status: "awaiting_payment",
  });

  return session;
}

export async function getPaymentStatus(paymentId: string) {
  const payment = getPaymentSession(paymentId);

  if (!payment) {
    throw new Error("Payment session not found.");
  }

  return payment;
}

export async function simulatePayment(paymentId: string): Promise<PaymentSession> {
  const payment = getPaymentSession(paymentId);

  if (!payment) {
    throw new Error("Payment session not found.");
  }

  if (payment.provider !== "mock") {
    throw new Error("Only mock payments can be simulated.");
  }

  if (payment.status === "paid") {
    return payment;
  }

  const txHash = `0x${randomUUID().replaceAll("-", "").padEnd(64, "0").slice(0, 64)}`;
  const verificationTimestamp = new Date().toISOString();

  const updatedPayment = setPaymentStatus(paymentId, "paid", {
    tempoTxHash: txHash,
    verificationTimestamp,
    statusMessage: "Payment verified on demo Tempo rail.",
  });

  if (!updatedPayment) {
    throw new Error("Failed to update payment session.");
  }

  setInvocationStatus(payment.invocationId, "paid");

  return updatedPayment;
}
