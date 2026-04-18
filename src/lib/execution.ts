import { proxyUpstreamRequest, validateLandingPageRoastInput } from "@/lib/gateway";
import { runLandingPageRoast } from "@/lib/landing-page-roast";
import {
  attachInvocationResult,
  beginInvocationProcessing,
  failInvocation,
  getInvocationBundle,
} from "@/lib/store";

export async function executeInvocationById(invocationId: string) {
  const bundle = await getInvocationBundle(invocationId);
  if (!bundle) {
    throw new Error("Invocation not found.");
  }

  if (bundle.invocation.resultPayload) {
    return {
      invocation: bundle.invocation,
      route: bundle.route,
      payment: bundle.payment,
      result: bundle.invocation.resultPayload,
    };
  }

  if (!bundle.payment || bundle.payment.status !== "paid") {
    throw new Error("Payment must be verified before execution.");
  }

  const processing = await beginInvocationProcessing(invocationId);
  if (!processing) {
    throw new Error("Invocation not found.");
  }

  if (processing.resultPayload) {
    return {
      invocation: processing,
      route: bundle.route,
      payment: bundle.payment,
      result: processing.resultPayload,
    };
  }

  if (processing.status !== "processing") {
    throw new Error("Invocation is not ready for execution.");
  }

  try {
    const result =
      bundle.route.routeKind === "internal_demo"
        ? runLandingPageRoast(
            validateLandingPageRoastInput(bundle.invocation.requestBody),
          )
        : await proxyUpstreamRequest(bundle.route, bundle.invocation.requestBody);

    const completed = await attachInvocationResult(
      invocationId,
      result,
      bundle.payment.tempoTxHash ??
        bundle.payment.receiptPayload?.reference ??
        bundle.payment.mppReference,
    );

    if (!completed) {
      throw new Error("Invocation result could not be saved.");
    }

    return {
      invocation: completed,
      route: bundle.route,
      payment: bundle.payment,
      result,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invocation execution failed.";
    await failInvocation(invocationId, message);
    throw error;
  }
}

