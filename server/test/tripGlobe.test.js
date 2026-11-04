require("dotenv").config();
const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { docClient } = require("../db/dynamo");
const { getSavedTripSummaries } = require("../models/tripModel");
const { getTripGlobeController } = require("../controllers/tripController");
const { tripSummary, globeResponse } = require("../services/tripSummaryService");

const originalSend = docClient.send;
afterEach(() => { docClient.send = originalSend; });

function savedTrip(tripId, countryCode = "FR") {
  const country = countryCode === "FR" ? "France" : "Japan";
  const itinerary = { countryCode, outline: { countryCode, country, numberOfDays: 7, numberOfNights: 6, stops: [{ name: "Base" }] }, days: [{ date: "2027-06-05" }, { date: "2027-06-11" }] };
  return { tripId, title: "AI title", itinerary: { tripSummary: tripSummary(itinerary) }, savedAt: "2026-10-22T12:00:00Z" };
}

describe("Saved trips for the globe", () => {
  it("groups multiple trips under one country pin and omits activities", () => {
    const data = globeResponse([savedTrip("t-1"), savedTrip("t-2"), savedTrip("t-3", "JP")]);
    assert.equal(data.countries.length, 2);
    assert.equal(data.tripCount, 3);
    const france = data.countries.find((country) => country.countryCode === "FR");
    assert.equal(france.trips.length, 2);
    assert.ok(Number.isFinite(france.pin.lat));
    assert.equal(france.trips[0].displayTitle, "France — June 2027");
    assert.equal(france.trips[0].endDate, "2027-06-11");
    assert.equal(france.trips[0].numberOfNights, 6);
    assert.equal(france.trips[0].itinerary, undefined);
  });
  it("handles projected legacy records without inventing their duration", () => {
    const result = globeResponse([{ tripId: "old", itinerary: { destination: "Tokyo, Japan", days: [{ date: "2027-03-01" }] } }]);
    assert.equal(result.countries[0].countryCode, "JP");
    assert.equal(result.countries[0].trips[0].numberOfNights, null);
    assert.equal(result.countries[0].trips[0].endDate, null);
    const unknown = globeResponse([{ tripId: "missing-info" }]);
    assert.equal(unknown.unmappedTrips.length, 1);
  });
  it("queries only the authenticated user's trips and follows empty filtered pages", async () => {
    const cursor = { PK: "USER#owner", SK: "TRIP#first-page" };
    let calls = 0;
    docClient.send = async (command) => {
      assert.equal(command.constructor.name, "QueryCommand");
      assert.equal(command.input.ExpressionAttributeValues[":pk"], "USER#owner");
      assert.equal(command.input.ExpressionAttributeValues[":saved"], true);
      assert.ok(command.input.FilterExpression);
      assert.ok(command.input.ProjectionExpression.includes("#i.#summary"));
      assert.ok(!command.input.ProjectionExpression.includes("candidatePlaces"));
      calls++;
      if (calls === 1) return { Items: [], LastEvaluatedKey: cursor };
      assert.deepEqual(command.input.ExclusiveStartKey, cursor);
      return { Items: [savedTrip("t-last")] };
    };
    const trips = await getSavedTripSummaries("owner");
    assert.equal(calls, 2);
    assert.equal(trips[0].tripId, "t-last");
  });
  it("returns only public summary fields from the controller", async () => {
    docClient.send = async (command) => {
      assert.equal(command.input.ExpressionAttributeValues[":pk"], "USER#owner");
      return { Items: [{ ...savedTrip("t-1"), PK: "internal", SK: "internal", quizSnapshot: { private: true } }] };
    };
    const res = { statusCode: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await getTripGlobeController({ user: { userId: "owner" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.countries[0].trips[0].tripId, "t-1");
    assert.equal(res.body.countries[0].trips[0].PK, undefined);
    assert.equal(res.body.countries[0].trips[0].quizSnapshot, undefined);
  });
});
