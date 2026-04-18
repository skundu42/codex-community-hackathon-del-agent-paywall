import {
  createProviderAuthSession,
  registerProviderAccount,
  serializeSessionCookie,
  toPublicProvider,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      providerName?: string;
      email?: string;
      password?: string;
      walletAddress?: string;
    };

    const provider = await registerProviderAccount({
      providerName: body.providerName ?? "",
      email: body.email ?? "",
      password: body.password ?? "",
      walletAddress: body.walletAddress ?? "",
    });
    const { session, sessionToken } = await createProviderAuthSession(provider.id);

    const response = Response.json({ provider: toPublicProvider(provider) }, { status: 201 });
    response.headers.set("Set-Cookie", serializeSessionCookie(sessionToken, session.expiresAt));
    return response;
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to register provider." },
      { status: 400 },
    );
  }
}
