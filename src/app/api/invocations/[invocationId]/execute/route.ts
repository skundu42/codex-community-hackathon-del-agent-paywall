import { attachInvocationResult, getInvocation, getPaymentSession, getRoute, setInvocationStatus } from "@/lib/store";
import { proxyUpstreamRequest } from "@/lib/gateway";

export async function POST(
  _request: Request,
  context: { params: Promise<{ invocationId: string }> },
) {
  try {
    const { invocationId } = await context.params;
    const invocation = getInvocation(invocationId);

    if (!invocation) {
      return Response.json({ error: "Invocation not found." }, { status: 404 });
    }

    if (!invocation.paymentSessionId) {
      return Response.json(
        { error: "Payment is required before proxy execution." },
        { status: 402 },
      );
    }

    const payment = getPaymentSession(invocation.paymentSessionId);
    if (!payment || payment.status !== "paid") {
      return Response.json(
        { error: "Payment must be verified before proxy execution." },
        { status: 402 },
      );
    }

    if (invocation.resultPayload) {
      return Response.json({
        invocationId,
        result: invocation.resultPayload,
        transactionReference: invocation.transactionReference,
      });
    }

    const route = getRoute(invocation.routeId);
    if (!route) {
      return Response.json({ error: "Route not found." }, { status: 404 });
    }

    setInvocationStatus(invocationId, "processing");
    const result = await proxyUpstreamRequest(route, invocation.requestBody);

    attachInvocationResult(invocationId, result, payment.tempoTxHash ?? payment.mppReference);

    return Response.json({
      invocationId,
      result,
      transactionReference: payment.tempoTxHash ?? payment.mppReference,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to execute invocation.",
      },
      { status: 500 },
    );
  }
}
