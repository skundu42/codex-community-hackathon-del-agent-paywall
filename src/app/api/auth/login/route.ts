import {
  authenticateProviderAccount,
  createProviderAuthSession,
  serializeSessionCookie,
  toPublicProvider,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const provider = await authenticateProviderAccount({
      email: body.email ?? "",
      password: body.password ?? "",
    });
    const { session, sessionToken } = await createProviderAuthSession(provider.id);

    const response = Response.json({ provider: toPublicProvider(provider) });
    response.headers.set("Set-Cookie", serializeSessionCookie(sessionToken, session.expiresAt));
    return response;
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to sign in." },
      { status: 401 },
    );
  }
}
