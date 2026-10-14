
require("dotenv").config();

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const llm = require("../services/llmclient");
const userModel = require("../models/userModel");
const tripModel = require("../models/tripModel");
const {
  createRecommendations,
} = require("../controllers/recommendationController");

function mockReqRes(reqOptions = {}) {
  const req = {
    body: {},
    user: { userId: "u-101" },
    ...reqOptions,
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

const fakeUser = {
  id: "u-101",
  nationalities: ["United States"],
  quizResponse: null,
};

function makeRecommendation(
  destinationId,
  name,
  country,
  matchScore = 85
) {
  return {
    destinationId,
    name,
    type: "city",
    country,
    matchScore,
    reason: "Matches the traveler's preferences.",
    highlights: ["Food", "Culture"],
  };
}

function makeValidAIResponse() {
  return {
    model: "fake-model",
    data: {
      title: "Personalized Travel Recommendations",
      summary: "Three destinations matching your preferences.",
      recommendations: [
        makeRecommendation(
          "lisbon-pt",
          "Lisbon",
          "Portugal",
          90
        ),
        makeRecommendation(
          "kyoto-jp",
          "Kyoto",
          "Japan",
          85
        ),
        makeRecommendation(
          "rome-it",
          "Rome",
          "Italy",
          80
        ),
      ],
    },
  };
}

describe("POST /api/recommendations", () => {
  let saved;

  beforeEach(() => {
    saved = null;

    userModel.findUserById = async () => ({
      ...fakeUser,
    });

    tripModel.createTrip = async (userId, data) => {
      saved = {
        userId,
        ...data,
      };

      return {
        PK: `USER#${userId}`,
        SK: "TRIP#t-1",
        tripId: "t-1",
        userId,
        ...data,
        itinerary: null,
      };
    };

    llm.generateStructured = async () =>
      makeValidAIResponse();
  });

  it("returns 201 and saves exactly 3 valid recommendations", async () => {
    const { req, res } = mockReqRes({
      body: {
        quiz: {
          travelAlterEgo: "Foodie",
          dailyBudget: "$$$",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 201);
    assert.equal(res.body.trip.recommendations.length, 3);

    assert.deepEqual(
      res.body.trip.recommendations.map(
        (r) => r.destinationId
      ),
      ["lisbon-pt", "kyoto-jp", "rome-it"]
    );

    assert.equal(res.body.trip.PK, undefined);
    assert.equal(res.body.trip.SK, undefined);
    assert.equal(saved.model, "fake-model");
    assert.equal(res.body.trip.itinerary, null);
  });

  it("falls back to the saved quizResponse when the body has no quiz", async () => {
    userModel.findUserById = async () => ({
      ...fakeUser,
      quizResponse: {
        travelAlterEgo: "Explorer",
      },
    });

    const { req, res } = mockReqRes({
      body: {},
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 201);

    assert.deepEqual(saved.quiz, {
      travelAlterEgo: "Explorer",
    });
  });

  it("returns 400 when there is no quiz anywhere", async () => {
    const { req, res } = mockReqRes({
      body: {},
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(saved, null);
  });

  it("returns 400 for an invalid quiz", async () => {
    const { req, res } = mockReqRes({
      body: {
        quiz: {
          riskTolerance: 9,
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(saved, null);
  });

  it("returns 400 for an array instead of quiz answers", async () => {
    const { req, res } = mockReqRes({
      body: {
        quiz: [],
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 400);
    assert.equal(saved, null);
  });

  it("returns 404 when the user does not exist", async () => {
    userModel.findUserById = async () => null;

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          travelAlterEgo: "Foodie",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 404);
    assert.equal(saved, null);
  });

  it("returns 503 when every model is unavailable", async () => {
    llm.generateStructured = async () => {
      const error = new Error("All LLM models failed");
      error.statusCode = 503;
      throw error;
    };

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          travelAlterEgo: "Foodie",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 503);
    assert.equal(saved, null);
  });

  it("returns 502 when all destination IDs are invented", async () => {
    const response = makeValidAIResponse();

    response.data.recommendations = [
      makeRecommendation("fake-1", "Fake 1", "A"),
      makeRecommendation("fake-2", "Fake 2", "B"),
      makeRecommendation("fake-3", "Fake 3", "C"),
    ];

    llm.generateStructured = async () => response;

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          dailyBudget: "$$$",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(saved, null);
  });

  it("rejects one invented destination instead of saving partial results", async () => {
    const response = makeValidAIResponse();

    response.data.recommendations[2].destinationId =
      "made-up-destination";

    llm.generateStructured = async () => response;

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          dailyBudget: "$$$",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(saved, null);
  });

  it("rejects duplicate destination IDs", async () => {
    const response = makeValidAIResponse();

    response.data.recommendations[2] =
      makeRecommendation(
        "lisbon-pt",
        "Lisbon",
        "Portugal"
      );

    llm.generateStructured = async () => response;

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          dailyBudget: "$$$",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(saved, null);
  });

  it("rejects destinations in duplicate countries", async () => {
    const response = makeValidAIResponse();

    response.data.recommendations[2] =
      makeRecommendation(
        "osaka-jp",
        "Osaka",
        "Japan"
      );

    llm.generateStructured = async () => response;

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          dailyBudget: "$$$",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(saved, null);
  });

  it("rejects fewer than 3 recommendations", async () => {
    const response = makeValidAIResponse();

    response.data.recommendations =
      response.data.recommendations.slice(0, 2);

    llm.generateStructured = async () => response;

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          dailyBudget: "$$$",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(saved, null);
  });

  it("rejects more than 3 recommendations", async () => {
    const response = makeValidAIResponse();

    response.data.recommendations.push(
      makeRecommendation(
        "madrid-es",
        "Madrid",
        "Spain"
      )
    );

    llm.generateStructured = async () => response;

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          dailyBudget: "$$$",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(saved, null);
  });

  it("rejects recommendations outside the filtered candidate list", async () => {
    const response = makeValidAIResponse();

    llm.generateStructured = async () => response;

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          dailyBudget: "$",
          riskTolerance: 1,
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(saved, null);
  });

  it("uses canonical destination metadata from the dataset", async () => {
    const response = makeValidAIResponse();

    response.data.recommendations[0].name =
      "Incorrect Name";

    response.data.recommendations[0].country =
      "Incorrect Country";

    llm.generateStructured = async () => response;

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          dailyBudget: "$$$",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 201);

    assert.equal(
      res.body.trip.recommendations[0].name,
      "Lisbon"
    );

    assert.equal(
      res.body.trip.recommendations[0].country,
      "Portugal"
    );
  });

  it("rejects malformed AI responses", async () => {
    llm.generateStructured = async () => ({
      model: "fake-model",
      data: {
        title: "Broken",
        recommendations: [],
      },
    });

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          dailyBudget: "$$$",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(saved, null);
  });

  it("returns 502 when the LLM client reports invalid output", async () => {
    llm.generateStructured = async () => {
      const error = new Error("Invalid AI response");
      error.statusCode = 502;
      throw error;
    };

    const { req, res } = mockReqRes({
      body: {
        quiz: {
          dailyBudget: "$$$",
        },
      },
    });

    await createRecommendations(req, res);

    assert.equal(res.statusCode, 502);
    assert.equal(saved, null);
  });
});
