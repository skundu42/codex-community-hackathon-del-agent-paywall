import assert from "node:assert/strict";
import test from "node:test";

import { handleMppProtectedExecution } from "@/lib/mpp";
import { createRoute, listRoutesForProvider, resetStoreForTests } from "@/lib/store";
import { registerProviderAccount } from "@/lib/auth";
import type { ApiRoute } from "@/lib/types";

test.beforeEach(async () => {
  await resetStoreForTests();
});

test("provider-owned routes stay isolated in the dashboard list", async () => {
  const sellerA = await registerProviderAccount({
    providerName: "Seller A",
    email: "a@example.com",
    password: "tempo-testnet",
    walletAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  const sellerB = await registerProviderAccount({
    providerName: "Seller B",
    email: "b@example.com",
    password: "tempo-testnet",
    walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });

  await createRoute({
    id: "route-a",
    providerId: sellerA.id,
    slug: "seller-a-route",
    routeKind: "external_proxy",
    providerName: sellerA.providerName,
    routeName: "Seller A Route",
    description: "A",
    upstreamUrl: "https://api.example.com/a",
    httpMethod: "POST",
    priceAmount: "0.02",
    currency: "USDC",
    status: "active",
    featured: false,
  });
  await createRoute({
    id: "route-b",
    providerId: sellerB.id,
    slug: "seller-b-route",
    routeKind: "external_proxy",
    providerName: sellerB.providerName,
    routeName: "Seller B Route",
    description: "B",
    upstreamUrl: "https://api.example.com/b",
    httpMethod: "POST",
    priceAmount: "0.03",
    currency: "USDC",
    status: "active",
    featured: false,
  });

  const sellerARoutes = await listRoutesForProvider(sellerA.id);
  assert.equal(sellerARoutes.length, 1);
  assert.equal(sellerARoutes[0]?.slug, "seller-a-route");
});

test("mock paid agent retry executes exactly once and returns a payment receipt", async () => {
  const provider = await registerProviderAccount({
    providerName: "Tempo Seller",
    email: "seller@example.com",
    password: "tempo-testnet",
    walletAddress: "0x3333333333333333333333333333333333333333",
  });

  const route: ApiRoute = await createRoute({
    id: "paid-route",
    providerId: provider.id,
    slug: "paid-proxy",
    routeKind: "external_proxy",
    providerName: provider.providerName,
    routeName: "Paid Proxy",
    description: "Test route",
    upstreamUrl: "https://api.example.com/paid",
    httpMethod: "POST",
    priceAmount: "0.02",
    currency: "USDC",
    authHeaderName: "x-api-key",
    authHeaderValue: "secret-value",
    status: "active",
    featured: false,
  });

  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async (input, init) => {
    upstreamCalls += 1;
    assert.equal(String(input), "https://api.example.com/paid");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("x-api-key"), "secret-value");
    return Response.json({ ok: true, echoed: init?.body ? JSON.parse(String(init.body)) : null });
  };

  try {
    const first = await handleMppProtectedExecution({
      request: new Request("https://example.com/api/mpp/routes/paid-proxy/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt: "hello" }),
      }),
      route,
      requestBody: { prompt: "hello" },
    });

    assert.equal(first.status, 402);
    assert.equal(upstreamCalls, 0);

    const challengeBody = (await first.json()) as { invocationId: string };
    assert.ok(challengeBody.invocationId);

    const paid = await handleMppProtectedExecution({
      request: new Request("https://example.com/api/mpp/routes/paid-proxy/invoke", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-mock-payment": "paid",
          "x-invocation-id": challengeBody.invocationId,
        },
        body: JSON.stringify({ prompt: "hello" }),
      }),
      route,
      requestBody: { prompt: "hello" },
    });

    assert.equal(paid.status, 200);
    assert.ok(paid.headers.get("Payment-Receipt"));
    assert.equal(upstreamCalls, 1);

    const repeated = await handleMppProtectedExecution({
      request: new Request("https://example.com/api/mpp/routes/paid-proxy/invoke", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-mock-payment": "paid",
          "x-invocation-id": challengeBody.invocationId,
        },
        body: JSON.stringify({ prompt: "hello" }),
      }),
      route,
      requestBody: { prompt: "hello" },
    });

    assert.equal(repeated.status, 200);
    assert.equal(upstreamCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
