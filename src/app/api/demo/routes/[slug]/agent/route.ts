import { getRouteBySlug } from "@/lib/store";
import { createDemoAgent } from "@/lib/tempo-agent";

export async function POST(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const route = await getRouteBySlug(slug);

    if (!route) {
      return Response.json({ error: "Route not found." }, { status: 404 });
    }

    const agent = await createDemoAgent(slug);
    return Response.json({
      agent,
      route: {
        id: route.id,
        slug: route.slug,
        routeName: route.routeName,
        priceAmount: route.priceAmount,
        currency: route.currency,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create the demo agent.";
    return Response.json({ error: message }, { status: 400 });
  }
}
