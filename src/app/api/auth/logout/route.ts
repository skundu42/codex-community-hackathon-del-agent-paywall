import { logoutProviderFromRequest, serializeClearedSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  await logoutProviderFromRequest(request);

  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", serializeClearedSessionCookie());
  return response;
}
