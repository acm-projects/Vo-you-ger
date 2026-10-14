require("dotenv").config();
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const llm = require("../services/llmclient");
const userModel = require("../models/userModel");
const tripModel = require("../models/tripModel");
const { createRecommendations } = require("../controllers/recommendationController");

function mockReqRes(reqOptions = {}) {
  const req = { body: {}, user: { userId: "u-101" }, ...reqOptions };
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
  };
  return { req, res };
}

const fakeUser = { id: "u-101", nationalities: ["United States"], quizResponse: null };

describe("POST /api/recommendations", () => {
  let saved;

  beforeEach(() => {
    saved = null;
    userModel.findUserById = async () => ({ ...fakeUser });
    tripModel.createTrip = async (userId, data) => {
      saved = { userId, ...data };
      return { PK: `USER#${userId}`, SK: "TRIP#t-1", tripId: "t-1", userId, ...data, itinerary: null };
    };
    llm.generateStructured = async () => ({
      model: "fake-model",
      data: {
        title: "Test trip",
        summary: "A test.",
        recommendations: [
          { destinationId: "lisbon-pt", name: "Lisbon", type: "city", country: "Portugal", matchScore: 90, reason: "r", highlights: ["a", "b"] },
          { destinationId: "made-up-id", name: "Nowhere", type: "city", country: "None", matchScore: 99, reason: "r", highlights: ["a", "b"] },
        ],
      },
    });
  });

  it("returns 201, saves the trip, and drops invented destination ids", async () => {
    const { req, res } = mockReqRes({ body: { quiz: { travelAlterEgo: "Foodie", dailyBudget: "$$$" } } });
    await createRecommendations(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.trip.recommendations.length, 1);
    assert.equal(res.body.trip.recommendations[0].destinationId, "lisbon-pt");
    assert.equal(res.body.trip.PK, undefined);
    assert.equal(saved.model, "fake-model");
  });

  it("falls back to the saved quizResponse when the body has no quiz", async () => {
    userModel.findUserById = async () => ({ ...fakeUser, quizResponse: { travelAlterEgo: "Explorer" } });
    const { req, res } = mockReqRes({ body: {} });
    await createRecommendations(req, res);
    assert.equal(res.statusCode, 201);
    assert.deepEqual(saved.quiz, { travelAlterEgo: "Explorer" });
  });

  it("returns 400 when there is no quiz anywhere", async () => {
    const { req, res } = mockReqRes({ body: {} });
    await createRecommendations(req, res);
    assert.equal(res.statusCode, 400);
  });

  it("returns 400 for an invalid quiz", async () => {
    const { req, res } = mockReqRes({ body: { quiz: { riskTolerance: 9 } } });
    await createRecommendations(req, res);
    assert.equal(res.statusCode, 400);
  });

  it("returns 404 when the user does not exist", async () => {
    userModel.findUserById = async () => null;
    const { req, res } = mockReqRes({ body: { quiz: { travelAlterEgo: "Foodie" } } });
    await createRecommendations(req, res);
    assert.equal(res.statusCode, 404);
  });

  it("returns 503 when every model is unavailable", async () => {
    llm.generateStructured = async () => {
      const e = new Error("All LLM models failed"); e.statusCode = 503; throw e;
    };
    const { req, res } = mockReqRes({ body: { quiz: { travelAlterEgo: "Foodie" } } });
    await createRecommendations(req, res);
    assert.equal(res.statusCode, 503);
  });

  it("returns 502 when the model only returns invented destinations", async () => {
    llm.generateStructured = async () => ({
      model: "fake-model",
      data: { title: "t", summary: "s", recommendations: [
        { destinationId: "nope", name: "x", type: "city", country: "y", matchScore: 1, reason: "r", highlights: ["a", "b"] },
      ] },
    });
    const { req, res } = mockReqRes({ body: { quiz: { travelAlterEgo: "Foodie" } } });
    await createRecommendations(req, res);
    assert.equal(res.statusCode, 502);
  });
});