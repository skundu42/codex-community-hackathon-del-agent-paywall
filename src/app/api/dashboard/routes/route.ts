import { randomUUID } from "node:crypto";

import { getAuthenticatedProviderFromRequest } from "@/lib/auth";
import { toPublicRoute, validateRouteInput } from "@/lib/gateway";
import { buildRouteContract } from "@/lib/route-contract";
import { createRoute, listRoutesForProvider } from "@/lib/store";

export async function GET(request: Request) {
  const provider = await getAuthenticatedProviderFromRequest(request);
  if (!provider) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(request.url);
  const routes = await listRoutesForProvider(provider.id);

  return Response.json({
    provider: {
      id: provider.id,
      providerName: provider.providerName,
      email: provider.email,
      walletAddress: provider.walletAddress,
    },
    routes: routes.map((route) => ({
      route: toPublicRoute(route),
      ...buildRouteContract(url.origin, route),
    })),
  });
}

export async function POST(request: Request) {
  try {
    const provider = await getAuthenticatedProviderFromRequest(request);
    if (!provider) {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }

    const body = (await request.json()) as {
      routeName?: string;
      slug?: string;
      description?: string;
      upstreamUrl?: string;
      httpMethod?: string;
      priceAmount?: string;
      authHeaderName?: string;
      authHeaderValue?: string;
    };

    const validated = await validateRouteInput({
      providerName: provider.providerName,
      routeName: body.routeName ?? "",
      slug: body.slug,
      description: body.description,
      routeKind: "external_proxy",
      upstreamUrl: body.upstreamUrl,
      httpMethod: body.httpMethod as never,
      priceAmount: body.priceAmount ?? "",
      authHeaderName: body.authHeaderName,
      authHeaderValue: body.authHeaderValue,
    });

    const route = await createRoute({
      id: randomUUID(),
      providerId: provider.id,
      slug: validated.slug,
      routeKind: validated.routeKind,
      providerName: provider.providerName,
      routeName: validated.routeName,
      description: validated.description,
      upstreamUrl: validated.upstreamUrl,
      httpMethod: validated.httpMethod,
      priceAmount: validated.priceAmount,
      currency: validated.currency,
      authHeaderName: validated.authHeaderName,
      authHeaderValue: validated.authHeaderValue,
      status: "active",
      featured: false,
    });

    const url = new URL(request.url);
    return Response.json(
      {
        route: toPublicRoute(route),
        ...buildRouteContract(url.origin, route),
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create dashboard route.";
    const status = /duplicate|unique/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}
