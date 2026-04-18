import type {
  LandingPageRoastInput,
  LandingPageRoastResult,
} from "@/lib/types";

function pickHeadlineFeedback(text: string) {
  const lower = text.toLowerCase();

  if (lower.length < 40) {
    return "The value proposition is too thin. Lead with a sharper promise and a clearer outcome.";
  }

  if (!/\b(save|grow|increase|reduce|faster|instant|automate)\b/.test(lower)) {
    return "The headline explains the product, but it does not yet sell the outcome. Add a concrete benefit or transformation.";
  }

  if (!/\bfor\b/.test(lower)) {
    return "The headline has momentum, but the audience is still implicit. Name who this is for so the page qualifies the right visitor faster.";
  }

  return "The headline is directionally strong. Tighten it further by reducing generic wording and putting the strongest benefit in the first clause.";
}

function pickCtaFeedback(text: string) {
  const lower = text.toLowerCase();

  if (!/\b(start|get|book|try|claim|pay|unlock|run|schedule|request)\b/.test(lower)) {
    return "The page copy lacks a clear action verb. Add one primary CTA that tells the visitor exactly what happens next.";
  }

  if (!/\bfree|demo|trial|instant|today|minutes|now\b/.test(lower)) {
    return "The CTA exists, but it does not reduce friction. Add a time-to-value or risk-reduction cue near the button.";
  }

  return "The CTA language is serviceable. Pair it with one confidence signal so the action feels safer and more immediate.";
}

function scoreClarity(text: string) {
  let score = 64;

  if (text.length > 180) score += 6;
  if (/\bfor\b/.test(text)) score += 5;
  if (/\b(save|grow|increase|reduce|faster|instant|automate)\b/.test(text)) score += 8;
  if (/\bfree|demo|trial|case study|trusted by|used by\b/.test(text)) score += 5;
  if (/\bpricing|price|plan|subscription\b/.test(text)) score += 3;
  if (text.length > 800) score -= 6;
  if (!/\b(you|your)\b/.test(text)) score -= 4;

  return Math.max(55, Math.min(95, score));
}

function deriveSuggestions(input: LandingPageRoastInput, text: string) {
  const suggestions = [
    "Move the strongest promise above the fold and make it measurable.",
    "Pair the main CTA with one trust signal such as customer proof, speed, or guarantee.",
    "Reduce generic adjectives and replace them with a concrete before-and-after outcome.",
  ];

  if (!input.targetAudience) {
    suggestions.unshift("State the target audience explicitly so the first screen qualifies the right visitor.");
  }

  if (!input.url) {
    suggestions.push("Add one concrete example of the product in action so the offer feels real, not abstract.");
  }

  if (!/\btestimonial|case study|logo|trusted\b/i.test(text)) {
    suggestions.push("Introduce social proof near the CTA to reduce perceived risk.");
  }

  return suggestions.slice(0, 4);
}

function deriveQuickWins(input: LandingPageRoastInput) {
  const quickWins = [
    "Rewrite the primary CTA to use a strong verb and immediate payoff.",
    "Add a one-line subheadline that names the audience and the main outcome.",
    "Show exactly what the user gets after payment or signup in three bullets.",
  ];

  if (input.brandName) {
    quickWins.unshift(`Make ${input.brandName} the anchor of the promise, not just the logo.`);
  }

  return quickWins.slice(0, 4);
}

export function runLandingPageRoast(
  input: LandingPageRoastInput,
): LandingPageRoastResult {
  const sourceText = [
    input.brandName,
    input.targetAudience,
    input.url,
    input.marketingCopy,
  ]
    .filter(Boolean)
    .join("\n");

  const clarityScore = scoreClarity(sourceText.toLowerCase());

  return {
    kind: "landing_page_roast",
    summary:
      clarityScore >= 82
        ? "The offer is understandable and commercially plausible, but the page still needs a crisper payoff and stronger proof."
        : "The page communicates intent, but it buries the payoff. Sharpen the promise, qualify the audience faster, and make the CTA more specific.",
    clarityScore,
    headlineFeedback: pickHeadlineFeedback(sourceText),
    ctaFeedback: pickCtaFeedback(sourceText),
    conversionSuggestions: deriveSuggestions(input, sourceText),
    quickWins: deriveQuickWins(input),
    inputEcho: {
      url: input.url,
      marketingCopy: input.marketingCopy,
      brandName: input.brandName,
      targetAudience: input.targetAudience,
    },
  };
}

