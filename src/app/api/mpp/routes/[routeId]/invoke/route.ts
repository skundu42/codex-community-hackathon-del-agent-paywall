import { randomUUID } from "node:crypto";

import { proxyUpstreamRequest } from "@/lib/gateway";
import { handleMppProtectedExecution } from "@/lib/mpp";
import { attachInvocationResult, createInvocation, getRoute, setInvocationStatus } from "@/lib/store";
import type { JsonValue } from "@/lib/types";

async function parseJsonBody(request: Request): Promise<JsonValue | undefined> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return undefined;
  }

  return (await request.clone().json()) as JsonValue;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ routeId: string }> },
) {
  const { routeId } = await context.params;
  const route = getRoute(routeId);

  if (!route) {
    return Response.json({ error: "Route not found." }, { status: 404 });
  }

  const requestBody = await parseJsonBody(request);

  return handleMppProtectedExecution({
    request,
    resourceId: route.id,
    amount: route.priceAmount,
    metadata: {
      routeId: route.id,
      providerName: route.providerName,
      routeName: route.routeName,
    },
    execute: async () => {
      const invocationId = randomUUID();

      createInvocation({
        id: invocationId,
        routeId: route.id,
        requestBody,
        status: "processing",
        priceAmount: route.priceAmount,
        currency: route.currency,
      });

      const result = await proxyUpstreamRequest(route, requestBody);
      attachInvocationResult(invocationId, result);
      setInvocationStatus(invocationId, "completed");

      return {
        invocationId,
        routeId: route.id,
        ...result,
      };
    },
  });
}
