import { randomUUID } from "node:crypto";

import { assertAdminRequest } from "@/lib/admin";
import { validateRouteInput } from "@/lib/gateway";
import { createRoute } from "@/lib/store";
import type { ApiRouteInput } from "@/lib/types";

export async function POST(request: Request) {
  try {
    assertAdminRequest(request);

    const input = (await request.json()) as ApiRouteInput;
    const validated = await validateRouteInput(input);
    const route = await createRoute({
      id: randomUUID(),
      status: "active",
      ...validated,
    });

    return Response.json({ route });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create API route.";
    const status = /unauthorized/i.test(message) ? 401 : 400;

    return Response.json({ error: message }, { status });
  }
}

