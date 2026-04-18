import { validateInvocationPayloadForRoute } from "@/lib/gateway";
import { createOrGetPaymentSession } from "@/lib/payment-provider";
import { enforceRateLimit, getClientIpAddress } from "@/lib/rate-limit";
import {
  createInvocation,
  createInvocationRecord,
  getRouteBySlug,
  getInvocationBundle,
} from "@/lib/store";
import type { JsonValue } from "@/lib/types";

async function parseJson(request: Request) {
  return (await request.json().catch(() => ({}))) as {
    requestBody?: JsonValue;
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const route = await getRouteBySlug(slug);

    if (!route) {
      return Response.json({ error: "Route not found." }, { status: 404 });
    }

    enforceRateLimit({
      key: `browser-invocation:${getClientIpAddress(request)}`,
      limit: 12,
      windowMs: 60_000,
    });

    const body = await parseJson(request);
    const requestBody = validateInvocationPayloadForRoute(route, body.requestBody);
    const invocation = await createInvocation(
      createInvocationRecord({
        routeId: route.id,
        callerMode: "browser",
        requestBody,
        priceAmount: route.priceAmount,
        status: "created",
      }),
    );

    const payment = await createOrGetPaymentSession(invocation.id);
    const bundle = await getInvocationBundle(invocation.id);

    return Response.json({
      route,
      invocation: bundle?.invocation ?? invocation,
      payment,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create invocation.",
      },
      { status: 400 },
    );
  }
}

