import test from "node:test";
import assert from "node:assert/strict";

import {
  validateLandingPageRoastInput,
  validateRouteInput,
} from "@/lib/gateway";

test("validateRouteInput accepts internal demo routes", async () => {
  const route = await validateRouteInput({
    providerName: "AgentPaywall",
    routeName: "Landing Page Roast",
    routeKind: "internal_demo",
    priceAmount: "0.02",
  });

  assert.equal(route.routeKind, "internal_demo");
  assert.equal(route.httpMethod, "POST");
  assert.equal(route.slug, "landing-page-roast");
});

test("validateRouteInput rejects loopback upstreams", async () => {
  await assert.rejects(
    () =>
      validateRouteInput({
        providerName: "Partner API",
        routeName: "Private route",
        routeKind: "external_proxy",
        upstreamUrl: "http://127.0.0.1:3000/private",
        httpMethod: "POST",
        priceAmount: "0.05",
      }),
    /Private-network upstream IPs are not allowed|Loopback and local-network upstream URLs are not allowed/,
  );
});

test("validateLandingPageRoastInput requires url or marketing copy", () => {
  assert.throws(
    () => validateLandingPageRoastInput(undefined),
    /Provide either a website URL or a block of marketing copy/,
  );
});

test("validateRouteInput rejects methods other than GET and POST", async () => {
  await assert.rejects(
    () =>
      validateRouteInput({
        providerName: "Partner API",
        routeName: "Legacy method route",
        routeKind: "external_proxy",
        upstreamUrl: "https://api.example.com/private",
        httpMethod: "PUT" as never,
        priceAmount: "0.05",
      }),
    /HTTP method must be one of: GET, POST/,
  );
});
