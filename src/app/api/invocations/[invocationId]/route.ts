import { getPaymentStatus } from "@/lib/payment-provider";
import { getInvocationBundle } from "@/lib/store";
import { getExplorerTransactionUrl } from "@/lib/tempo";

export async function GET(
  _request: Request,
  context: { params: Promise<{ invocationId: string }> },
) {
  try {
    const { invocationId } = await context.params;
    const bundle = await getInvocationBundle(invocationId);

    if (!bundle) {
      return Response.json({ error: "Invocation not found." }, { status: 404 });
    }

    const payment = bundle.payment
      ? await getPaymentStatus(bundle.payment.id)
      : undefined;
    const refreshedBundle = await getInvocationBundle(invocationId);

    return Response.json({
      route: refreshedBundle?.route ?? bundle.route,
      invocation: refreshedBundle?.invocation ?? bundle.invocation,
      payment,
      explorerUrl: getExplorerTransactionUrl(
        payment?.tempoTxHash ?? payment?.receiptPayload?.reference,
      ),
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load invocation state.",
      },
      { status: 500 },
    );
  }
}
