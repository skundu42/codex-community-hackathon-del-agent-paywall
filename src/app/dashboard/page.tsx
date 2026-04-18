import { headers } from "next/headers";

import { DashboardApp } from "@/components/dashboard-app";
import { getAuthenticatedProviderFromCookies, toPublicProvider } from "@/lib/auth";
import { appEnv } from "@/lib/env";
import { buildRouteContract } from "@/lib/route-contract";
import { listRoutesForProvider } from "@/lib/store";

export const dynamic = "force-dynamic";

async function getRequestOrigin() {
  if (appEnv.appBaseUrl) {
    return appEnv.appBaseUrl;
  }

  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "localhost:3000";
  const protocol =
    headerStore.get("x-forwarded-proto") ??
    (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");

  return `${protocol}://${host}`;
}

export default async function DashboardPage() {
  const provider = await getAuthenticatedProviderFromCookies();
  const origin = await getRequestOrigin();
  const routes = provider ? await listRoutesForProvider(provider.id) : [];

  return (
    <DashboardApp
      initialProvider={provider ? toPublicProvider(provider) : null}
      initialRoutes={routes.map((route) => ({
        route: {
          id: route.id,
          slug: route.slug,
          routeKind: route.routeKind,
          providerName: route.providerName,
          routeName: route.routeName,
          description: route.description,
          httpMethod: route.httpMethod,
          priceAmount: route.priceAmount,
          currency: route.currency,
          featured: route.featured,
          createdAt: route.createdAt,
          updatedAt: route.updatedAt,
        },
        ...buildRouteContract(origin, route),
      }))}
    />
  );
}
