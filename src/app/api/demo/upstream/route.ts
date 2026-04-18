import { validateLandingPageRoastInput } from "@/lib/gateway";
import { runLandingPageRoast } from "@/lib/landing-page-roast";

export async function GET() {
  return Response.json({
    provider: "AgentPaywall",
    route: "landing-page-roast",
    description:
      "Preview the internal landing page roast contract used by the featured paid route.",
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const normalizedBody =
    typeof body.prompt === "string" &&
    body.prompt.trim() &&
    typeof body.marketingCopy !== "string" &&
    typeof body.url !== "string"
      ? {
          ...body,
          marketingCopy: body.prompt,
        }
      : body;
  const result = runLandingPageRoast(
    validateLandingPageRoastInput(normalizedBody as never),
  );

  return Response.json(result);
}
