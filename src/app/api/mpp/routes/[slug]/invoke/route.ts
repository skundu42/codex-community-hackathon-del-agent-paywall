import { validateInvocationPayloadForRoute } from "@/lib/gateway";
import { handleMppProtectedExecution } from "@/lib/mpp";
import { enforceRateLimit, getClientIpAddress } from "@/lib/rate-limit";
import { getRouteBySlug } from "@/lib/store";
import type { JsonValue } from "@/lib/types";

async function parseJsonBody(request: Request): Promise<JsonValue | undefined> {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return undefined;
  }

  return (await request.clone().json()) as JsonValue;
}

async function handleInvocation(
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
      key: `agent-invoke:${getClientIpAddress(request)}:${slug}`,
      limit: 24,
      windowMs: 60_000,
    });

    const rawBody = await parseJsonBody(request);
    const requestBody = validateInvocationPayloadForRoute(route, rawBody);

    return handleMppProtectedExecution({
      request,
      route,
      requestBody,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to run MPP-protected invocation.",
      },
      { status: 400 },
    );
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return handleInvocation(request, context);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  return handleInvocation(request, context);
}
