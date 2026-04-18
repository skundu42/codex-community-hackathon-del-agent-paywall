import { randomUUID } from "node:crypto";

import Stripe from "stripe";

import { appEnv } from "@/lib/env";
import { DEFAULT_CURRENCY } from "@/lib/gateway";
import {
  createPaymentSession,
  createPaymentSessionRecord,
  getInvocation,
  getPaymentSession,
  getPaymentSessionForInvocation,
  setInvocationStatus,
  setPaymentStatus,
  updateInvocation,
} from "@/lib/store";
import type { PaymentSession } from "@/lib/types";

export const TEMPO_TESTNET_PATH_USD =
  "0x20c0000000000000000000000000000000000000";
export const TEMPO_MAINNET_USDC =
  "0x20c000000000000000000000b9537d11c60e8b50";
export const DEPOSIT_TTL_MS = 5 * 60 * 1000;

function getStripeClient() {
  if (!appEnv.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is required for Stripe MPP mode.");
  }

  return new Stripe(appEnv.stripeSecretKey, {
    apiVersion: "2026-03-04.preview" as never,
  });
}

export function getTempoTokenContract() {
  if (appEnv.provider === "tempo_testnet" || appEnv.provider === "mock") {
    return TEMPO_TESTNET_PATH_USD;
  }

  return appEnv.isProduction ? TEMPO_MAINNET_USDC : TEMPO_TESTNET_PATH_USD;
}

function getStatusMessage(status: PaymentSession["status"]) {
  switch (status) {
    case "paid":
      return "Payment verified on Tempo.";
    case "failed":
      return "Payment failed before settlement.";
    case "expired":
      return "Payment window expired before settlement.";
    default:
      return "Waiting for payment on Tempo.";
  }
}

function getCryptoDisplayDetails(paymentIntent: Stripe.PaymentIntent) {
  const details = (
    paymentIntent.next_action as
      | {
          crypto_display_details?: {
            deposit_addresses?: {
              tempo?: {
                address?: `0x${string}`;
                supported_tokens?: Array<{
                  token_contract_address?: string;
                }>;
              };
            };
          };
        }
      | undefined
  )?.crypto_display_details;

  const payToAddress = details?.deposit_addresses?.tempo?.address;
  const supportedTokenContract =
    details?.deposit_addresses?.tempo?.supported_tokens?.[0]
      ?.token_contract_address;

  if (!payToAddress) {
    throw new Error("PaymentIntent did not include Tempo deposit details.");
  }

  return {
    payToAddress,
    supportedTokenContract,
  };
}

async function createStripePaymentSession(invocationId: string) {
  const invocation = await getInvocation(invocationId);
  if (!invocation) {
    throw new Error("Invocation not found.");
  }

  const stripe = getStripeClient();
  const amountInCents = Math.round(Number(invocation.priceAmount) * 100);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: "usd",
    confirm: true,
    metadata: {
      invocationId: invocation.id,
      routeId: invocation.routeId,
      callerMode: invocation.callerMode,
    },
    payment_method_types: ["crypto"],
    payment_method_data: {
      type: "crypto",
    },
    payment_method_options: {
      crypto: {
        mode: "deposit",
        deposit_options: {
          networks: ["tempo"],
        },
      } as Stripe.PaymentIntentCreateParams.PaymentMethodOptions.Crypto,
    },
  });

  const { payToAddress, supportedTokenContract } =
    getCryptoDisplayDetails(paymentIntent);
  const session = await createPaymentSession(
    createPaymentSessionRecord({
      invocationId: invocation.id,
      provider: "stripe_mpp",
      amount: invocation.priceAmount,
      stripePaymentIntentId: paymentIntent.id,
      payToAddress,
      supportedTokenContract,
      expiresAt: new Date(Date.now() + DEPOSIT_TTL_MS).toISOString(),
      statusMessage: "Waiting for a Tempo deposit on the generated address.",
    }),
  );

  await updateInvocation(invocation.id, {
    paymentSessionId: session.id,
    status: "awaiting_payment",
  });

  return session;
}

async function createMockPaymentSession(invocationId: string) {
  const invocation = await getInvocation(invocationId);
  if (!invocation) {
    throw new Error("Invocation not found.");
  }

  const session = await createPaymentSession(
    createPaymentSessionRecord({
      invocationId: invocation.id,
      provider: "mock",
      amount: invocation.priceAmount,
      payToAddress: `0xmock${randomUUID().replaceAll("-", "").slice(0, 36)}`,
      supportedTokenContract: getTempoTokenContract(),
      expiresAt: new Date(Date.now() + DEPOSIT_TTL_MS).toISOString(),
      statusMessage: "Awaiting simulated payment approval in mock mode.",
    }),
  );

  await updateInvocation(invocation.id, {
    paymentSessionId: session.id,
    status: "awaiting_payment",
  });

  return session;
}

