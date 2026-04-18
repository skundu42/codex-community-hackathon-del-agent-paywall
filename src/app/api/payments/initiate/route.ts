import { initiatePaymentForInvocation } from "@/lib/payment-provider";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { invocationId?: string };

    if (!body.invocationId) {
      return Response.json({ error: "invocationId is required." }, { status: 400 });
    }

    const payment = await initiatePaymentForInvocation(body.invocationId);
    return Response.json({ payment });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to initiate payment session.",
      },
      { status: 400 },
    );
  }
}
