import crypto from "node:crypto";

import { Credential, Receipt } from "mppx";

import { appEnv } from "@/lib/env";
import { executeInvocationById } from "@/lib/execution";
import { getMppReplayStore } from "@/lib/mpp-replay-store";
import { getTempoTokenContract } from "@/lib/payment-provider";
import {
  createInvocation,
  createInvocationRecord,
  createPaymentSession,
  createPaymentSessionRecord,
  findInvocationByRouteAndIdempotencyKey,
  getInvocationBundle,
  getPaymentSessionForInvocation,
  getProvider,
  setInvocationStatus,
  setPaymentStatus,
  updateInvocation,
} from "@/lib/store";
import type { ApiRoute, JsonValue, PaymentReceiptPayload, PaymentSession } from "@/lib/types";

function getMppSecretKey() {
  if (appEnv.mppSecretKey) {
    return appEnv.mppSecretKey;
  }

  const runtime = globalThis as typeof globalThis & {
    __agentPaywallMppSecretKey?: string;
  };

  if (!runtime.__agentPaywallMppSecretKey) {
    runtime.__agentPaywallMppSecretKey = crypto.randomBytes(32).toString("base64");
  }

  return runtime.__agentPaywallMppSecretKey;
}

function responseWithStoredReceipt(response: Response, receipt: Receipt.Receipt) {
  response.headers.set("Payment-Receipt", Receipt.serialize(receipt));
  return response;
}

async function getRouteRecipientAddress(route: ApiRoute) {
  if (!route.providerId) {
    throw new Error("This route is missing a provider owner and cannot accept Tempo payments.");
  }

  const provider = await getProvider(route.providerId);
  if (!provider) {
    throw new Error("The seller account for this route no longer exists.");
  }

  return provider.walletAddress as `0x${string}`;
}

async function getOrCreateAgentInvocation(options: {
  route: ApiRoute;
  requestBody?: JsonValue;
  idempotencyKey?: string;
}) {
  if (options.idempotencyKey) {
    const existing = await findInvocationByRouteAndIdempotencyKey(
      options.route.id,
      options.idempotencyKey,
    );
    if (existing) {
      return existing;
    }
  }

  return createInvocation(
    createInvocationRecord({
      routeId: options.route.id,
      callerMode: "agent",
      requestBody: options.requestBody,
      priceAmount: options.route.priceAmount,
      status: "created",
      idempotencyKey: options.idempotencyKey,
    }),
  );
}

async function ensureTempoPaymentSession(invocationId: string, route: ApiRoute) {
  const existing = await getPaymentSessionForInvocation(invocationId);
  if (existing && existing.status !== "expired" && existing.status !== "failed") {
    return existing;
  }

  const recipient = await getRouteRecipientAddress(route);
  const payment = await createPaymentSession(
    createPaymentSessionRecord({
      invocationId,
      provider: appEnv.provider === "mock" ? "mock" : "tempo_testnet",
      amount: route.priceAmount,
      payToAddress: recipient,
      supportedTokenContract: getTempoTokenContract(),
      statusMessage: "Waiting for a Tempo testnet payment credential.",
    }),
  );

  await updateInvocation(invocationId, {
    paymentSessionId: payment.id,
    status: "awaiting_payment",
  });

  return payment;
}

async function markVerifiedPayment(payment: PaymentSession, receipt: PaymentReceiptPayload) {
  const updatedPayment = await setPaymentStatus(payment.id, "paid", {
    receiptPayload: receipt,
    tempoTxHash: receipt.reference,
    verificationTimestamp: new Date().toISOString(),
    statusMessage: "Tempo payment verified.",
  });

  if (!updatedPayment) {
    throw new Error("Failed to save the verified payment receipt.");
  }

  const updatedInvocation = await updateInvocation(payment.invocationId, {
    status: "paid",
    transactionReference: receipt.reference,
  });

  if (!updatedInvocation) {
    throw new Error("Failed to mark the invocation as paid.");
  }

  return updatedPayment;
}

function createMockChallenge(payload: { invocationId: string; route: ApiRoute; recipient: string }) {
  return Response.json(
    {
      error: "Payment required.",
      provider: "mock",
      invocationId: payload.invocationId,
      amount: payload.route.priceAmount,
      currency: payload.route.currency,
      recipient: payload.recipient,
      paymentMethod: "tempo",
      network: {
        name: "Tempo Testnet (Moderato)",
        chainId: 42431,
        currencyContract: getTempoTokenContract(),
      },
      hint: "Retry this request with header x-mock-payment: paid to simulate a settled Tempo payment in local development.",
    },
    { status: 402 },
  );
}

