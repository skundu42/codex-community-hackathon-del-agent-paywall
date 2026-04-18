import type { PaymentProvider } from "@/lib/types";

function getPaymentProvider(value: string | undefined): PaymentProvider {
  const provider = value ?? "mock";

  if (
    provider !== "mock" &&
    provider !== "tempo_testnet" &&
    provider !== "stripe_mpp"
  ) {
    throw new Error(`Unsupported PAYMENTS_PROVIDER: ${provider}`);
  }

  return provider;
}

const provider = getPaymentProvider(process.env.PAYMENTS_PROVIDER);

export const appEnv = {
  provider,
  publicProvider: getPaymentProvider(
    process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER ?? provider,
  ),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  mppSecretKey: process.env.MPP_SECRET_KEY,
  sessionSecret: process.env.SESSION_SECRET,
  databaseUrl: process.env.DATABASE_URL,
  appBaseUrl: process.env.APP_BASE_URL,
  adminToken: process.env.ADMIN_TOKEN,
  isProduction: process.env.NODE_ENV === "production",
};
