import { getTempoTokenContract } from "@/lib/payment-provider";
import type { ApiRoute, PublicApiRoute } from "@/lib/types";

export const TEMPO_TESTNET_CHAIN_ID = 42431;
export const TEMPO_TESTNET_RPC_URL = "https://rpc.moderato.tempo.xyz";
export const TEMPO_EXPLORER_BASE_URL = "https://explore.tempo.xyz";

export function buildGatewayUrl(origin: string, slug: string) {
  return `${origin}/api/mpp/routes/${slug}/invoke`;
}

export function buildRouteContract(origin: string, route: ApiRoute | PublicApiRoute) {
  const gatewayUrl = buildGatewayUrl(origin, route.slug);
  const sampleBody = JSON.stringify(
    {
      prompt: "Summarize the latest billing event",
    },
    null,
    2,
  );

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
      curl: `curl -X POST ${gatewayUrl} -H 'Content-Type: application/json' -d '${sampleBody.replace(/\n/g, "")}'`,
      mppx: `npx mppx ${gatewayUrl} -X POST -H 'Content-Type: application/json' -d '${sampleBody.replace(/\n/g, "")}'`,
      sampleBody,
    },
  };
}
