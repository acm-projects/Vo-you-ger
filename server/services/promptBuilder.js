/**
 * Constructs the AI prompt and filters candidate destinations for Gemini.
 *
 * In Phase 1B:
 * - If the traveler is NOT willing to get a visa (willingToGetVisa === false or visaWillingness === false),
 *   candidate destinations are filtered to keep ONLY those in countries where the traveler
 *   enjoys visa-free entry (color green from TravelBuddy Visa API).
 * - From that visa-compliant subset, we compare the traveler's quiz responses
 *   (budget, safety risk tolerance, climate, preferred months, travel alter ego, tags).
 * - Gemini selects the top 3 preference-compliant destinations in 3 different countries.
 */

// Rank budgets on a 1-3 scale to easily compare <= constraints
const BUDGET_RANK = { $: 1, $$: 2, $$$: 3 };

/**
 * Filters the master destinations catalog using constraints from the user's quiz:
 *
 * 1. Visa filter (Phase 1B):
 *    If `visaFreeCountryCodes` is provided (a Set of 2-letter ISO country codes), only keep destinations whose `countryCode` is in this set.
 *
 * 2. Budget filter:
 *    Only keep destinations with a cost rating <= user's `dailyBudget` ($ < $$ < $$$).
 *
 * 3. Safety / Risk tolerance filter:
 *    Only keep destinations whose safety risk rating is within user's `riskTolerance`.
 *
 * Fallback Guarantee:
 * The prompt requires Gemini to return 3 destinations across 3 distinct countries.
 * If restrictive budget/safety filters leave fewer than 3 countries, we relax budget/safety
 * first, while always retaining the visa-free constraint.
 *
 * @param {Array<object>} destinations - Master list of destinations from destinations.json
 * @param {object} quiz - Parsed user quiz responses
 * @param {Set<string>|null} visaFreeCountryCodes - Optional Set of green visa-free ISO country codes
 * @returns {Array<object>} Filtered list of candidate destinations
 */
function filterDestinations(
  destinations,
  quiz = {},
  visaFreeCountryCodes = null,
) {
  const maxBudget = BUDGET_RANK[quiz.dailyBudget];
  const maxSafety =
    typeof quiz.riskTolerance === "number" ? quiz.riskTolerance + 1 : null;

  // Step 1: Apply Visa Filter if visaFreeCountryCodes is provided
  // Only keep destinations situated in visa-free countries
  const visaCompliant = destinations.filter((d) => {
    if (!visaFreeCountryCodes) return true;
    return visaFreeCountryCodes.has(d.countryCode);
  });

  // Base pool of destinations: if visa filter is active, only visaCompliant items are considered
  const basePool = visaFreeCountryCodes
    ? visaCompliant
    : destinations;

  // Step 2: Apply budget and safety filters on the base pool
  const filtered = basePool.filter((d) => {
    if (maxBudget && BUDGET_RANK[d.budget] > maxBudget) return false;
    if (maxSafety && d.safety > maxSafety) return false;
    return true;
  });

  // Step 3: Ensure there are at least 3 distinct countries so the AI can meet the 3-country rule
  const distinctFilteredCountries = new Set(filtered.map((d) => d.country))
    .size;
  if (distinctFilteredCountries >= 3) {
    return filtered;
  }

  // If budget/safety was too narrow, relax them and fall back to basePool
  return basePool;
}

const SYSTEM_PROMPT = `You are a travel recommendation engine for an app called Vo(you)ger.
Rules:
- Recommend ONLY destinations from the provided candidate list.
- Use each destination's exact "id" in destinationId.
- Return EXACTLY 3 destinations, best match first.
- The 3 destinations must be in 3 different countries. Never return two destinations from the same country.
- Base matchScore (0-100) on how well the destination fits the traveler's quiz answers.
- In each reason, refer to specific quiz answers (budget, trip length, personality, interests).
- Respect hard constraints: budget, trip length, risk tolerance and dietary needs.
- If the traveler listed countries of interest, strongly prioritize recommending destinations from those countries whenever they are present in the candidate list.
- Write in clean, correctly spaced sentences.
- Do not invent facts. If unsure about something, leave it out.`;

/**
 * Merges the quiz answers, profile nationalities, candidate destinations,
 * and visa constraint context into prompt text for Gemini.
 * Pure function: no network calls, fully deterministic and easy to test.
 *
 * @param {object} params
 * @param {object} params.quiz - User quiz answers
 * @param {string[]} params.nationalities - User profile citizenship(s)
 * @param {Array<object>} params.destinations - Master destinations list
 * @param {Set<string>|null} params.visaFreeCountryCodes - Optional visa-free country code set
 * @param {object} params.context - Optional additional context
 * @returns {{ systemPrompt: string, prompt: string, candidateIds: string[] }}
 */
function buildPrompt({
  quiz = {},
  nationalities = [],
  destinations = [],
  visaFreeCountryCodes = null,
  context = {},
}) {
  // Pre-filter candidate destinations according to quiz constraints and visa requirements
  const candidates = filterDestinations(
    destinations,
    quiz,
    visaFreeCountryCodes,
  ).map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    country: d.country,
    countryCode: d.countryCode,
    tags: d.tags,
    budget: d.budget,
    bestMonths: d.bestMonths,
    climate: d.climate,
    safety: d.safety,
    description: d.description,
  }));

  // If a visa-free constraint was enforced, annotate extra context for the model
  const promptContext = {
    ...context,
  };

  if (visaFreeCountryCodes) {
    promptContext.visaConstraint =
      "Traveler is not willing to get a visa. Candidate destinations have been pre-filtered to include only visa-free countries.";
  }

  const prompt = `Traveler quiz answers:
${JSON.stringify(quiz, null, 2)}

Traveler nationalities: ${JSON.stringify(nationalities)}

Extra context (may be empty):
${JSON.stringify(promptContext, null, 2)}

Candidate destinations (recommend ONLY from this list, using the exact id):
${JSON.stringify(candidates)}`;

  return {
    systemPrompt: SYSTEM_PROMPT,
    prompt,
    candidateIds: candidates.map((c) => c.id),
  };
}

module.exports = { buildPrompt, filterDestinations, SYSTEM_PROMPT };
