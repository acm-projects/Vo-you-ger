"use strict";

function timeout(name, fallback, maximum) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 100 && value <= maximum ? value : fallback;
}

const TRIP_POLICY = Object.freeze({
  version: "2026-10-31.1",
  minSupportedDays: 1,
  maxSupportedDays: 21,
  minNightsPerBase: 2,
  varietyRequiresMultipleBasesFromDays: 7,
  relaxedSingleBaseMaxDays: 7,
  maxRelaxedBases: 2,
  minimumCatalogCitiesPerCountry: 5,
  maxItineraryBases: 5,
  maxActivitiesPerFullDay: 4,
  maxActivitiesPerRelaxedDay: 3,
  maxDailyActivitySpreadKm: 8,
  maxTransferMinutes: 360,
  maxExcursionMinutes: 180,
  candidateBaseLimit: 24,
  routeBeamWidth: 64,
  placesConcurrency: 2,
  placesPageSize: 15,
  maxCandidatesPerLocation: 36,
  externalTimeoutMs: timeout('PLANNING_EXTERNAL_TIMEOUT_MS', 15000, 30000),
  // Each attempt has a short ceiling and reserves time for the remaining models.
  // Adding fallbacks never multiplies the total generation deadline.
  geminiRequestTimeoutMs: timeout('PLANNING_GEMINI_REQUEST_TIMEOUT_MS', 20000, 90000),
  geminiDeadlineMs: timeout('PLANNING_GEMINI_DEADLINE_MS', 60000, 180000),
  explanationTimeoutMs: timeout('PLANNING_EXPLANATION_TIMEOUT_MS', 15000, 120000),
  geminiMaxAttempts: /^[1-6]$/.test(process.env.PLANNING_GEMINI_MAX_ATTEMPTS || '') ? Number(process.env.PLANNING_GEMINI_MAX_ATTEMPTS) : 4,
  geminiTransientCooldownMs: timeout('PLANNING_GEMINI_TRANSIENT_COOLDOWN_MS', 5000, 60000),
  narrativeCacheTtlMs: timeout('PLANNING_NARRATIVE_CACHE_TTL_MS', 1800000, 3600000),
  narrativeCacheEntries: 100,
  maxGeminiOutputTokens: 16384,
  maxPromptBytes: 240000,
});

function maxBasesForDays(days) {
  if (!Number.isInteger(days) || days < TRIP_POLICY.minSupportedDays || days > TRIP_POLICY.maxSupportedDays) {
    throw new RangeError("Trip duration must be between 1 and 21 calendar days");
  }

  if (days <= 4) return 1;
  if (days <= 9) return 2;
  if (days <= 15) return 3;
  if (days <= 20) return 4;
  return 5;
}

function minimumNights(base, days) {
  maxBasesForDays(days);
  return days <= 2 ? days - 1 : Math.max(TRIP_POLICY.minNightsPerBase, base.minNights);
}

module.exports = { TRIP_POLICY, maxBasesForDays, minimumNights };
