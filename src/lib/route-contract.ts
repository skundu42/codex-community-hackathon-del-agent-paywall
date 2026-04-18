import { getTempoTokenContract } from "@/lib/payment-provider";
import type { ApiRoute, PublicApiRoute } from "@/lib/types";

export const TEMPO_TESTNET_CHAIN_ID = 42431;
export const TEMPO_TESTNET_RPC_URL = "https://rpc.moderato.tempo.xyz";
export const TEMPO_EXPLORER_BASE_URL = "https://explore.testnet.tempo.xyz";

export function buildGatewayUrl(origin: string, slug: string) {
  return `${origin}/api/mpp/routes/${slug}/invoke`;
}

export function buildRouteContract(origin: string, route: ApiRoute | PublicApiRoute) {
  const gatewayUrl = buildGatewayUrl(origin, route.slug);
  const method = route.httpMethod ?? "POST";
  const canSendBody = method !== "GET";
  const sampleBody = JSON.stringify(
    {
      marketingCopy:
        "Turn premium APIs into pay-per-call products with Tempo machine payments.",
    },
    null,
    2,
  );
  const compactBody = sampleBody.replace(/\n/g, "");
  const bodySegment = canSendBody ? ` -H 'Content-Type: application/json' -d '${compactBody}'` : "";

  return {
    gatewayUrl,
    payment: {
      method: "tempo",
      network: "Tempo Testnet (Moderato)",
      chainId: TEMPO_TESTNET_CHAIN_ID,
      currencyContract: getTempoTokenContract(),
      explorerBaseUrl: TEMPO_EXPLORER_BASE_URL,
      rpcUrl: TEMPO_TESTNET_RPC_URL,
    },
    examples: {
      curl: `curl -X ${method} ${gatewayUrl}${bodySegment}`,
      mppx: `npx mppx ${gatewayUrl} -X ${method}${bodySegment}`,
      sampleBody,
    },
  };
}
