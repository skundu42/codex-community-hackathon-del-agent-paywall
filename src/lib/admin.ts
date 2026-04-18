import { timingSafeEqual } from "node:crypto";

import { appEnv } from "@/lib/env";

export function assertAdminRequest(request: Request) {
  const provided = request.headers.get("x-admin-token") ?? "";
  const expected = appEnv.adminToken ?? "";

  if (!expected) {
    throw new Error("ADMIN_TOKEN is not configured.");
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new Error("Unauthorized admin request.");
  }
}

