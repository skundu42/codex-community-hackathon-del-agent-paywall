export async function GET() {
  return Response.json({
    provider: "Demo Provider",
    message: "This is a sample upstream API response.",
    receivedMethod: "GET",
    compatibility: "Ready to be wrapped behind the MPP gateway.",
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const text = typeof body?.message === "string" ? body.message : "No message provided.";
  const score = Math.max(55, Math.min(98, 60 + text.length));

  return Response.json({
    provider: "Demo Provider",
    compatibilityScore: score,
    receivedPayload: body,
    recommendation:
      score > 80
        ? "This API response is already clear and easy to monetize per request."
        : "Tighten the response contract and pricing metadata before exposing this route to agents.",
    timestamp: new Date().toISOString(),
  });
}
