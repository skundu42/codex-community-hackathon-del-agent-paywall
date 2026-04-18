import { randomUUID } from "node:crypto";

import { validateRouteInput } from "@/lib/gateway";
import { createRoute, listRoutes } from "@/lib/store";
import type { ApiRouteInput } from "@/lib/types";

export async function GET() {
  return Response.json({
    routes: listRoutes(),
  });
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as ApiRouteInput;
    const validated = validateRouteInput(input);

    const route = createRoute({
      id: randomUUID(),
      status: "active",
      ...validated,
    });

    return Response.json({ route });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to create API route.",
      },
      { status: 400 },
    );
  }
}
