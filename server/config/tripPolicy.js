"use strict";

function timeout(name, fallback, maximum) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 100 && value <= maximum ? value : fallback;
}

const TRIP_POLICY = Object.freeze({
  version: "2026-10-23.1",
  minSupportedDays: 1,
  maxSupportedDays: 21,
  minNightsPerBase: 2,
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
  // The shared deadline still reserves half for the second model initially.
  // A fast failure lets that model use the unused time instead of losing it
  // to an additional 45-second per-request ceiling.
  geminiRequestTimeoutMs: timeout('PLANNING_GEMINI_REQUEST_TIMEOUT_MS', 90000, 90000),
  geminiDeadlineMs: timeout('PLANNING_GEMINI_DEADLINE_MS', 90000, 180000),
  explanationTimeoutMs: timeout('PLANNING_EXPLANATION_TIMEOUT_MS', 60000, 120000),
  geminiMaxAttempts: 2,
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
