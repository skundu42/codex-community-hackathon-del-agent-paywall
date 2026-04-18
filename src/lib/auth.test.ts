import assert from "node:assert/strict";
import test from "node:test";

import {
  authenticateProviderAccount,
  createProviderAuthSession,
  getAuthenticatedProviderFromRequest,
  registerProviderAccount,
} from "@/lib/auth";
import { resetStoreForTests } from "@/lib/store";

test.beforeEach(async () => {
  await resetStoreForTests();
});

test("provider registration hashes the password and authenticates a seller", async () => {
  const provider = await registerProviderAccount({
    providerName: "Tempo Seller",
    email: "seller@example.com",
    password: "tempo-testnet",
    walletAddress: "0x1111111111111111111111111111111111111111",
  });

  assert.notEqual(provider.passwordHash, "tempo-testnet");

  const authenticated = await authenticateProviderAccount({
    email: "seller@example.com",
    password: "tempo-testnet",
  });

  assert.equal(authenticated.id, provider.id);
});

test("provider session resolves from the cookie-backed request", async () => {
  const provider = await registerProviderAccount({
    providerName: "Proxy Seller",
    email: "proxy@example.com",
    password: "tempo-testnet",
    walletAddress: "0x2222222222222222222222222222222222222222",
  });

  const { sessionToken } = await createProviderAuthSession(provider.id);
  const request = new Request("https://example.com/dashboard", {
    headers: {
      cookie: `agentpaywall_session=${sessionToken}`,
    },
  });

  const authenticated = await getAuthenticatedProviderFromRequest(request);
  assert.equal(authenticated?.id, provider.id);
});
