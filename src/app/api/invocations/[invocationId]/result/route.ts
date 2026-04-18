import { getInvocation } from "@/lib/store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ invocationId: string }> },
) {
  try {
    const { invocationId } = await context.params;
    const invocation = getInvocation(invocationId);

    if (!invocation) {
      return Response.json({ error: "Invocation not found." }, { status: 404 });
    }

    if (!invocation.resultPayload) {
      return Response.json({ error: "Invocation result is still locked." }, { status: 403 });
    }

    return Response.json({
      invocationId,
      result: invocation.resultPayload,
      transactionReference: invocation.transactionReference,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to fetch invocation result.",
      },
      { status: 500 },
    );
  }
}
