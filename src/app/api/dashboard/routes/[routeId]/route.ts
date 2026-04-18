import { getAuthenticatedProviderFromRequest } from "@/lib/auth";
import { getExplorerTransactionUrl } from "@/lib/tempo";
import { toPublicRoute } from "@/lib/gateway";
import { buildRouteContract } from "@/lib/route-contract";
import {
  getInvocationBundle,
  getRouteForProvider,
  listInvocationsForRoute,
} from "@/lib/store";

export async function GET(
  request: Request,
  context: { params: Promise<{ routeId: string }> },
) {
  const provider = await getAuthenticatedProviderFromRequest(request);
  if (!provider) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { routeId } = await context.params;
  const route = await getRouteForProvider(routeId, provider.id);
  if (!route) {
    return Response.json({ error: "Route not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const invocations = await listInvocationsForRoute(route.id, 12);
  const invocationDetails = await Promise.all(
    invocations.map(async (invocation) => {
      const bundle = await getInvocationBundle(invocation.id);
      return {
        invocation,
        payment: bundle?.payment,
        explorerUrl: getExplorerTransactionUrl(
          invocation.transactionReference ?? bundle?.payment?.tempoTxHash,
        ),
      };
    }),
  );

  return Response.json({
    route: toPublicRoute(route),
    discoveryUrl: `${url.origin}/api/routes/${route.slug}`,
    providerWallet: provider.walletAddress,
    ...buildRouteContract(url.origin, route),
    invocations: invocationDetails,
  });
}