export async function createOrGetPaymentSession(invocationId: string) {
  const invocation = await getInvocation(invocationId);
  if (!invocation) {
    throw new Error("Invocation not found.");
  }

  const existing = await getPaymentSessionForInvocation(invocationId);
  if (existing && existing.status !== "expired" && existing.status !== "failed") {
    return existing;
  }

  if (appEnv.provider === "mock") {
    return createMockPaymentSession(invocationId);
  }

  if (appEnv.provider === "tempo_testnet") {
    return createMockPaymentSession(invocationId);
  }

  return createStripePaymentSession(invocationId);
}

function mapStripePaymentIntentStatus(paymentIntent: Stripe.PaymentIntent) {
  switch (paymentIntent.status) {
    case "succeeded":
      return "paid" as const;
    case "canceled":
      return "failed" as const;
    default:
      return "pending" as const;
  }
}

export async function refreshPaymentStatus(paymentId: string) {
  const payment = await getPaymentSession(paymentId);
  if (!payment) {
    throw new Error("Payment session not found.");
  }

  if (payment.status === "paid" || payment.status === "failed" || payment.status === "expired") {
    return payment;
  }

  if (payment.expiresAt && new Date(payment.expiresAt).getTime() <= Date.now()) {
    const expired = await setPaymentStatus(payment.id, "expired", {
      statusMessage: getStatusMessage("expired"),
    });
    if (expired) {
      await setInvocationStatus(payment.invocationId, "failed", "Payment expired.");
      return expired;
    }
  }

  if (payment.provider === "mock" || !payment.stripePaymentIntentId) {
    return payment;
  }

  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(
    payment.stripePaymentIntentId,
  );
  const mappedStatus = mapStripePaymentIntentStatus(paymentIntent);

  if (mappedStatus === "pending") {
    return payment;
  }

  const next = await setPaymentStatus(payment.id, mappedStatus, {
    statusMessage: getStatusMessage(mappedStatus),
    verificationTimestamp:
      mappedStatus === "paid" ? new Date().toISOString() : undefined,
  });

  if (!next) {
    throw new Error("Failed to update payment status.");
  }

  if (mappedStatus === "paid") {
    await setInvocationStatus(payment.invocationId, "paid");
  } else {
    await setInvocationStatus(payment.invocationId, "failed", next.statusMessage);
  }

  return next;
}

export async function simulatePayment(paymentId: string) {
  const payment = await getPaymentSession(paymentId);
  if (!payment) {
    throw new Error("Payment session not found.");
  }

  if (payment.provider !== "mock") {
    throw new Error("Only mock payments can be simulated.");
  }

  const txHash = `0x${randomUUID().replaceAll("-", "").padEnd(64, "0").slice(0, 64)}`;
  const verificationTimestamp = new Date().toISOString();
  const updatedPayment = await setPaymentStatus(paymentId, "paid", {
    tempoTxHash: txHash,
    verificationTimestamp,
    statusMessage: "Payment verified on mock Tempo.",
  });

  if (!updatedPayment) {
    throw new Error("Failed to update payment session.");
  }

  await setInvocationStatus(payment.invocationId, "paid");
  return updatedPayment;
}

export async function markPaymentFromReceipt(
  paymentId: string,
  receipt: PaymentSession["receiptPayload"],
) {
  const payment = await getPaymentSession(paymentId);
  if (!payment) {
    throw new Error("Payment session not found.");
  }

  const updated = await setPaymentStatus(paymentId, "paid", {
    tempoTxHash: receipt?.reference,
    receiptPayload: receipt,
    verificationTimestamp: receipt?.timestamp ?? new Date().toISOString(),
    statusMessage: "Payment verified via MPP receipt.",
  });

  if (!updated) {
    throw new Error("Failed to update payment session from receipt.");
  }

  await setInvocationStatus(payment.invocationId, "paid");
  return updated;
}

export async function getPaymentStatus(paymentId: string) {
  return refreshPaymentStatus(paymentId);
}

export function getPaymentProviderLabel() {
  return appEnv.provider === "mock" ? "Mock Tempo" : "Stripe MPP";
}
