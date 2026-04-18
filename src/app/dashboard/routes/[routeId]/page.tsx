import { redirect } from "next/navigation";

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ routeId: string }>;
}) {
  await params;
  redirect("/");
}
