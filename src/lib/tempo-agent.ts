import { randomUUID } from "node:crypto";

import { Receipt } from "mppx";
import { Mppx, tempo as tempoClient } from "mppx/client";
import { createClient, formatUnits, http, parseUnits, type Address } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { tempoModerato } from "viem/chains";
import { Actions } from "viem/tempo";

import { hashPassword } from "@/lib/auth";
import { getTempoTokenContract } from "@/lib/payment-provider";
import { buildGatewayUrl, TEMPO_TESTNET_RPC_URL } from "@/lib/route-contract";
import { getExplorerTransactionUrl } from "@/lib/tempo";
import {
  createProvider,
  getProviderByEmail,
  getRouteBySlug,
  updateProvider,
} from "@/lib/store";
import type { ApiInvocationResult, Provider } from "@/lib/types";

const DEMO_PROVIDER_EMAIL = "tempo-demo@agentpaywall.local";
const DEMO_PROVIDER_NAME = "Tempo Demo Seller";
const DEMO_PROVIDER_PASSWORD = "tempo-demo-seller";
export const AGENT_FUND_AMOUNT = "0.10";

type DemoAgentRecord = {
  id: string;
  routeSlug: string;
  privateKey: `0x${string}`;
  address: Address;
  lastFundingTxHash?: string;
  lastPaymentReference?: string;
  createdAt: string;
  updatedAt: string;
};

type RuntimeStore = {
  agents: Map<string, DemoAgentRecord>;
  tokenDecimals?: number;
  tokenSymbol?: string;
  treasuryPrivateKey?: `0x${string}`;
};

function getRuntimeStore() {
  const globalStore = globalThis as typeof globalThis & {
    __agentPaywallTempoRuntime?: RuntimeStore;
  };

  if (!globalStore.__agentPaywallTempoRuntime) {
    globalStore.__agentPaywallTempoRuntime = {
      agents: new Map<string, DemoAgentRecord>(),
    };
  }

  return globalStore.__agentPaywallTempoRuntime;
}

function now() {
  return new Date().toISOString();
}

function createTempoClient(account?: ReturnType<typeof privateKeyToAccount>) {
  return createClient({
    ...(account ? { account } : {}),
    chain: tempoModerato,
    transport: http(TEMPO_TESTNET_RPC_URL),
  });
}

async function getTokenMetadata() {
  const runtime = getRuntimeStore();
  if (runtime.tokenDecimals !== undefined && runtime.tokenSymbol) {
    return {
      decimals: runtime.tokenDecimals,
      symbol: runtime.tokenSymbol,
    };
  }

  const metadata = await Actions.token.getMetadata(createTempoClient(), {
    token: getTempoTokenContract(),
  });

  runtime.tokenDecimals = metadata.decimals;
  runtime.tokenSymbol = metadata.symbol;

  return {
    decimals: metadata.decimals,
    symbol: metadata.symbol,
  };
}

async function getBalanceForAddress(address: Address) {
  const metadata = await getTokenMetadata();
  const raw = await Actions.token.getBalance(createTempoClient(), {
    account: address,
    token: getTempoTokenContract(),
  });

  return {
    raw,
    decimals: metadata.decimals,
    symbol: metadata.symbol,
    formatted: formatUnits(raw, metadata.decimals),
  };
}

async function getOrCreateTreasuryAccount() {
  const runtime = getRuntimeStore();
  if (!runtime.treasuryPrivateKey) {
    runtime.treasuryPrivateKey = generatePrivateKey();
  }

  return privateKeyToAccount(runtime.treasuryPrivateKey);
}

export async function ensureDemoProviderWallet() {
  const treasury = await getOrCreateTreasuryAccount();
  const existing = await getProviderByEmail(DEMO_PROVIDER_EMAIL);

  if (!existing) {
    return createProvider({
      id: randomUUID(),
      providerName: DEMO_PROVIDER_NAME,
      email: DEMO_PROVIDER_EMAIL,
      passwordHash: await hashPassword(DEMO_PROVIDER_PASSWORD),
      walletAddress: treasury.address,
    });
  }

  if (existing.walletAddress === treasury.address) {
    return existing;
  }

  const updated = await updateProvider(existing.id, {
    walletAddress: treasury.address,
  });

  if (!updated) {
    throw new Error("Unable to update the demo seller wallet.");
  }

  return updated;
}