async function handleMockProtectedExecution(options: {
  request: Request;
  route: ApiRoute;
  requestBody?: JsonValue;
}) {
  const idempotencyKey = options.request.headers.get("idempotency-key") ?? undefined;
  const mockPayment = options.request.headers.get("x-mock-payment");
  const invocationId = options.request.headers.get("x-invocation-id") ?? undefined;

  let bundle =
    invocationId ? await getInvocationBundle(invocationId) : undefined;

  if (bundle && bundle.route.id !== options.route.id) {
    bundle = undefined;
  }

  if (!bundle) {
    const invocation = await getOrCreateAgentInvocation({
      route: options.route,
      requestBody: options.requestBody,
      idempotencyKey,
    });
    const payment = await ensureTempoPaymentSession(invocation.id, options.route);
    bundle = {
      invocation,
      route: options.route,
      payment,
    };
  }

  if (!bundle.payment) {
    throw new Error("Payment session was not created.");
  }

  if (bundle.invocation.resultPayload && bundle.payment.receiptPayload) {
    return responseWithStoredReceipt(
      Response.json({
        resourceId: options.route.slug,
        invocationId: bundle.invocation.id,
        result: bundle.invocation.resultPayload,
        provider: "mock",
      }),
      bundle.payment.receiptPayload,
    );
  }

  if (mockPayment !== "paid") {
    return createMockChallenge({
      invocationId: bundle.invocation.id,
      route: options.route,
      recipient: bundle.payment.payToAddress ?? "unknown",
    });
  }

  const receipt: PaymentReceiptPayload = {
    method: "tempo",
    reference: `0x${crypto.randomUUID().replaceAll("-", "").padEnd(64, "0").slice(0, 64)}`,
    status: "success",
    timestamp: new Date().toISOString(),
    externalId: bundle.invocation.id,
  };

  await markVerifiedPayment(bundle.payment, receipt);
  const execution = await executeInvocationById(bundle.invocation.id);
  return responseWithStoredReceipt(
    Response.json({
      resourceId: options.route.slug,
      invocationId: bundle.invocation.id,
      result: execution.result,
      provider: "mock",
    }),
    receipt,
  );
}

async function createTempoServer(recipient: `0x${string}`) {
  const { Mppx, tempo } = await import("mppx/server");
  return Mppx.create({
    methods: [
      tempo.charge({
        currency: getTempoTokenContract(),
        recipient,
        testnet: true,
        store: getMppReplayStore(),
      }),
    ],
    secretKey: getMppSecretKey(),
  });
}

async function handleTempoCredentialExecution(options: {
  request: Request;
  route: ApiRoute;
  requestBody?: JsonValue;
}) {
  const credential = Credential.fromRequest(options.request);
  const invocationId = (credential.challenge.request as { externalId?: string }).externalId;

  if (!invocationId) {
    return Response.json(
      { error: "Missing invocation reference in payment credential." },
      { status: 400 },
    );
  }

  const bundle = await getInvocationBundle(invocationId);
  if (!bundle || bundle.route.id !== options.route.id) {
    return Response.json(
      { error: "Payment credential does not match this paid endpoint." },
      { status: 400 },
    );
  }

  const payment = bundle.payment ?? (await ensureTempoPaymentSession(bundle.invocation.id, options.route));

  if (bundle.invocation.resultPayload && payment.receiptPayload) {
    return responseWithStoredReceipt(
      Response.json({
        resourceId: options.route.slug,
        invocationId: bundle.invocation.id,
        result: bundle.invocation.resultPayload,
        provider: "tempo_testnet",
      }),
      payment.receiptPayload,
    );
  }

  const recipient = payment.payToAddress as `0x${string}` | undefined;
  if (!recipient) {
    return Response.json(
      { error: "Payment session recipient is missing." },
      { status: 500 },
    );
  }

  const mppx = await createTempoServer(recipient);
  const charge = await mppx
    .charge({
      amount: options.route.priceAmount,
      externalId: bundle.invocation.id,
      description: `${options.route.routeName} via AgentPaywall`,
    })(options.request);

  if (charge.status === 402) {
    return charge.challenge;
  }

  const receipt = Receipt.fromResponse(
    charge.withReceipt(new Response(null, { status: 204 })),
  );
  await markVerifiedPayment(payment, receipt);
  const execution = await executeInvocationById(bundle.invocation.id);
  return charge.withReceipt(
    Response.json({
      resourceId: options.route.slug,
      invocationId: bundle.invocation.id,
      result: execution.result,
      provider: "tempo_testnet",
    }),
  );
}

async function handleTempoChallenge(options: {
  request: Request;
  route: ApiRoute;
  requestBody?: JsonValue;
}) {
  const idempotencyKey = options.request.headers.get("idempotency-key") ?? undefined;
  const invocation = await getOrCreateAgentInvocation({
    route: options.route,
    requestBody: options.requestBody,
    idempotencyKey,
  });
  const payment = await ensureTempoPaymentSession(invocation.id, options.route);
  const recipient = payment.payToAddress as `0x${string}` | undefined;

  if (!recipient) {
    return Response.json(
      { error: "Payment session recipient is missing." },
      { status: 500 },
    );
  }

  await setInvocationStatus(invocation.id, "awaiting_payment");

  const mppx = await createTempoServer(recipient);
  const charge = await mppx
    .charge({
      amount: options.route.priceAmount,
      externalId: invocation.id,
      description: `${options.route.routeName} via AgentPaywall`,
    })(options.request);

  return charge.status === 402 ? charge.challenge : Response.json({});
}

export async function handleMppProtectedExecution({
  request,
  route,
  requestBody,
}: {
  request: Request;
  route: ApiRoute;
  requestBody?: JsonValue;
}) {
  if (appEnv.provider === "mock") {
    return handleMockProtectedExecution({ request, route, requestBody });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader && Credential.extractPaymentScheme(authHeader)) {
    return handleTempoCredentialExecution({ request, route, requestBody });
  }

  return handleTempoChallenge({ request, route, requestBody });
}
