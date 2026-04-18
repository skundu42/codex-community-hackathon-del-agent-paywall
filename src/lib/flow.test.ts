import assert from "node:assert/strict";
import test from "node:test";

import { executeInvocationById } from "@/lib/execution";
import { validateLandingPageRoastInput } from "@/lib/gateway";
import { createOrGetPaymentSession, refreshPaymentStatus, simulatePayment } from "@/lib/payment-provider";
import {
  createInvocation,
  createInvocationRecord,
  getFeaturedRoute,
  getInvocation,
  resetStoreForTests,
  updatePaymentSession,
} from "@/lib/store";

test.beforeEach(async () => {
  await resetStoreForTests();
});

test("mock browser flow executes exactly once and returns the saved result on repeat", async () => {
  const route = await getFeaturedRoute();
  assert.ok(route);

  const invocation = await createInvocation(
    createInvocationRecord({
      routeId: route!.id,
      callerMode: "browser",
      requestBody: validateLandingPageRoastInput({
        url: "https://example.com",
        brandName: "AgentPaywall",
        targetAudience: "Hackathon judges",
      } as never) as never,
      priceAmount: route!.priceAmount,
      status: "created",
    }),
  );

  const payment = await createOrGetPaymentSession(invocation.id);
  assert.equal(payment.status, "pending");

  const verified = await simulatePayment(payment.id);
  assert.equal(verified.status, "paid");

  const first = await executeInvocationById(invocation.id);
  const second = await executeInvocationById(invocation.id);

  assert.equal(first.invocation.id, second.invocation.id);
  assert.deepEqual(second.result, second.invocation.resultPayload);
  assert.equal(first.invocation.status, "completed");
  assert.equal(second.invocation.status, "completed");
});

test("unpaid invocation remains locked", async () => {
  const route = await getFeaturedRoute();
  assert.ok(route);

  const invocation = await createInvocation(
    createInvocationRecord({
      routeId: route!.id,
      callerMode: "browser",
      requestBody: validateLandingPageRoastInput({
        marketingCopy: "Ship the API, charge on demand, unlock after payment.",
      } as never) as never,
      priceAmount: route!.priceAmount,
      status: "created",
    }),
  );

  await createOrGetPaymentSession(invocation.id);

  await assert.rejects(
    () => executeInvocationById(invocation.id),
    /Payment must be verified before execution/,
  );
});

test("expired pending payments are marked as expired and fail the invocation", async () => {
  const route = await getFeaturedRoute();
  assert.ok(route);

  const invocation = await createInvocation(
    createInvocationRecord({
      routeId: route!.id,
      callerMode: "browser",
      requestBody: validateLandingPageRoastInput({
        marketingCopy: "Charge per call with Tempo and MPP.",
      } as never) as never,
      priceAmount: route!.priceAmount,
      status: "created",
    }),
  );

  const payment = await createOrGetPaymentSession(invocation.id);
  await updatePaymentSession(payment.id, {
    expiresAt: new Date(Date.now() - 5_000).toISOString(),
  });

  const expired = await refreshPaymentStatus(payment.id);
  const refreshedInvocation = await getInvocation(invocation.id);

  assert.equal(expired.status, "expired");
  assert.equal(refreshedInvocation?.status, "failed");
});
