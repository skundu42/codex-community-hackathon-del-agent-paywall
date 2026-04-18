import { randomUUID } from "node:crypto";

import { createSlug, toPublicRoute, validateRouteInput } from "@/lib/gateway";
import { enforceRateLimit, getClientIpAddress } from "@/lib/rate-limit";
import { buildRouteContract } from "@/lib/route-contract";
import { createRoute } from "@/lib/store";

function deriveRouteName(upstreamUrl: string) {
  const url = new URL(upstreamUrl);
  const hostname = url.hostname.replace(/^www\./, "");
  const path = url.pathname === "/" ? "" : url.pathname.replaceAll("/", " ").trim();
  return path ? `${hostname} ${path}` : hostname;
}

export async function POST(request: Request) {
  try {
    enforceRateLimit({
      key: `demo-route-create:${getClientIpAddress(request)}`,
      limit: 8,
      windowMs: 60_000,
    });

    const body = (await request.json()) as {
      upstreamUrl?: string;
      routeName?: string;
      httpMethod?: string;
    };

    const upstreamUrl = body.upstreamUrl?.trim() ?? "";
    const routeName = body.routeName?.trim() || deriveRouteName(upstreamUrl);
    const slugBase = createSlug(`paid-${routeName}`);
    const slug = `${slugBase}-${randomUUID().slice(0, 8)}`;

    const validated = await validateRouteInput({
      providerName: "AgentPaywall Demo",
      routeName,
      slug,
      description: `Paid proxy for ${upstreamUrl}`,
      routeKind: "external_proxy",
      upstreamUrl,
      httpMethod: (body.httpMethod?.toUpperCase() || "POST") as never,
      priceAmount: "0.02",
    });

    const route = await createRoute({
      id: randomUUID(),
      slug: validated.slug,
      routeKind: validated.routeKind,
      providerName: validated.providerName,
      routeName: validated.routeName,
      description: validated.description,
      upstreamUrl: validated.upstreamUrl,
      httpMethod: validated.httpMethod,
      priceAmount: validated.priceAmount,
      currency: validated.currency,
      authHeaderName: undefined,
      authHeaderValue: undefined,
      status: "active",
      featured: false,
    });

    const url = new URL(request.url);

    return Response.json(
      {
        route: toPublicRoute(route),
        upstreamUrl: route.upstreamUrl,
        ...buildRouteContract(url.origin, route),
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create a paid demo endpoint.";
    const status = /duplicate|unique/i.test(message) ? 409 : 400;
    return Response.json({ error: message }, { status });
  }
}