function serializeAgentRecord(record: DemoAgentRecord, balance: Awaited<ReturnType<typeof getBalanceForAddress>>) {
  return {
    id: record.id,
    address: record.address,
    routeSlug: record.routeSlug,
    balance: {
      raw: balance.raw.toString(),
      formatted: balance.formatted,
      symbol: balance.symbol,
    },
    lastFundingTxHash: record.lastFundingTxHash,
    lastFundingExplorerUrl: getExplorerTransactionUrl(record.lastFundingTxHash),
    lastPaymentReference: record.lastPaymentReference,
    lastPaymentExplorerUrl: getExplorerTransactionUrl(record.lastPaymentReference),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function hydrateAgent(record: DemoAgentRecord) {
  return serializeAgentRecord(record, await getBalanceForAddress(record.address));
}

export async function createDemoAgent(routeSlug: string) {
  const route = await getRouteBySlug(routeSlug);
  if (!route) {
    throw new Error("Route not found.");
  }

  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  const timestamp = now();
  const record: DemoAgentRecord = {
    id: randomUUID(),
    routeSlug,
    privateKey,
    address: account.address,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  getRuntimeStore().agents.set(record.id, record);
  return hydrateAgent(record);
}

function getAgentRecord(agentId: string, routeSlug: string) {
  const record = getRuntimeStore().agents.get(agentId);
  if (!record || record.routeSlug !== routeSlug) {
    throw new Error("Agent not found for this endpoint.");
  }

  return record;
}

async function ensureTreasuryCanFund(minimumAmount: bigint) {
  const treasury = await getOrCreateTreasuryAccount();
  const currentBalance = await getBalanceForAddress(treasury.address);

  if (currentBalance.raw >= minimumAmount) {
    return treasury;
  }

  await Actions.faucet.fundSync(createTempoClient(), {
    account: treasury.address,
  });

  return treasury;
}

export async function fundDemoAgent(agentId: string, routeSlug: string) {
  const record = getAgentRecord(agentId, routeSlug);
  const metadata = await getTokenMetadata();
  const desiredFunding = parseUnits(AGENT_FUND_AMOUNT, metadata.decimals);
  const currentBalance = await getBalanceForAddress(record.address);

  if (currentBalance.raw >= desiredFunding) {
    return hydrateAgent(record);
  }

  const treasury = await ensureTreasuryCanFund(desiredFunding);
  const transfer = await Actions.token.transferSync(createTempoClient(treasury), {
    account: treasury,
    amount: desiredFunding,
    to: record.address,
    token: getTempoTokenContract(),
  });

  record.lastFundingTxHash = transfer.receipt.transactionHash;
  record.updatedAt = now();

  return hydrateAgent(record);
}

export async function invokeRouteAsDemoAgent(options: {
  agentId: string;
  requestBody?: Record<string, unknown>;
  requestUrl: string;
  routeSlug: string;
}) {
  const route = await getRouteBySlug(options.routeSlug);
  if (!route) {
    throw new Error("Route not found.");
  }

  const record = getAgentRecord(options.agentId, options.routeSlug);
  const account = privateKeyToAccount(record.privateKey);
  const mppx = Mppx.create({
    methods: [
      tempoClient({
        account,
        getClient: () => createTempoClient(account),
      }),
    ],
    polyfill: false,
  });

  const origin = new URL(options.requestUrl).origin;
  const gatewayUrl = buildGatewayUrl(origin, route.slug);
  const bodyless = route.httpMethod === "GET";
  const response = await mppx.fetch(gatewayUrl, {
    method: route.httpMethod ?? "POST",
    headers: bodyless
      ? undefined
      : {
          "Content-Type": "application/json",
        },
    body: bodyless ? undefined : JSON.stringify(options.requestBody ?? {}),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    const message = errorBody.trim() || `Paid invocation failed with status ${response.status}.`;
    throw new Error(message);
  }

  const receipt = Receipt.fromResponse(response);
  const payload = (await response.json()) as {
    invocationId: string;
    result: ApiInvocationResult;
  };

  record.lastPaymentReference = receipt.reference;
  record.updatedAt = now();

  return {
    agent: await hydrateAgent(record),
    invocationId: payload.invocationId,
    paymentReference: receipt.reference,
    paymentExplorerUrl: getExplorerTransactionUrl(receipt.reference),
    result: payload.result,
  };
}

export async function getDemoProviderForRouteCreation(): Promise<Provider> {
  return ensureDemoProviderWallet();
}
