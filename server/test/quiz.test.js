require("dotenv").config();
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { docClient, TABLE_NAME } = require("../db/dynamo");
const { saveQuiz, getQuiz } = require("../controllers/quizController");
const { register } = require("../controllers/authController");

// In-memory DynamoDB store for mock tests
const inMemoryStore = new Map();

function mockKey(tableName, pk, sk) {
  return `${tableName}::${pk}::${sk}`;
}

function mockReqRes(reqOptions = {}) {
  const req = {
    body: {},
    headers: {},
    params: {},
    query: {},
    user: null,
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
    send(data) {
      this.body = data;
      return this;
    },
  };
  return { req, res };
}

describe("Quiz Assessment Endpoints (Phase 1A)", () => {
  let user;

  beforeEach(async () => {
    inMemoryStore.clear();

    // Mock DynamoDB operations on docClient.send
    docClient.send = async (command) => {
      const cmdName = command.constructor.name;
      const input = command.input;

      if (cmdName === "PutCommand") {
        const key = mockKey(input.TableName, input.Item.PK, input.Item.SK);
        inMemoryStore.set(key, { ...input.Item });
        return {};
      }

      if (cmdName === "GetCommand") {
        const key = mockKey(input.TableName, input.Key.PK, input.Key.SK);
        const item = inMemoryStore.get(key);
        return { Item: item ? { ...item } : undefined };
      }

      if (cmdName === "QueryCommand") {
        const items = [];
        for (const [_, item] of inMemoryStore) {
          if (
            input.ExpressionAttributeValues &&
            input.ExpressionAttributeValues[":email"]
          ) {
            if (
              item.GSI1PK === input.ExpressionAttributeValues[":email"] &&
              (!input.ExpressionAttributeValues[":sk"] ||
                item.GSI1SK === input.ExpressionAttributeValues[":sk"])
            ) {
              items.push({ ...item });
            }
          }
        }
        return { Items: items };
      }

      if (cmdName === "UpdateCommand") {
        const key = mockKey(input.TableName, input.Key.PK, input.Key.SK);
        const existing = inMemoryStore.get(key) || { ...input.Key };

        if (input.ExpressionAttributeValues) {
          for (const [valKey, val] of Object.entries(input.ExpressionAttributeValues)) {
            const fieldName = valKey.replace(":", "");
            existing[fieldName] = val;
          }
        }
        inMemoryStore.set(key, existing);
        return { Attributes: { ...existing } };
      }

      return {};
    };

    // Register a test user for this suite
    const registerReq = mockReqRes({
      body: {
        fName: "Test",
        lName: "Traveler",
        email: "traveler@test.com",
        password: "securepassword123",
        nationalities: ["United States"],
      },
    });

    await register(registerReq.req, registerReq.res);
    user = registerReq.res.body.user;
  });

  describe("POST /api/quiz", () => {
    it("should successfully save quiz answers and set firstTime to false", async () => {
      const sampleQuiz = {
        startingLocation: "Dallas, TX",
        countriesOfInterest: ["Japan", "France"],
        months: ["October", "November"],
        minNights: 5,
        maxNights: 10,
        temperaturePreferences: ["warm", "cool"],
        weatherPreferences: ["sunny"],
        willingToGetVisa: false,
        riskTolerance: 2,
        dailyBudget: "$$",
        travelAlterEgo: "Explorer",
        dietaryRestrictions: ["Vegetarian"],
      };

      const { req, res } = mockReqRes({
        user: { userId: user.id, email: user.email },
        body: sampleQuiz,
      });

      await saveQuiz(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.message, "Quiz responses saved successfully");
      assert.equal(res.body.firstTime, false);
      assert.equal(res.body.quizResponse.startingLocation, "Dallas, TX");
      assert.equal(res.body.quizResponse.travelAlterEgo, "Explorer");
      assert.equal(res.body.quizResponse.willingToGetVisa, false);
      assert.deepEqual(res.body.quizResponse.countriesOfInterest, ["Japan", "France"]);
    });

    it("should reject saving an empty quiz body", async () => {
      const { req, res } = mockReqRes({
        user: { userId: user.id, email: user.email },
        body: {},
      });

      await saveQuiz(req, res);

      assert.equal(res.statusCode, 400);
      assert.ok(res.body.message.includes("cannot be empty"));
    });

    it("should reject invalid data types (e.g. minNights as negative number)", async () => {
      const { req, res } = mockReqRes({
        user: { userId: user.id, email: user.email },
        body: {
          minNights: -5,
        },
      });

      await saveQuiz(req, res);

      assert.equal(res.statusCode, 400);
      assert.ok(res.body.message.includes("Invalid quiz data"));
    });
  });

  describe("GET /api/quiz", () => {
    it("should return null quizResponse and firstTime true for a new user", async () => {
      const { req, res } = mockReqRes({
        user: { userId: user.id, email: user.email },
      });

      await getQuiz(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.quizResponse, null);
      assert.equal(res.body.firstTime, true);
    });

    it("should return the saved quiz responses after a user submits the quiz", async () => {
      const sampleQuiz = {
        startingLocation: "San Francisco, CA",
        travelAlterEgo: "Foodie",
        dailyBudget: "$$$",
      };

      // 1. Save quiz
      const postReq = mockReqRes({
        user: { userId: user.id, email: user.email },
        body: sampleQuiz,
      });
      await saveQuiz(postReq.req, postReq.res);
      assert.equal(postReq.res.statusCode, 200);

      // 2. Fetch quiz
      const getReq = mockReqRes({
        user: { userId: user.id, email: user.email },
      });
      await getQuiz(getReq.req, getReq.res);

      assert.equal(getReq.res.statusCode, 200);
      assert.equal(getReq.res.body.firstTime, false);
      assert.equal(getReq.res.body.quizResponse.startingLocation, "San Francisco, CA");
      assert.equal(getReq.res.body.quizResponse.travelAlterEgo, "Foodie");
      assert.equal(getReq.res.body.quizResponse.dailyBudget, "$$$");
    });
  });
});

