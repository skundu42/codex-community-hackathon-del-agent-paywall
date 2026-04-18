import { buildRouteContract } from "@/lib/route-contract";
import { toPublicRoute } from "@/lib/gateway";
import { getRouteBySlug } from "@/lib/store";

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const route = await getRouteBySlug(slug);

  if (!route) {
    return Response.json({ error: "Route not found." }, { status: 404 });
  }

  const url = new URL(request.url);
  const contract = buildRouteContract(url.origin, route);

  return Response.json({
    route: toPublicRoute(route),
    ...contract,
  });
}
