import crypto from "node:crypto";

import Stripe from "stripe";

import { appEnv } from "@/lib/env";
import type { JsonValue } from "@/lib/types";

const TEMPO_TESTNET_PATH_USD = "0x20c0000000000000000000000000000000000000";
const TEMPO_MAINNET_USDC = "0x20c000000000000000000000b9537d11c60e8b50";
const DEPOSIT_TTL_MS = 5 * 60 * 1000;

const depositCache = new Map<
  string,
  { expiresAt: number; paymentIntentId: string; resourceId: string }
>();

function getStripeClient() {
  if (!appEnv.stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY is required for Stripe MPP mode.");
  }

  return new Stripe(appEnv.stripeSecretKey, {
    apiVersion: "2026-03-04.preview" as any,
  });
}

function getMppSecretKey() {
  return (
    appEnv.mppSecretKey ??
    crypto.randomBytes(32).toString("base64")
  );
}

function getTempoTokenContract() {
  return process.env.NODE_ENV === "production"
    ? TEMPO_MAINNET_USDC
    : TEMPO_TESTNET_PATH_USD;
}

function pruneDeposits() {
  const current = Date.now();

  for (const [address, metadata] of depositCache.entries()) {
    if (metadata.expiresAt <= current) {
      depositCache.delete(address);
    }
  }
}

async function createPayToAddress(
  request: Request,
  resourceId: string,
  amount: string,
  metadata: Record<string, string>,
) {
  pruneDeposits();

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const { Credential } = (await import("mppx")) as unknown as {
      Credential: {
        extractPaymentScheme(value: string): string | null;
        fromRequest(req: Request): {
          challenge: {
            request: {
              recipient?: `0x${string}`;
            };
          };
        };
      };
    };

    if (Credential.extractPaymentScheme(authHeader)) {
      const credential = Credential.fromRequest(request);
      const payToAddress = credential.challenge.request.recipient;

      if (!payToAddress) {
        throw new Error("Missing pay-to address in MPP credential.");
      }

      const cached = depositCache.get(payToAddress);
      if (!cached || cached.resourceId !== resourceId) {
        throw new Error("Pay-to address is unknown or expired.");
      }

      return payToAddress;
    }
  }

  const stripe = getStripeClient();
  const amountInCents = Math.round(Number(amount) * 100);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: "usd",
    confirm: true,
    metadata: {
      resourceId,
      ...metadata,
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
      },
    },
  } as Stripe.PaymentIntentCreateParams);

  const depositDetails = (
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

  const payToAddress = depositDetails?.deposit_addresses?.tempo?.address;

  if (!payToAddress) {
    throw new Error("PaymentIntent did not include Tempo deposit details.");
  }

  depositCache.set(payToAddress, {
    expiresAt: Date.now() + DEPOSIT_TTL_MS,
    paymentIntentId: paymentIntent.id,
    resourceId,
  });

  return payToAddress;
}

export async function handleMppProtectedExecution({
  request,
  resourceId,
  amount,
  metadata,
  execute,
}: {
  request: Request;
  resourceId: string;
  amount: string;
  metadata: Record<string, string>;
  execute: () => Promise<JsonValue | Record<string, unknown>>;
}) {
  if (appEnv.provider !== "stripe_mpp") {
    return Response.json(
      {
        error:
          "Real MPP execution is disabled. Set PAYMENTS_PROVIDER=stripe_mpp to enable this route.",
      },
      { status: 503 },
    );
  }

  const { Mppx, tempo } = (await import("mppx/server")) as unknown as {
    Mppx: {
      create(config: {
        methods: unknown[];
        secretKey: string;
      }): {
        charge(config: {
          amount: string;
          recipient: `0x${string}`;
        }): (incomingRequest: Request) => Promise<{
          status: number;
          challenge: Response;
          withReceipt(response: Response): Response;
        }>;
      };
    };
    tempo: {
      charge(config: {
        currency: string;
        recipient: `0x${string}`;
        testnet?: boolean;
      }): unknown;
    };
  };

  const recipient = await createPayToAddress(request, resourceId, amount, metadata);
  const mppx = Mppx.create({
    methods: [
      tempo.charge({
        currency: getTempoTokenContract(),
        recipient,
        testnet: process.env.NODE_ENV !== "production",
      }),
    ],
    secretKey: getMppSecretKey(),
  });

  const charge = await mppx
    .charge({
      amount,
      recipient,
    })(request);

  if (charge.status === 402) {
    return charge.challenge;
  }
  const result = await execute();

  return charge.withReceipt(
    Response.json({
      resourceId,
      result,
      provider: "stripe_mpp",
    }),
  );
}
