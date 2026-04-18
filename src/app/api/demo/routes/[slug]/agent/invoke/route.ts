import { getRouteBySlug } from "@/lib/store";
import { invokeRouteAsDemoAgent } from "@/lib/tempo-agent";
import type { JsonValue } from "@/lib/types";

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

    const body = (await request.json().catch(() => ({}))) as {
      agentId?: string;
      requestBody?: JsonValue;
    };

    if (!body.agentId) {
      return Response.json({ error: "agentId is required." }, { status: 400 });
    }

    const payload =
      body.requestBody && typeof body.requestBody === "object" && !Array.isArray(body.requestBody)
        ? (body.requestBody as Record<string, unknown>)
        : undefined;

    const invocation = await invokeRouteAsDemoAgent({
      agentId: body.agentId,
      requestBody: payload,
      requestUrl: request.url,
      routeSlug: slug,
    });

    return Response.json(invocation);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to run the paid agent invocation.";
    return Response.json({ error: message }, { status: 400 });
  }
}
