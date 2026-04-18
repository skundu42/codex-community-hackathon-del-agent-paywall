import { RouteDetailPage } from "@/components/route-detail-page";

export const dynamic = "force-dynamic";

export default async function RouteDetailPageRoute({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  const { routeId } = await params;
  return <RouteDetailPage routeId={routeId} />;
}
