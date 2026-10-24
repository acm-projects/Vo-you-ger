require("dotenv").config();
const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { buildOutline, validateOutline, countryCandidates, resolveDuration, isCountryTrip, supportedBases } = require("../services/tripOutlineService");
const { minimumNights } = require('../config/tripPolicy');
const { buildSchedule, validateAndEnrich, checkHours } = require("../services/countryItineraryService");
const discovery = require("../services/stopDiscoveryService");
const queries = require("../services/placesQueryBuilder");
const google = require("../services/googlePlacesService");
const llm = require("../services/llmclient");
const trips = require("../models/tripModel");
const { createItinerary } = require("../controllers/itineraryController");
const { getDestinationPlaces } = require("../controllers/recommendationController");
const { previewCountryRoute } = require("../controllers/countryTripController");
const catalog = require("../services/planningDataService");
const destinations = require("../data/destinations.json");

const originals = {
  queries: queries.buildPlacesQueries, search: google.searchPlacesForQueries,
  llm: llm.generateStructured, find: trips.findTripById, update: trips.updateTripItinerary, create: trips.createTrip,
};
afterEach(() => {
  queries.buildPlacesQueries = originals.queries;
  google.searchPlacesForQueries = originals.search;
  llm.generateStructured = originals.llm;
  trips.findTripById = originals.find;
  trips.updateTripItinerary = originals.update;
  trips.createTrip = originals.create;
});

function fixture(countryId = "country-pt", days = 7, quiz = {}) {
  const outline = buildOutline({ countryId, numberOfDays: days, quiz });
  const schedule = buildSchedule(outline, "2026-10-24");
  const targets = [...outline.stops.map((stop) => ({ ...stop, locationId: stop.stopId })),
    ...outline.excursions.map((excursion) => ({ ...excursion, locationId: `excursion:${excursion.stopId}:${excursion.destinationId}` }))];
  const discovered = targets.map((stop) => {
    const base = catalog.bases.find((base) => base.destinationId === stop.destinationId) || catalog.excursions.find((excursion) => excursion.destinationId === stop.destinationId);
    return {
      stopId: stop.stopId, locationId: stop.locationId,
      candidatePlaces: schedule.filter((day) => day.locationId === stop.locationId).map((day) => ({
        placeId: `venue-${day.day}`, stopId: stop.stopId,
        locationId: stop.locationId,
        name: `Canonical venue ${day.day}`, category: day.day % 2 ? "food" : "attractions",
        lat: base.lat, lng: base.lng, countryCode: outline.countryCode,
        address: "Canonical address", neighborhood: "Verified neighborhood", rating: 4.5,
        openingHours: ["Saturday: Open 24 hours", "Sunday: Open 24 hours", "Monday: Open 24 hours"],
      })),
    };
  });
  const data = {
    tripTitle: "A focused trip", summary: "A suggestion tailored to you.",
    days: schedule.map((day) => ({
      day: day.day, stopId: day.stopId, theme: "Explore locally",
      morning: [], afternoon: [], evening: [],
      [day.allowedSlots[0]]: [{ placeId: `venue-${day.day}`, activityDescription: "Consider a visit." }],
    })),
  };
  return { outline, schedule, discovered, data };
}

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

