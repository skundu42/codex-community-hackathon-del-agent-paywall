import test from "node:test";
import assert from "node:assert/strict";

import { runLandingPageRoast } from "@/lib/landing-page-roast";

test("runLandingPageRoast returns the expected contract", () => {
  const result = runLandingPageRoast({
    url: "https://example.com",
    brandName: "Tempo Gate",
    targetAudience: "API teams",
    marketingCopy:
      "Turn any premium API into a pay-per-call machine payment endpoint with Tempo and MPP.",
  });

  assert.equal(result.kind, "landing_page_roast");
  assert.equal(typeof result.summary, "string");
  assert.equal(typeof result.headlineFeedback, "string");
  assert.equal(typeof result.ctaFeedback, "string");
  assert.ok(result.clarityScore >= 55);
  assert.ok(result.clarityScore <= 95);
  assert.ok(result.conversionSuggestions.length > 0);
  assert.ok(result.quickWins.length > 0);
});

