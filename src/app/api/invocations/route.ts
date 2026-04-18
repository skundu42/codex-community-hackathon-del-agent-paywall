import { randomUUID } from "node:crypto";

import { createInvocation, getRoute } from "@/lib/store";
import { validateInvocationInput } from "@/lib/gateway";
import type { InvocationInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const input = validateInvocationInput((await request.json()) as InvocationInput);
    const route = getRoute(input.routeId);

    if (!route) {
      return Response.json({ error: "Route not found." }, { status: 404 });
    }

    const invocation = createInvocation({
      id: randomUUID(),
      routeId: route.id,
      requestBody: input.requestBody,
      status: "created",
      priceAmount: route.priceAmount,
      currency: route.currency,
    });

    return Response.json({ invocation, route });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to create invocation.",
      },
      { status: 400 },
    );
  }
}
