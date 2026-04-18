import { getRouteBySlug } from "@/lib/store";
import { AGENT_FUND_AMOUNT, fundDemoAgent } from "@/lib/tempo-agent";

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
    };

    if (!body.agentId) {
      return Response.json({ error: "agentId is required." }, { status: 400 });
    }

    const agent = await fundDemoAgent(body.agentId, slug);
    return Response.json({
      agent,
      fundedAmount: AGENT_FUND_AMOUNT,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to fund the agent wallet.";
    return Response.json({ error: message }, { status: 400 });
  }
}