describe("Country outline feasibility", () => {
  it("selects a complete regional route for a seven-day France trip", () => {
    const outline = buildOutline({ countryId: "country-fr", numberOfNights: 6, startDate: "2027-06-05", quiz: { seeAllOrDeeply: "seeAll", travelAlterEgo: "Foodie", budgetLevel: "$$$" } });
    assert.equal(outline.stops.length, 2);
    assert.ok(outline.stops.every((stop) => stop.countryCode === "FR"));
    assert.equal(outline.startDate, "2027-06-05");
  });
  it("does not let an isolated high-scoring city hide a feasible multi-city route", () => {
    const connections = catalog.connections;
    try {
      catalog.connections = connections.filter((connection) => connection.from !== "seville-es" && connection.to !== "seville-es");
      const outline = buildOutline({ countryId: "country-es", numberOfNights: 6, quiz: { seeAllOrDeeply: "seeAll", travelAlterEgo: "Historian" } });
      assert.equal(outline.stops.length, 2);
      assert.deepEqual(new Set(outline.stops.map((stop) => stop.destinationId)), new Set(["barcelona-es", "madrid-es"]));
    } finally { catalog.connections = connections; }
  });
  it("permits three bases only on longer trips and keeps their transfers consistent", () => {
    const outline = buildOutline({ countryId: "country-it", numberOfNights: 9, quiz: { seeAllOrDeeply: "seeAll" } });
    assert.equal(outline.stops.length, 3);
    assert.equal(outline.transfers.length, 2);
    assert.equal(outline.stops.reduce((sum, stop) => sum + stop.nights, 0), 9);
    validateOutline(outline, { seeAllOrDeeply: "seeAll" });
  });
  it("accepts nights explicitly and rejects conflicting duration or invalid dates", () => {
    assert.equal(resolveDuration({}, undefined, 6), 7);
    assert.throws(() => resolveDuration({}, 7, 5), /disagree/);
    assert.throws(() => resolveDuration({}, undefined, "6"));
    assert.throws(() => buildOutline({ countryId: "country-fr", startDate: "2027-02-30" }));
  });
  it("uses explicit intercity modes independently of arrival transport preferences", () => {
    const outline = buildOutline({ countryId: "country-pt", numberOfNights: 6, quiz: { transportModes: ["plane"], intercityTransportModes: ["train"] } });
    assert.equal(outline.stops.length, 2);
    assert.equal(outline.transfers[0].mode, "train");
  });
  it("keeps older country/place recommendation records on the legacy path", () => {
    assert.equal(isCountryTrip({ recommendations: [{ type: "country", destinationId: "mauritius-mu" }] }), false);
    assert.equal(isCountryTrip({ schemaVersion: 2 }), true);
  });
  it("allocates valid stays across the supported duration range", () => {
    for (const country of catalog.countries.filter(country=>country.planningAvailable)) {
      for (let days = 1; days <= 21; days++) {
        for (const quiz of [{}, { seeAllOrDeeply: "deeply" }, { transportModes: ["car"] }]) {
          if (!supportedBases(country.countryCode, quiz).some(base => minimumNights(base, days) <= days - 1)) {
            assert.throws(() => buildOutline({countryId:country.id,numberOfDays:days,quiz}),error=>error.code==='NO_FEASIBLE_ROUTE');
            continue;
          }
          const outline = buildOutline({ countryId: country.id, numberOfDays: days, quiz });
          validateOutline(outline, quiz);
          assert.equal(outline.stops.at(-1).endDay, days);
        }
      }
    }
  });
  it("keeps five-day Argentina trips in Buenos Aires, excluding broad unsupported regions", () => {
    const outline = buildOutline({ countryId: "country-ar", numberOfDays: 5 });
    assert.deepEqual(outline.stops.map((stop) => stop.destinationId), ["buenos-aires-ar"]);
    assert.equal(outline.stops[0].nights, 4);
    assert.equal(outline.transfers.length, 0);
  });
  it("counts nights separately from days and rejects invalid duration ranges", () => {
    assert.equal(resolveDuration({ minNights: 4, maxNights: 6 }), 5);
    for (const numberOfDays of [0, -1, 22, 5.5, "5"]) assert.throws(() => resolveDuration({}, numberOfDays));
    assert.throws(() => resolveDuration({ minNights: 6 }, 5));
    assert.throws(() => resolveDuration({ maxNights: 4 }, 6));
  });
  it("allows a supported second base on longer trips and accounts for every night", () => {
    const outline = buildOutline({ countryId: "country-pt", numberOfDays: 8 });
    assert.equal(outline.stops.length, 2);
    assert.equal(outline.stops.reduce((sum, stop) => sum + stop.nights, 0), 7);
    assert.equal(outline.transfers[0].day, outline.stops[1].startDay);
    assert.notEqual(outline.arrivalDestinationId, outline.departureDestinationId);
    validateOutline(outline);
  });
  it("allows two bases at five days, while four days and relaxed trips retain one base", () => {
    for (const countryId of ["country-pt", "country-es", "country-it"]) {
      const outline = buildOutline({ countryId, numberOfDays: 5 });
      assert.equal(outline.stops.length, 2);
      assert.deepEqual(outline.stops.map((stop) => stop.nights), [2, 2]);
      assert.equal(outline.transfers[0].day, 3);
      validateOutline(outline);
      assert.equal(buildOutline({ countryId, numberOfDays: 4 }).stops.length, 1);
      assert.equal(buildOutline({ countryId, numberOfDays: 5, quiz: { seeAllOrDeeply: "deeply" } }).stops.length, 1);
      assert.equal(buildOutline({ countryId, numberOfDays: 5, quiz: { transportModes: ["car"] } }).stops.length, 1);
    }
  });
  it("honors relaxed pace and restricted transport modes", () => {
    for (const quiz of [{ seeAllOrDeeply: "deeply" }, { transportModes: ["car"] }, { transportModes: ["plane"] }]) {
      assert.equal(buildOutline({ countryId: "country-pt", numberOfDays: 9, quiz }).stops.length, 1);
    }
  });
  it("never relaxes budget, safety, or visa constraints", () => {
    const candidates = countryCandidates({ budgetLevel: "$", highRiskDestWillingness: false });
    assert.ok(candidates.length > 0);
    assert.ok(candidates.every((country) => country.supportedBases.every((base) => base.budget === "$" && base.safety <= 1)));
    assert.deepEqual(countryCandidates({}, new Set(["PT"])).map((country) => country.countryCode), ["PT"]);
    assert.throws(() => buildOutline({ countryId: "country-ar", quiz: { highRiskDestWillingness: false } }));
  });
  it("rejects mixed countries, unsupported connections, wrong nights, and modified allowances", () => {
    for (const mutate of [
      (outline) => { outline.stops[1].destinationId = "rome-it"; },
      (outline) => { outline.stops[0].nights = 1; },
      (outline) => { outline.transfers[0].mode = "plane"; },
      (outline) => { outline.transfers[0].planningMinutes = 5; },
      (outline) => { outline.stops[1].stopId = outline.stops[0].stopId; },
    ]) {
      const outline = buildOutline({ countryId: "country-pt", numberOfDays: 8 });
      mutate(outline); assert.throws(() => validateOutline(outline));
    }
  });
  it("has valid catalog references and only domestic sourced connections", () => {
    for (const base of catalog.bases) assert.ok(destinations.some((destination) => destination.id === base.destinationId));
    for (const connection of catalog.connections) {
      const from = destinations.find((destination) => destination.id === connection.from);
      const to = destinations.find((destination) => destination.id === connection.to);
      assert.equal(from.countryCode, to.countryCode);
      assert.equal(connection.domesticOnly, true);
      assert.match(connection.sourceUrl, /^https:\/\//);
      assert.ok(connection.planningMinutes > 0);
    }
  });
});

describe("Country itinerary consistency", () => {
  it("adds a grounded excursion without changing the overnight base", () => {
    const quiz = { seeAllOrDeeply: "deeply" };
    const f = fixture("country-pt", 7, quiz);
    assert.equal(f.outline.stops.length, 1);
    assert.equal(f.outline.excursions[0].destinationId, "sintra-pt");
    const itinerary = validateAndEnrich(f.data, f.outline, f.schedule, f.discovered, quiz);
    const day = itinerary.days.find((day) => day.type === "excursion");
    assert.equal(day.stopId, f.outline.stops[0].stopId);
    assert.equal(day.locationName, "Sintra");
    assert.equal(day.morning.length, 0);
    assert.equal(day.evening.length, 0);
    assert.equal(itinerary.stays.length, 1);
    assert.equal(itinerary.tripSummary.numberOfNights, 6);
  });
  it("rejects using an excursion venue on a base sightseeing day", () => {
    const quiz = { seeAllOrDeeply: "deeply" };
    const f = fixture("country-pt", 7, quiz);
    const excursionDay = f.data.days.find((day) => day.day === f.outline.excursions[0].day);
    f.data.days[1].morning = structuredClone(excursionDay.afternoon);
    assert.throws(() => validateAndEnrich(f.data, f.outline, f.schedule, f.discovered, quiz), /wrong-stop venue/);
  });
  it("rejects duplicate or rescheduled unsupported excursion days", () => {
    const outline = buildOutline({ countryId: "country-pt", numberOfNights: 6, quiz: { seeAllOrDeeply: "deeply" } });
    outline.excursions[0].day = 1;
    assert.throws(() => validateOutline(outline), /Unsupported excursion/);
  });
  it("fixes dates, reserves travel windows, and attaches grounded stay areas", () => {
    const { outline, schedule, discovered, data } = fixture();
    const itinerary = validateAndEnrich(data, outline, schedule, discovered, {});
    assert.equal(itinerary.days[0].date, "2026-10-24");
    assert.equal(itinerary.days[0].type, "arrival");
    assert.equal(itinerary.days.at(-1).type, "departure");
    assert.equal(itinerary.stays.length, 2);
    assert.equal(itinerary.stays[0].recommendedStayArea, "Verified neighborhood");
    assert.equal(itinerary.days[0].evening[0].placeName, "Canonical venue 1");
    assert.equal(itinerary.schemaVersion, 2);
  });
  it("rejects invalid calendar dates before discovery", () => {
    const { outline } = fixture();
    for (const start of [undefined, "2026-02-30", "2026-13-01", "tomorrow"]) assert.throws(() => buildSchedule(outline, start));
    assert.equal(buildSchedule(outline, "2028-02-29")[0].date, "2028-02-29");
  });
  it("rejects wrong day counts, wrong bases, duplicates, and invented venues", () => {
    for (const mutate of [
      ({ data }) => { data.days.pop(); },
      ({ data }) => { data.days[1].stopId = "stop-999"; },
      ({ data }) => { data.days[1].morning[0].placeId = "invented"; },
      ({ data }) => { data.days[1].morning[0].placeId = "venue-1"; },
      ({ data }) => { data.days[0].evening[0].placeId = "venue-5"; },
    ]) {
      const f = fixture(); mutate(f);
      assert.throws(() => validateAndEnrich(f.data, f.outline, f.schedule, f.discovered, {}), (error) => error.statusCode === 502);
    }
  });
  it("rejects sightseeing during the reserved transfer window", () => {
    const f = fixture();
    const day = f.data.days.find((day) => f.outline.transfers.some((transfer) => transfer.day === day.day));
    day.morning = day.evening; day.evening = [];
    assert.throws(() => validateAndEnrich(f.data, f.outline, f.schedule, f.discovered, {}), /reserved travel time/);
  });
  it("rejects excessive geographic spread in a day's activities", () => {
    const f = fixture();
    const distant = { ...f.discovered[0].candidatePlaces[0], placeId: "distant", lng: 0 };
    f.discovered[0].candidatePlaces.push(distant);
    f.data.days[1].afternoon = [{ placeId: distant.placeId, activityDescription: "Visit." }];
    assert.throws(() => validateAndEnrich(f.data, f.outline, f.schedule, f.discovered, {}), /too far apart/);
  });
  it("rejects closures and incompatible hours, retaining unknown hours honestly", () => {
    assert.throws(() => checkHours({ placeId: "p", openingHours: ["Monday: Closed"] }, "Monday", "morning"));
    assert.throws(() => checkHours({ placeId: "p", openingHours: ["Monday: 9:00 AM – 5:00 PM"] }, "Monday", "evening"));
    assert.equal(checkHours({ openingHours: ["Monday: 7:00 PM – 2:00 AM"] }, "Monday", "evening").hoursCheck, "regular_hours_overlap");
    assert.equal(checkHours({}, "Monday", "morning").hoursCheck, "unknown");
  });
  it("does not invent an accommodation area when neighborhood data is missing", () => {
    const f = fixture();
    for (const stop of f.discovered) for (const place of stop.candidatePlaces) place.neighborhood = null;
    const itinerary = validateAndEnrich(f.data, f.outline, f.schedule, f.discovered, {});
    assert.equal(itinerary.stays[0].recommendedStayArea, null);
  });
});

describe("Server-owned country pipeline", () => {
  function mockGoogle() {
    queries.buildPlacesQueries = async () => ({ queries: { attractions: "a", food: "f", experiences: "e" } });
    google.searchPlacesForQueries = async (_queries, base) => ({ places: {
      attractions: Array.from({ length: 10 }, (_, index) => ({
        id: `${base.id}-${index}`, displayName: { text: `Real venue ${index}` },
        location: { latitude: base.lat, longitude: base.lng },
        addressComponents: [
          { types: ["country"], shortText: base.countryCode },
          { types: ["neighborhood"], longText: "Known area" },
        ],
      })), food: [], experiences: [],
    } });
  }
  const trip = {
    tripId: "t-country", schemaVersion: 2,
    recommendations: [{ destinationId: "country-pt", type: "country" }],
    quizSnapshot: { minNights: 6, maxNights: 6 },
  };
  it("discovers and persists excursions and longer three-base itineraries", async () => {
    mockGoogle();
    for (const scenario of [
      { countryId: "country-pt", nights: 6, pace: "deeply", quiz: { sleepInOrEarly: "Sleep in" }, expectedBases: 1, expectedExcursions: 1 },
      { countryId: "country-it", nights: 9, pace: "seeAll", expectedBases: 3, expectedExcursions: 0 },
      { countryId: "country-pt", nights: 6, pace: "seeAll", saved: true, expectedBases: 2, expectedExcursions: 0 },
    ]) {
      const savedTrip = { ...trip,
        isSaved: Boolean(scenario.saved),
        recommendations: [{ destinationId: scenario.countryId, type: "country" }],
        quizSnapshot: { minNights: scenario.nights, maxNights: scenario.nights, seeAllOrDeeply: scenario.pace, ...scenario.quiz },
      };
      trips.findTripById = async () => savedTrip;
      let forked = false;
      trips.createTrip = async (userId, input) => {
        assert.equal(userId, "owner");
        assert.deepEqual(input.quiz, savedTrip.quizSnapshot);
        forked = true;
        return { tripId: "new-draft" };
      };
      trips.updateTripItinerary = async (_userId, tripId, itinerary) => {
        assert.equal(tripId, scenario.saved ? "new-draft" : savedTrip.tripId);
        return { ...savedTrip, tripId, isSaved: false, itinerary };
      };
      llm.generateStructured = async ({ prompt }) => {
        const { schedule, candidates } = JSON.parse(prompt);
        const counts = new Map();
        return { model: "test", data: { tripTitle: "Trip", summary: "A focused route", days: schedule.map((day) => {
          const count = counts.get(day.locationId) || 0;
          counts.set(day.locationId, count + 1);
          const place = candidates.find((candidate) => candidate.locationId === day.locationId).places[count];
          return { day: day.day, stopId: day.stopId, theme: "Discover locally", morning: [], afternoon: [], evening: [],
            [day.allowedSlots[0]]: [{ placeId: place.placeId, activityDescription: "Consider a visit." }] };
        }) } };
      };
      const res = response();
      await createItinerary({ user: { userId: "owner" }, params: { tripId: savedTrip.tripId }, body: {
        countryId: scenario.countryId, numberOfNights: scenario.nights, startDate: "2027-06-05",
      } }, res);
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.equal(res.body.itinerary.stays.length, scenario.expectedBases);
      assert.equal(res.body.itinerary.days.filter((day) => day.type === "excursion").length, scenario.expectedExcursions);
      assert.equal(res.body.itinerary.tripSummary.numberOfNights, scenario.nights);
      assert.ok(res.body.itinerary.tripSummary.endDate);
      assert.equal(forked, Boolean(scenario.saved));
    }
  });
  it("filters foreign, distant, and unlocated search results", async () => {
    mockGoogle();
    const realSearch = google.searchPlacesForQueries;
    google.searchPlacesForQueries = async (queries, base) => {
      const result = await realSearch(queries, base);
      const sample = result.places.attractions[0];
      result.places.attractions.push(
        { ...sample, id: "foreign", addressComponents: [{ types: ["country"], shortText: "FR" }] },
        { ...sample, id: "far", location: { latitude: 0, longitude: 0 } },
        { ...sample, id: "no-coordinates", location: null },
      );
      return result;
    };
    const stops = await discovery.discoverStops(buildOutline({ countryId: "country-pt", numberOfDays: 7 }), {});
    assert.equal(stops.length, 2);
    assert.ok(stops.every((stop) => stop.candidatePlaces.length === 10));
  });
  it("previews without writing and rejects countries outside the saved recommendations", async () => {
    trips.findTripById = async (userId) => userId === "owner" ? trip : null;
    trips.updateTripItinerary = async () => assert.fail("Preview must not write");
    const req = { user: { userId: "owner" }, params: { tripId: trip.tripId }, body: { countryId: "country-pt" } };
    const res = response(); await previewCountryRoute(req, res);
    assert.equal(res.statusCode, 200);
    req.body.countryId = "country-ar";
    const invalid = response(); await previewCountryRoute(req, invalid); assert.equal(invalid.statusCode, 400);
    req.user.userId = "other";
    const missing = response(); await previewCountryRoute(req, missing); assert.equal(missing.statusCode, 404);
  });
  it("supports countryId in the existing places endpoint", async () => {
    mockGoogle(); trips.findTripById = async () => trip;
    const res = response();
    await getDestinationPlaces({ user: { userId: "owner" }, params: { tripId: trip.tripId }, body: { countryId: "country-pt" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.stops.length, 2);
  });
  it("discovers and persists an entire country itinerary, ignoring client venue and quiz overrides", async () => {
    mockGoogle(); trips.findTripById = async () => trip;
    let persisted;
    trips.updateTripItinerary = async (userId, tripId, itinerary) => {
      persisted = { userId, tripId, itinerary };
      return { PK: "internal", SK: "internal", ...trip, itinerary };
    };
    llm.generateStructured = async ({ prompt }) => {
      const { schedule, candidates, quiz } = JSON.parse(prompt);
      assert.deepEqual(quiz, trip.quizSnapshot);
      const counts = new Map();
      return { model: "test-model", data: {
        tripTitle: "Portugal", summary: "A focused trip", days: schedule.map((day) => {
          const index = counts.get(day.stopId) || 0; counts.set(day.stopId, index + 1);
          return { day: day.day, stopId: day.stopId, theme: "Local discoveries", morning: [], afternoon: [], evening: [],
            [day.allowedSlots[0]]: [{ placeId: candidates.find((stop) => stop.stopId === day.stopId).places[index].placeId, activityDescription: "Consider a visit." }] };
        }),
      } };
    };
    const req = { user: { userId: "owner" }, params: { tripId: trip.tripId }, body: {
      countryId: "country-pt", startDate: "2026-10-24", quiz: { minNights: 100 }, candidatePlaces: [{ placeId: "forged" }],
    } };
    const res = response(); await createItinerary(req, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(persisted.itinerary.outline.numberOfNights, 6);
    assert.equal(persisted.itinerary.days.length, 7);
    assert.equal(res.body.trip.PK, undefined);
    assert.equal(res.body.itinerary.stays.length, 2);
    // Invalid narrative cannot replace the backend-owned plan or block saving it.
    llm.generateStructured = async () => ({ model: "test", data: { days: [] } });
    const fallback = response(); await createItinerary(req, fallback); assert.equal(fallback.statusCode, 200);
    assert.equal(fallback.body.itinerary.narrativeSource,'deterministic_fallback');
    assert.equal(persisted.itinerary.days.length,7);
  });
});
