/**
 * server/test/visa.test.js
 *
 * Unit tests for TravelBuddy Visa API integration (Phase 1B).
 * Verifies:
 * 1. Extraction of green (visa-free) countries from TravelBuddy response formats.
 * 2. Country code normalization (e.g. "United States" -> "US").
 * 3. Passport visa map fetching and error handling.
 * 4. Multi-citizenship union handling for dual-national travelers.
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const visaService = require("../services/visaService");
const { toCountryCode, VALID_ISO_CODES } = require("../utils/countryCodes");

describe("Phase 1B: Visa API & Utility Suite", () => {
  describe("Country Code Normalization (countryCodes.js)", () => {
    it("normalizes standard country names to 2-letter uppercase ISO codes", () => {
      assert.equal(toCountryCode("United States"), "US");
      assert.equal(toCountryCode("France"), "FR");
      assert.equal(toCountryCode("Japan"), "JP");
      assert.equal(toCountryCode("United Kingdom"), "GB");
      assert.equal(toCountryCode("South Korea"), "KR");
    });

    it("accepts already 2-letter ISO codes case-insensitively", () => {
      assert.equal(toCountryCode("us"), "US");
      assert.equal(toCountryCode("FR"), "FR");
      assert.equal(toCountryCode("jp"), "JP");
    });

    it("returns null for unrecognized or empty inputs", () => {
      assert.equal(toCountryCode(""), null);
      assert.equal(toCountryCode("Atlantis"), null);
      assert.equal(toCountryCode(null), null);
      assert.equal(toCountryCode(undefined), null);
    });
  });

  describe("TravelBuddy Response Parser (extractGreenCountryCodes)", () => {
    it("extracts green countries from a comma-separated string", () => {
      const mockApiResponse = {
        data: {
          passport: "US",
          colors: {
            green: "FR,ES,IT,JP,PT",
            blue: "ID,TH",
            yellow: "AU",
            red: "CN,RU",
          },
        },
      };

      const greenCodes = visaService.extractGreenCountryCodes(mockApiResponse);
      assert.deepEqual(greenCodes, ["FR", "ES", "IT", "JP", "PT"]);
    });

    it("extracts green countries when provided as an array", () => {
      const mockApiResponse = {
        data: {
          passport: "FR",
          colors: {
            green: ["DE", "ES", "IT", "PT"],
          },
        },
      };

      const greenCodes = visaService.extractGreenCountryCodes(mockApiResponse);
      assert.deepEqual(greenCodes, ["DE", "ES", "IT", "PT"]);
    });

    it("returns an empty array when colors or green field is missing", () => {
      assert.deepEqual(visaService.extractGreenCountryCodes({}), []);
      assert.deepEqual(visaService.extractGreenCountryCodes({ data: {} }), []);
      assert.deepEqual(
        visaService.extractGreenCountryCodes({ data: { colors: {} } }),
        []
      );
    });
  });

  describe("Visa Free Lookup per Passport (getVisaFreeCountries)", () => {
    let originalFetchForPassport;

    beforeEach(() => {
      originalFetchForPassport = visaService.fetchVisaFreeForPassport;
    });

    it("retrieves visa-free countries for a single nationality", async () => {
      visaService.fetchVisaFreeForPassport = async (passport) => {
        if (passport === "US") {
          return new Set(["FR", "ES", "IT", "JP", "PT", "GB"]);
        }
        return new Set();
      };

      const results = await visaService.getVisaFreeCountries(["United States"]);
      assert.ok(results.has("FR"));
      assert.ok(results.has("JP"));
      assert.ok(results.has("GB"));
      assert.equal(results.has("CN"), false);
    });

    it("computes the union of visa-free countries for dual citizenship", async () => {
      visaService.fetchVisaFreeForPassport = async (passport) => {
        if (passport === "US") {
          return new Set(["FR", "ES", "GB"]);
        }
        if (passport === "JP") {
          return new Set(["CN", "VN", "TH"]);
        }
        return new Set();
      };

      const results = await visaService.getVisaFreeCountries([
        "United States",
        "Japan",
      ]);

      // Both US and Japanese visa-free destinations should be present in the union
      assert.ok(results.has("FR"));
      assert.ok(results.has("GB"));
      assert.ok(results.has("CN"));
      assert.ok(results.has("VN"));
    });

    it("returns empty set if nationalities list is empty or unrecognized", async () => {
      const resultsEmpty = await visaService.getVisaFreeCountries([]);
      assert.equal(resultsEmpty.size, 0);

      const resultsUnknown = await visaService.getVisaFreeCountries(["Narnia"]);
      assert.equal(resultsUnknown.size, 0);
    });
  });
});

