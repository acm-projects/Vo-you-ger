/**
 * server/test/itinerary.test.js
 *
 * Test suite for Itinerary Generation (Phase 3).
 * Verifies:
 * 1. Schema validation (itinerarySchema.js) for multi-activity arrays, dates, days of week, and lateNight.
 * 2. Prompt builder (itineraryPromptBuilder.js) computing calendar schedule and injecting constraints.
 * 3. Anti-hallucination verification (itineraryService.js) rejecting invented venue IDs.
 * 4. API endpoint (POST /api/itinerary/generate) and DynamoDB trip persistence.
 */

require("dotenv").config();
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const llm = require("../services/llmclient");
const userModel = require("../models/userModel");
const tripModel = require("../models/tripModel");
const {
  itineraryResultSchema,
  getItineraryResponseJsonSchema,
} = require("../schemas/itinerarySchema");
const {
  buildItineraryPrompt,
  computeItinerarySchedule,
  ITINERARY_SYSTEM_PROMPT,
} = require("../services/itineraryPromptBuilder");
const { generateItinerary } = require("../services/itineraryService");
const { createItinerary } = require("../controllers/itineraryController");
const placesQueryBuilder = require("../services/placesQueryBuilder");
const googlePlacesService = require("../services/googlePlacesService");

// Sample Phase 2 candidate places for Tokyo with opening hours
const mockCandidatePlaces = [
  {
    placeId: "tokyo-sensoji",
    name: "Senso-ji Temple",
    category: "temple",
    neighborhood: "Asakusa",
    lat: 35.7148,
    lng: 139.7967,
    description: "Ancient Buddhist temple in Asakusa with iconic giant lantern.",
    estimatedCost: "Free",
    daysOpen: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    openingHours: [
      "Monday: 6:00 AM – 5:00 PM",
      "Tuesday: 6:00 AM – 5:00 PM",
      "Wednesday: 6:00 AM – 5:00 PM",
      "Thursday: 6:00 AM – 5:00 PM",
      "Friday: 6:00 AM – 5:00 PM",
      "Saturday: 6:00 AM – 5:00 PM",
      "Sunday: 6:00 AM – 5:00 PM",
    ],
  },
  {
    placeId: "tokyo-skytree",
    name: "Tokyo Skytree",
    category: "viewpoint",
    neighborhood: "Oshiage",
    lat: 35.71,
    lng: 139.8107,
    description: "Towering observation deck with panoramic city views.",
    estimatedCost: "$20",
    daysOpen: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    openingHours: [
      "Monday: 10:00 AM – 9:00 PM",
      "Tuesday: 10:00 AM – 9:00 PM",
      "Wednesday: 10:00 AM – 9:00 PM",
      "Thursday: 10:00 AM – 9:00 PM",
      "Friday: 10:00 AM – 9:00 PM",
      "Saturday: 10:00 AM – 9:00 PM",
      "Sunday: 10:00 AM – 9:00 PM",
    ],
  },
  {
    placeId: "tokyo-shinjuku-gyoen",
    name: "Shinjuku Gyoen National Garden",
    category: "park",
    neighborhood: "Shinjuku",
    lat: 35.6852,
    lng: 139.71,
    description: "Peaceful sprawling park with traditional Japanese landscape gardens.",
    estimatedCost: "$4",
    daysOpen: ["Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], // Closed Mondays
    openingHours: [
      "Tuesday: 9:00 AM – 4:30 PM",
      "Wednesday: 9:00 AM – 4:30 PM",
      "Thursday: 9:00 AM – 4:30 PM",
      "Friday: 9:00 AM – 4:30 PM",
      "Saturday: 9:00 AM – 4:30 PM",
      "Sunday: 9:00 AM – 4:30 PM",
    ],
  },
  {
    placeId: "tokyo-shibuya-sky",
    name: "Shibuya Sky",
    category: "viewpoint",
    neighborhood: "Shibuya",
    lat: 35.6585,
    lng: 139.7023,
    description: "360-degree open-air rooftop observation deck over Shibuya crossing.",
    estimatedCost: "$18",
    daysOpen: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    openingHours: [
      "Monday: 10:00 AM – 10:30 PM",
      "Tuesday: 10:00 AM – 10:30 PM",
      "Wednesday: 10:00 AM – 10:30 PM",
      "Thursday: 10:00 AM – 10:30 PM",
      "Friday: 10:00 AM – 10:30 PM",
      "Saturday: 10:00 AM – 10:30 PM",
      "Sunday: 10:00 AM – 10:30 PM",
    ],
  },
  {
    placeId: "tokyo-omotesando-cafe",
    name: "Aoyama Flower Market Tea House",
    category: "cafe",
    neighborhood: "Minato",
    lat: 35.6653,
    lng: 139.7123,
    description: "Lush botanical cafe serving organic herbal teas and seasonal sweets.",
    estimatedCost: "$15",
    daysOpen: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    openingHours: [
      "Monday: 11:00 AM – 7:00 PM",
      "Tuesday: 11:00 AM – 7:00 PM",
      "Wednesday: 11:00 AM – 7:00 PM",
      "Thursday: 11:00 AM – 7:00 PM",
      "Friday: 11:00 AM – 7:00 PM",
      "Saturday: 11:00 AM – 7:00 PM",
      "Sunday: 11:00 AM – 7:00 PM",
    ],
  },
  {
    placeId: "tokyo-ginza-six",
    name: "Ginza Six Rooftop & Dining",
    category: "shopping",
    neighborhood: "Ginza",
    lat: 35.6696,
    lng: 139.764,
    description: "Architectural retail complex with rooftop terrace and gourmet dining.",
    estimatedCost: "$35",
    daysOpen: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    openingHours: [
      "Monday: 11:00 AM – 11:00 PM",
      "Tuesday: 11:00 AM – 11:00 PM",
      "Wednesday: 11:00 AM – 11:00 PM",
      "Thursday: 11:00 AM – 11:00 PM",
      "Friday: 11:00 AM – 11:00 PM",
      "Saturday: 11:00 AM – 11:00 PM",
      "Sunday: 11:00 AM – 11:00 PM",
    ],
  },
  {
    placeId: "tokyo-golden-gai",
    name: "Shinjuku Golden Gai",
    category: "nightlife",
    neighborhood: "Shinjuku",
    lat: 35.6942,
    lng: 139.7047,
    description: "Historic maze of narrow alleyways packed with intimate micro-bars.",
    estimatedCost: "$20-30",
    daysOpen: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    openingHours: [
      "Monday: 8:00 PM – 4:00 AM",
      "Tuesday: 8:00 PM – 4:00 AM",
      "Wednesday: 8:00 PM – 4:00 AM",
      "Thursday: 8:00 PM – 4:00 AM",
      "Friday: 8:00 PM – 4:00 AM",
      "Saturday: 8:00 PM – 4:00 AM",
      "Sunday: 8:00 PM – 4:00 AM",
    ],
  },
];

function makeValidAIItinerary() {
  return {
    tripTitle: "Tokyo Cultural & Skyline Discovery",
    destination: "Tokyo, Japan",
    summary:
      "A balanced 2-day journey exploring historic temples, peaceful gardens, and futuristic observation decks matching your Explorer alter ego and moderate budget.",
    recommendedStayArea: "Shinjuku / Shibuya",
    stayAreaRationale:
      "Staying in central Shinjuku keeps you within a short walk of morning parks and evening izakayas, while serving as Tokyo's primary transit hub.",
    days: [
      {
        day: 1,
        date: "2026-10-24",
        dayOfWeek: "Saturday",
        theme: "Historic Asakusa & Modern Heights",
        morning: [
          {
            placeId: "tokyo-sensoji",
            placeName: "Senso-ji Temple",
            activityDescription:
              "Wander through the Kaminarimon gate and explore Asakusa's oldest temple, absorbing the vibrant morning incense and historic atmosphere.",
            estimatedCost: "Free",
            travelTip:
              "Arrive before 9:00 AM to enjoy the grounds before large tour groups arrive.",
          },
        ],
        afternoon: [
          {
            placeId: "tokyo-skytree",
            placeName: "Tokyo Skytree",
            activityDescription:
              "Ascend to the observation deck for panoramic views reaching Mount Fuji on clear autumn days.",
            estimatedCost: "$20",
            travelTip:
              "Book sunset tickets online in advance to skip the ticketing line.",
          },
        ],
        evening: [
          {
            placeId: "tokyo-ginza-six",
            placeName: "Ginza Six Rooftop & Dining",
            activityDescription:
              "Unwind at the tranquil rooftop garden before enjoying a curated dinner with excellent vegetarian menu options.",
            estimatedCost: "$35",
            travelTip:
              "The garden is free to access and offers a quiet oasis away from the bustling shopping floors.",
          },
        ],
        lateNight: {
          placeId: "tokyo-golden-gai",
          placeName: "Shinjuku Golden Gai",
          activityDescription:
            "Conclude your Saturday evening exploring intimate micro-bars and savoring late-night conversation.",
          estimatedCost: "$20",
          travelTip:
            "Many small bars have small seating charges (cover charge) noted at the entrance door.",
        },
      },
      {
        day: 2,
        date: "2026-10-25",
        dayOfWeek: "Sunday",
        theme: "Tranquil Greenery & Vibrant Shibuya",
        morning: [
          {
            placeId: "tokyo-shinjuku-gyoen",
            placeName: "Shinjuku Gyoen National Garden",
            activityDescription:
              "Take a peaceful stroll through the expansive traditional gardens and greenhouses.",
            estimatedCost: "$4",
            travelTip:
              "Alcohol is strictly prohibited inside, making it one of the most serene parks in Tokyo.",
          },
        ],
        afternoon: [
          {
            placeId: "tokyo-omotesando-cafe",
            placeName: "Aoyama Flower Market Tea House",
            activityDescription:
              "Recharge with floral herbal teas and light refreshments surrounded by fresh seasonal blooms.",
            estimatedCost: "$15",
            travelTip:
              "Expect a short wait during peak afternoon hours, but the botanical interior is worth it.",
          },
        ],
        evening: [
          {
            placeId: "tokyo-shibuya-sky",
            placeName: "Shibuya Sky",
            activityDescription:
              "End your journey watching Shibuya Crossing light up from 229 meters in the open air.",
            estimatedCost: "$18",
            travelTip:
              "Locker storage is mandatory for loose items like hats and tripods on the open roof.",
          },
        ],
      },
    ],
  };
}

function mockReqRes(options = {}) {
  const req = {
    user: { userId: "u-101" },
    body: {},
    params: {},
    ...options,
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };

  return { req, res };
}

describe("Phase 3: Itinerary Generation Suite", () => {
  describe("1. Schema Validation (itinerarySchema.js)", () => {
    it("validates a complete itinerary with multi-activity arrays, dates, and lateNight", () => {
      const validData = makeValidAIItinerary();
      const parsed = itineraryResultSchema.safeParse(validData);
      assert.equal(parsed.success, true);
      assert.equal(parsed.data.days.length, 2);
      assert.equal(parsed.data.days[0].date, "2026-10-24");
      assert.equal(parsed.data.days[0].dayOfWeek, "Saturday");
      assert.equal(parsed.data.days[0].morning[0].placeId, "tokyo-sensoji");
      assert.ok(parsed.data.days[0].lateNight);
    });

    it("rejects an itinerary missing an evening array slot", () => {
      const invalidData = makeValidAIItinerary();
      delete invalidData.days[0].evening;

      const parsed = itineraryResultSchema.safeParse(invalidData);
      assert.equal(parsed.success, false);
    });

    it("generates a clean JSON schema for Gemini with no $schema field", () => {
      const jsonSchema = getItineraryResponseJsonSchema();
      assert.equal(jsonSchema.$schema, undefined);
      assert.equal(jsonSchema.type, "object");
      assert.ok(jsonSchema.properties.days);
    });
  });

  describe("2. Prompt & Calendar Schedule (itineraryPromptBuilder.js)", () => {
    it("correctly computes sequential calendar dates and days of week", () => {
      const schedule = computeItinerarySchedule("2026-10-24", 3);
      assert.equal(schedule.length, 3);
      assert.equal(schedule[0].date, "2026-10-24");
      assert.equal(schedule[0].dayOfWeek, "Saturday");
      assert.equal(schedule[1].date, "2026-10-25");
      assert.equal(schedule[1].dayOfWeek, "Sunday");
      assert.equal(schedule[2].date, "2026-10-26");
      assert.equal(schedule[2].dayOfWeek, "Monday");
    });

    it("injects quiz preferences, candidate places, and operating hour constraints", () => {
      const quiz = {
        travelAlterEgo: "Explorer",
        budgetLevel: "$$",
        dietaryRestrictions: ["Vegetarian"],
        minNights: 2,
        seeAllOrDeeply: "seeAll",
        sleepInOrEarly: "Sleep in",
      };

      const { systemPrompt, prompt, candidatePlaceIds, schedule } =
        buildItineraryPrompt({
          destination: "Tokyo, Japan",
          quiz,
          candidatePlaces: mockCandidatePlaces,
          numberOfDays: 2,
          startDate: "2026-10-24",
        });

      // System prompt constraints
      assert.ok(systemPrompt.includes("STRICT ZERO-HALLUCINATION RULES"));
      assert.ok(systemPrompt.includes("CANDIDATE LIST ONLY"));
      assert.ok(systemPrompt.includes("DAYS OF WEEK & OPERATING HOURS CONSTRAINTS"));
      assert.ok(systemPrompt.includes("PACING, MULTI-ACTIVITY & NIGHTLIFE RULES"));

      // User prompt injection
      assert.ok(prompt.includes("Tokyo, Japan"));
      assert.ok(prompt.includes("Day 1: Saturday, 2026-10-24"));
      assert.ok(prompt.includes('"seeAllOrDeeply": "seeAll"'));
      assert.ok(prompt.includes('"sleepInOrEarly": "Sleep in"'));
      assert.ok(prompt.includes("tokyo-sensoji"));

      // Candidate place ID set
      assert.equal(candidatePlaceIds.has("tokyo-sensoji"), true);
      assert.equal(candidatePlaceIds.has("tokyo-golden-gai"), true);
      assert.equal(schedule.length, 2);
    });
  });

  describe("3. Service & Anti-Hallucination Verification (itineraryService.js)", () => {
    beforeEach(() => {
      llm.generateStructured = async () => ({
        model: "fake-gemini-model",
        data: makeValidAIItinerary(),
      });
    });

    it("successfully generates and normalizes multi-activity days and lateNight slots", async () => {
      const result = await generateItinerary({
        destination: "Tokyo, Japan",
        quiz: { budgetLevel: "$$", seeAllOrDeeply: "seeAll" },
        candidatePlaces: mockCandidatePlaces,
        numberOfDays: 2,
        startDate: "2026-10-24",
      });

      assert.equal(result.model, "fake-gemini-model");
      assert.equal(result.itinerary.days.length, 2);
      assert.equal(result.itinerary.days[0].date, "2026-10-24");
      assert.equal(result.itinerary.days[0].dayOfWeek, "Saturday");
      assert.equal(
        result.itinerary.days[0].morning[0].placeName,
        "Senso-ji Temple"
      );
      assert.equal(
        result.itinerary.days[0].lateNight.placeName,
        "Shinjuku Golden Gai"
      );
    });

    it("strictly rejects output if the model hallucinates a placeId in morning/afternoon", async () => {
      const hallucinatedOutput = makeValidAIItinerary();
      hallucinatedOutput.days[0].morning[0].placeId = "invented-eiffel-tower-tokyo";

      llm.generateStructured = async () => ({
        model: "fake-gemini-model",
        data: hallucinatedOutput,
      });

      await assert.rejects(
        async () => {
          await generateItinerary({
            destination: "Tokyo, Japan",
            quiz: {},
            candidatePlaces: mockCandidatePlaces,
            numberOfDays: 2,
          });
        },
        (err) => {
          assert.equal(err.statusCode, 502);
          assert.match(err.message, /AI hallucinated an unknown placeId/);
          return true;
        }
      );
    });

    it("strictly rejects output if the model hallucinates a placeId in lateNight", async () => {
      const hallucinatedOutput = makeValidAIItinerary();
      hallucinatedOutput.days[0].lateNight = {
        placeId: "invented-nightclub",
        placeName: "Club Galaxy",
        activityDescription: "Partying all night.",
        estimatedCost: "$30",
        travelTip: "Bring ID.",
      };

      llm.generateStructured = async () => ({
        model: "fake-gemini-model",
        data: hallucinatedOutput,
      });

      await assert.rejects(
        async () => {
          await generateItinerary({
            destination: "Tokyo, Japan",
            quiz: {},
            candidatePlaces: mockCandidatePlaces,
            numberOfDays: 2,
          });
        },
        (err) => {
          assert.equal(err.statusCode, 502);
          assert.match(err.message, /AI hallucinated an unknown placeId/);
          return true;
        }
      );
    });

    it("rejects generation when candidate places list is empty", async () => {
      await assert.rejects(
        async () => {
          await generateItinerary({
            destination: "Tokyo, Japan",
            quiz: {},
            candidatePlaces: [],
          });
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /candidate places list from Phase 2 is empty/);
          return true;
        }
      );
    });
  });

  describe("4. Controller & Persistence (POST /api/itinerary/generate)", () => {
    let savedTripUpdate = null;

    beforeEach(() => {
      savedTripUpdate = null;

      userModel.findUserById = async () => ({
        id: "u-101",
        quizResponse: { travelAlterEgo: "Explorer" },
      });

      tripModel.findTripById = async (userId, tripId) => ({
        tripId,
        userId,
        title: "Initial Tokyo Trip",
        itinerary: null,
        quizSnapshot: { budgetLevel: "$$" },
      });

      tripModel.updateTripItinerary = async (userId, tripId, itinerary, model) => {
        savedTripUpdate = { userId, tripId, itinerary, model };
        return {
          PK: `USER#${userId}`,
          SK: `TRIP#${tripId}`,
          tripId,
          userId,
          itinerary,
          model,
        };
      };

      llm.generateStructured = async () => ({
        model: "gemini-test",
        data: makeValidAIItinerary(),
      });
    });

    it("generates an itinerary and returns 200 with complete days", async () => {
      const { req, res } = mockReqRes({
        body: {
          destination: "Tokyo, Japan",
          candidatePlaces: mockCandidatePlaces,
          numberOfDays: 2,
          startDate: "2026-10-24",
        },
      });

      await createItinerary(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.itinerary.days.length, 2);
      assert.equal(res.body.itinerary.days[0].morning[0].placeId, "tokyo-sensoji");
      assert.equal(res.body.itinerary.days[0].date, "2026-10-24");
      assert.equal(res.body.itinerary.days[0].dayOfWeek, "Saturday");
      assert.equal(res.body.itinerary.days[0].morning[0].hoursToday, "6:00 AM – 5:00 PM");
      assert.ok(Array.isArray(res.body.itinerary.days[0].morning[0].openingHours));
    });

    it("updates DynamoDB trip when tripId is supplied", async () => {
      const { req, res } = mockReqRes({
        params: { tripId: "t-999" },
        body: {
          destination: "Tokyo, Japan",
          candidatePlaces: mockCandidatePlaces,
          numberOfDays: 2,
        },
      });

      await createItinerary(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(savedTripUpdate);
      assert.equal(savedTripUpdate.tripId, "t-999");
      assert.equal(savedTripUpdate.itinerary.days.length, 2);
      assert.equal(res.body.trip.PK, undefined);
    });

    it("returns 400 when destination is omitted", async () => {
      const { req, res } = mockReqRes({
        body: {
          candidatePlaces: mockCandidatePlaces,
        },
      });

      await createItinerary(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Destination is required/);
    });

    it("returns 400 when candidate places are missing or malformed", async () => {
      const { req, res } = mockReqRes({
        body: {
          destination: "Tokyo, Japan",
          candidatePlaces: [{ name: "Incomplete place without ID" }],
        },
      });

      await createItinerary(req, res);
      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /must include at least 'placeId' and 'name'/);
    });

    it("returns 404 when requested tripId does not exist", async () => {
      tripModel.findTripById = async () => null;

      const { req, res } = mockReqRes({
        params: { tripId: "non-existent-trip" },
        body: {
          destination: "Tokyo, Japan",
          candidatePlaces: mockCandidatePlaces,
        },
      });

      await createItinerary(req, res);
      assert.equal(res.statusCode, 404);
    });

    it("successfully accepts Phase 2 groupedPlaces response format", async () => {
      const { req, res } = mockReqRes({
        body: {
          destination: "Tokyo, Japan",
          groupedPlaces: {
            groups: [
              {
                groupId: "area-1",
                places: mockCandidatePlaces.slice(0, 3),
              },
              {
                groupId: "area-2",
                places: mockCandidatePlaces.slice(3),
              },
            ],
          },
          numberOfDays: 2,
        },
      });

      await createItinerary(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.itinerary.days.length, 2);
    });
  });

  describe("5. Phase 4 & Phase 5: End-to-End Orchestration & Travel Enrichment", () => {
    beforeEach(() => {
      userModel.findUserById = async () => ({
        id: "u-test-traveler",
        quizResponse: {
          budgetLevel: "$$",
          travelAlterEgo: "Explorer",
          minNights: 2,
          maxNights: 3,
        },
      });

      tripModel.findTripById = async (userId, tripId) => ({
        PK: `USER#${userId}`,
        SK: `TRIP#${tripId}`,
        tripId,
        userId,
        title: "Japan Highlights",
        recommendations: [
          {
            destinationId: "tokyo-jp",
            name: "Tokyo",
            country: "Japan",
            countryCode: "JP",
          },
          {
            destinationId: "kyoto-jp",
            name: "Kyoto",
            country: "Japan",
            countryCode: "JP",
          },
          {
            destinationId: "lisbon-pt",
            name: "Lisbon",
            country: "Portugal",
            countryCode: "PT",
          },
        ],
        quizSnapshot: {
          budgetLevel: "$$",
          travelAlterEgo: "Explorer",
          minNights: 2,
          maxNights: 3,
        },
      });

      tripModel.updateTripItinerary = async (userId, tripId, itinerary, model) => ({
        PK: `USER#${userId}`,
        SK: `TRIP#${tripId}`,
        tripId,
        userId,
        itinerary,
        model,
        updatedAt: new Date().toISOString(),
      });

      placesQueryBuilder.buildPlacesQueries = async ({ destination }) => ({
        model: "gemini-test",
        queries: {
          attractions: `${destination.name} historic temples and landmarks`,
          food: `${destination.name} authentic ramen and local dining`,
          experiences: `${destination.name} cultural activities and sunset views`,
        },
      });

      googlePlacesService.searchPlacesForQueries = async () => ({
        queries: {
          attractions: "Tokyo historic temples",
          food: "Tokyo authentic ramen",
          experiences: "Tokyo cultural activities",
        },
        places: {
          attractions: [
            {
              id: "tokyo-sensoji",
              displayName: { text: "Senso-ji Temple" },
              formattedAddress: "2-3-1 Asakusa, Taito, Tokyo",
              location: { latitude: 35.7148, longitude: 139.7967 },
              addressComponents: [{ types: ["neighborhood"], longText: "Asakusa" }],
            },
            {
              id: "tokyo-skytree",
              displayName: { text: "Tokyo Skytree" },
              formattedAddress: "1-1-2 Oshiage, Sumida, Tokyo",
              location: { latitude: 35.71, longitude: 139.8107 },
              addressComponents: [{ types: ["neighborhood"], longText: "Oshiage" }],
            },
            {
              id: "tokyo-shinjuku-gyoen",
              displayName: { text: "Shinjuku Gyoen National Garden" },
              formattedAddress: "11 Naitomachi, Shinjuku, Tokyo",
              location: { latitude: 35.6852, longitude: 139.71 },
              addressComponents: [{ types: ["neighborhood"], longText: "Shinjuku" }],
            },
          ],
          food: [
            {
              id: "tokyo-ginza-six",
              displayName: { text: "Ginza Six Rooftop & Dining" },
              formattedAddress: "6-10-1 Ginza, Chuo, Tokyo",
              location: { latitude: 35.6696, longitude: 139.764 },
              addressComponents: [{ types: ["neighborhood"], longText: "Ginza" }],
            },
            {
              id: "tokyo-omotesando-cafe",
              displayName: { text: "Aoyama Flower Market Tea House" },
              formattedAddress: "5-1-2 Minamiaoyama, Minato, Tokyo",
              location: { latitude: 35.6652, longitude: 139.7123 },
              addressComponents: [{ types: ["neighborhood"], longText: "Aoyama" }],
            },
          ],
          experiences: [
            {
              id: "tokyo-golden-gai",
              displayName: { text: "Shinjuku Golden Gai" },
              formattedAddress: "1-1-6 Kabukicho, Shinjuku, Tokyo",
              location: { latitude: 35.6942, longitude: 139.7047 },
              addressComponents: [{ types: ["neighborhood"], longText: "Shinjuku" }],
            },
            {
              id: "tokyo-shibuya-sky",
              displayName: { text: "Shibuya Sky" },
              formattedAddress: "2-24-12 Shibuya, Shibuya, Tokyo",
              location: { latitude: 35.6585, longitude: 139.7023 },
              addressComponents: [{ types: ["neighborhood"], longText: "Shibuya" }],
            },
          ],
        },
      });

      llm.generateStructured = async () => ({
        model: "gemini-2.5-flash",
        data: makeValidAIItinerary(),
      });
    });

    it("orchestrates full itinerary generation with tripId and destinationId (Phase 4)", async () => {
      let savedUpdate = null;
      tripModel.updateTripItinerary = async (userId, tripId, itinerary, model) => {
        savedUpdate = { userId, tripId, itinerary, model };
        return {
          PK: `USER#${userId}`,
          SK: `TRIP#${tripId}`,
          tripId,
          userId,
          itinerary,
          model,
        };
      };

      const { req, res } = mockReqRes({
        body: {
          tripId: "t-orchestrated-101",
          destinationId: "tokyo-jp",
          startDate: "2026-10-24",
        },
      });

      await createItinerary(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(res.body.itinerary);
      assert.equal(res.body.itinerary.days.length, 2);
      assert.equal(res.body.destination, "Tokyo, Japan");

      // Verify DynamoDB persistence
      assert.ok(savedUpdate);
      assert.equal(savedUpdate.tripId, "t-orchestrated-101");
      assert.equal(savedUpdate.userId, "u-101");
      assert.equal(res.body.trip.tripId, "t-orchestrated-101");
      assert.equal(res.body.trip.PK, undefined);

      // Verify Phase 5 Extra Trip Details are attached to itinerary.practicalInfo only (clean root)
      assert.equal(res.body.practicalInfo, undefined);
      const practicalInfo = res.body.itinerary.practicalInfo;
      assert.ok(practicalInfo);
      assert.equal(practicalInfo.destinationId, "tokyo-jp");
      assert.equal(practicalInfo.name, "Tokyo");
      assert.equal(practicalInfo.country, "Japan");
      assert.equal(practicalInfo.countryCode, "JP");
      assert.equal(practicalInfo.budget, "$$");
      assert.equal(practicalInfo.safety, 1);
      assert.equal(practicalInfo.currency.code, "JPY");
      assert.equal(practicalInfo.currency.symbol, "¥");
      assert.ok(Array.isArray(practicalInfo.languages));
      assert.match(practicalInfo.languages[0], /Japanese/);
      assert.ok(Array.isArray(practicalInfo.paymentMethods.cardsAccepted));
      assert.ok(practicalInfo.paymentMethods.cardsAccepted.includes("Visa"));
      assert.ok(practicalInfo.paymentMethods.cardsAccepted.includes("JCB"));
      assert.match(practicalInfo.paymentMethods.cashAdvice, /Cash remains important/);
      assert.ok(Array.isArray(practicalInfo.culturalTips));
      assert.ok(practicalInfo.culturalTips.some((tip) => tip.includes("NO TIPPING")));

      // Verify practicalInfo is saved into DynamoDB with the itinerary
      assert.deepEqual(savedUpdate.itinerary.practicalInfo, practicalInfo);
    });

    it("attaches Phase 5 extra trip details when candidatePlaces are directly provided with destinationId", async () => {
      const { req, res } = mockReqRes({
        body: {
          destinationId: "tokyo-jp",
          candidatePlaces: mockCandidatePlaces,
          numberOfDays: 2,
        },
      });

      await createItinerary(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(res.body.itinerary.practicalInfo);
      assert.equal(res.body.itinerary.practicalInfo.destinationId, "tokyo-jp");
      assert.equal(res.body.itinerary.practicalInfo.currency.code, "JPY");
    });

    it("returns 400 when destinationId cannot be resolved to any known destination", async () => {
      const { req, res } = mockReqRes({
        body: {
          destinationId: "unknown-planet-xyz",
          candidatePlaces: mockCandidatePlaces,
        },
      });

      await createItinerary(req, res);

      assert.equal(res.statusCode, 400);
      assert.match(res.body.message, /Destination is required/);
    });

    it("returns 404 when tripId does not exist during orchestrated call", async () => {
      tripModel.findTripById = async () => null;

      const { req, res } = mockReqRes({
        body: {
          tripId: "t-missing",
          destinationId: "tokyo-jp",
        },
      });

      await createItinerary(req, res);

      assert.equal(res.statusCode, 404);
      assert.match(res.body.message, /was not found/);
    });
  });
});
