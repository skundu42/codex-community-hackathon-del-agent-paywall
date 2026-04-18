import { executeInvocationById } from "@/lib/execution";

export async function POST(
  _request: Request,
  context: { params: Promise<{ invocationId: string }> },
) {
  try {
    const { invocationId } = await context.params;
    const execution = await executeInvocationById(invocationId);

    return Response.json({
      invocationId,
      result: execution.result,
      transactionReference: execution.invocation.transactionReference,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to execute invocation.";
    const status = /payment/i.test(message) ? 402 : /not found/i.test(message) ? 404 : 500;

    return Response.json(
      { error: message },
      { status },
    );
  }
}
