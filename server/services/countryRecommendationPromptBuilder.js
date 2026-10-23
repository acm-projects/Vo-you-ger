// Compatibility entry point: country selection is owned by deterministic code.
const { rankCountries } = require('./countryScoringService');
const { buildExplanationRequest } = require('../prompts/countryExplanationPrompt');

function buildPrompt({ quiz, nationalities, visaFreeCountryCodes }) {
  const candidates = rankCountries(quiz, visaFreeCountryCodes).slice(0,3);
  return {
    candidates,
    candidateIds: candidates.map((country) => country.id),
    ...buildExplanationRequest(candidates,quiz),
  };
}

module.exports = { buildPrompt };
