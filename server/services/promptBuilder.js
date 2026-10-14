const BUDGET_RANK = { $: 1, $$: 2, $$$: 3 };
function filterDestinations(destinations, quiz = {}) {
  const maxBudget = BUDGET_RANK[quiz.dailyBudget];
  const maxSafety =
    typeof quiz.riskTolerance === "number" ? quiz.riskTolerance + 1 : null;

  const filtered = destinations.filter((d) => {
    if (maxBudget && BUDGET_RANK[d.budget] > maxBudget) return false;
    if (maxSafety && d.safety > maxSafety) return false;
    return true;
  });

  return filtered.length >= 5 ? filtered : destinations;
}

const SYSTEM_PROMPT = `You are a travel recommendation engine for an app called Vo(you)ger.
Rules:
- Recommend ONLY destinations from the provided candidate list.
- Use each destination's exact "id" in destinationId.
- Return up to 5 destinations, best match first.
- Base matchScore (0-100) on how well the destination fits the traveler's quiz answers.
- In each reason, refer to specific quiz answers (budget, trip length, personality, interests).
- Respect hard constraints: budget, trip length, risk tolerance and dietary needs.
- If the traveler listed countries of interest, favor those but do not ignore better matches.
- Do not invent facts. If unsure about something, leave it out.`;

/**
 * Merge the quiz answers, profile nationalities and candidate destinations
 * into the prompt text. Pure function: no network calls, easy to test.
 */
function buildPrompt({ quiz = {}, nationalities = [], destinations = [], context = {} }) {
  const candidates = filterDestinations(destinations, quiz).map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    country: d.country,
    tags: d.tags,
    budget: d.budget,
    bestMonths: d.bestMonths,
    climate: d.climate,
    safety: d.safety,
    description: d.description,
  }));

  const prompt = `Traveler quiz answers:
${JSON.stringify(quiz, null, 2)}

Traveler nationalities: ${JSON.stringify(nationalities)}

Extra context (may be empty):
${JSON.stringify(context, null, 2)}

Candidate destinations (recommend ONLY from this list, using the exact id):
${JSON.stringify(candidates)}`;

  return {
    systemPrompt: SYSTEM_PROMPT,
    prompt,
    candidateIds: candidates.map((c) => c.id),
  };
}

module.exports = { buildPrompt, filterDestinations, SYSTEM_PROMPT };