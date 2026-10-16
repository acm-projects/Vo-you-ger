/**
 * server/services/visaService.js
 *
 * Integrates with the TravelBuddy Visa API hosted on RapidAPI
 * (https://visa-requirement.p.rapidapi.com/v2/visa/map) to determine
 * visa requirements based on the traveler's passport nationalities.
 *
 * Endpoint:
 *   POST https://visa-requirement.p.rapidapi.com/v2/visa/map
 *
 * Authentication:
 *   Uses a single environment variable: process.env.VISA_API_KEY
 *   Passed in headers: X-RapidAPI-Key and X-RapidAPI-Host
 *
 * Request Body:
 *   { "passport": "US" } // 2-letter ISO country code
 *
 * Response Structure:
 *   {
 *     "data": {
 *       "passport": "US",
 *       "colors": {
 *         "green": "AL,AD,AG,AR,AT,AU,...", // Visa-free destinations
 *         "blue": "...",                     // Visa on arrival or eVisa
 *         "yellow": "...",                   // eTA / Pre-registration
 *         "red": "..."                       // Visa required / Not admitted
 *       }
 *     }
 *   }
 *
 * In Phase 1B, if a traveler specifies they are NOT willing to get a visa,
 * we query this endpoint for their passport(s) and retain ONLY countries
 * marked with color "green" (visa-free).
 */

const { toCountryCode } = require("../utils/countryCodes");

// RapidAPI endpoint for TravelBuddy Visa Requirements API
const VISA_API_URL = "https://visa-requirement.p.rapidapi.com/v2/visa/map";

/**
 * Parses the raw API response from TravelBuddy's /v2/visa/map endpoint
 * and extracts the list of two-letter ISO country codes that are "green" (visa-free).
 *
 * @param {object} json - Parsed JSON response from the visa API
 * @returns {string[]} Array of two-letter uppercase country codes (e.g. ["FR", "ES", "IT"])
 */
function extractGreenCountryCodes(json) {
  // TravelBuddy wraps map data under `data.colors` (or directly under `colors`)
  const colors = json?.data?.colors || json?.colors || {};
  const green = colors.green;

  // The API returns green countries as either a comma-separated string: "FR,ES,IT"
  if (typeof green === "string") {
    return green
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter((code) => code.length === 2);
  }

  // Or as an array of country code strings: ["FR", "ES", "IT"]
  if (Array.isArray(green)) {
    return green
      .map((code) => String(code).trim().toUpperCase())
      .filter((code) => code.length === 2);
  }

  return [];
}

/**
 * Fetches the visa map for a single passport country code from TravelBuddy API.
 * Uses the single VISA_API_KEY environment variable for authentication.
 *
 * @param {string} passportCode - 2-letter ISO country code of the traveler's passport (e.g. "US")
 * @returns {Promise<Set<string>>} Set of visa-free (green) 2-letter destination country codes
 */
async function fetchVisaFreeForPassport(passportCode) {
  // Normalize passport to 2-letter ISO alpha-2 code
  const normalizedPassport = toCountryCode(passportCode);
  if (!normalizedPassport) {
    throw new Error(
      `Invalid or unrecognized passport country code: "${passportCode}"`
    );
  }

  // Set up request headers with our single VISA_API_KEY environment variable
  const headers = {
    "Content-Type": "application/json",
  };

  if (process.env.VISA_API_KEY) {
    headers["X-RapidAPI-Key"] = process.env.VISA_API_KEY;
    headers["X-RapidAPI-Host"] = "visa-requirement.p.rapidapi.com";
  }

  // Prepare POST request with JSON body: { "passport": "XX" }
  const response = await fetch(VISA_API_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ passport: normalizedPassport }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Visa API request failed with status ${response.status}: ${errorBody || response.statusText}`
    );
  }

  const json = await response.json();
  const greenCodes = extractGreenCountryCodes(json);

  return new Set(greenCodes);
}

/**
 * Retrieves the comprehensive set of visa-free (green) country codes for a user.
 * If a user holds multiple nationalities (e.g. dual citizenship US and IT),
 * they are eligible for visa-free travel if ANY of their passports is visa-free.
 * Therefore, we query each passport and take the union of all green country sets.
 *
 * @param {string[]} nationalities - List of country names or ISO-2 codes (e.g. ["United States", "Italy"])
 * @returns {Promise<Set<string>>} Set of all visa-free destination country codes (e.g. Set {"FR", "ES", "JP", ...})
 */
async function getVisaFreeCountries(nationalities = []) {
  // If no nationalities provided, we cannot look up visa rules
  if (!Array.isArray(nationalities) || nationalities.length === 0) {
    return new Set();
  }

  // Convert all nationality names into 2-letter codes and eliminate duplicates
  const passportCodes = Array.from(
    new Set(
      nationalities
        .map((nat) => toCountryCode(nat))
        .filter((code) => Boolean(code))
    )
  );

  if (passportCodes.length === 0) {
    return new Set();
  }

  // Fetch visa map for each passport in parallel
  const visaFreeUnion = new Set();
  for (const passportCode of passportCodes) {
    try {
      const greenSet = await visaService.fetchVisaFreeForPassport(passportCode);
      for (const code of greenSet) {
        visaFreeUnion.add(code);
      }
    } catch (err) {
      console.warn(
        `[visaService] Warning: Could not fetch visa map for passport ${passportCode}: ${err.message}`
      );
      // Re-throw so caller can handle external service errors
      throw err;
    }
  }

  return visaFreeUnion;
}

// Export as an object so unit tests can easily mock or spy on individual functions
const visaService = {
  VISA_API_URL,
  extractGreenCountryCodes,
  fetchVisaFreeForPassport,
  getVisaFreeCountries,
};

module.exports = visaService;
