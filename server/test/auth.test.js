require("dotenv").config();
const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const { docClient, TABLE_NAME } = require("../db/dynamo");
const {
  register,
  login,
  getMe,
  updateMe,
} = require("../controllers/authController");
const {
  authenticateToken,
  generateToken,
} = require("../middleware/authMiddleware");
const {
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  sanitizeUser,
} = require("../models/userModel");

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

describe("Authentication & Core User Data", () => {
  // Mock DynamoDB operations on docClient.send
  beforeEach(() => {
    inMemoryStore.clear();

    docClient.send = async (command) => {
      const cmdName = command.constructor.name;
      const input = command.input;

      if (cmdName === "TransactWriteCommand") {
        for (const item of input.TransactItems) {
          if (item.Put) {
            const { TableName, Item, ConditionExpression } = item.Put;
            const key = mockKey(TableName, Item.PK, Item.SK);

            if (ConditionExpression === "attribute_not_exists(PK)") {
              if (inMemoryStore.has(key)) {
                const err = new Error("Transaction cancelled due to condition failure");
                err.name = "TransactionCanceledException";
                err.CancellationReasons = [{ Code: "ConditionalCheckFailed" }];
                throw err;
              }
            }
          }
        }

        for (const item of input.TransactItems) {
          if (item.Put) {
            const { TableName, Item } = item.Put;
            const key = mockKey(TableName, Item.PK, Item.SK);
            inMemoryStore.set(key, { ...Item });
          }
        }
        return {};
      }

      if (cmdName === "GetCommand") {
        const key = mockKey(input.TableName, input.Key.PK, input.Key.SK);
        const item = inMemoryStore.get(key);
        return { Item: item ? { ...item } : undefined };
      }

      if (cmdName === "PutCommand") {
        const key = mockKey(input.TableName, input.Item.PK, input.Item.SK);
        inMemoryStore.set(key, { ...input.Item });
        return {};
      }

      if (cmdName === "ScanCommand") {
        const items = [];
        for (const [_, item] of inMemoryStore) {
          if (
            input.ExpressionAttributeValues &&
            input.ExpressionAttributeValues[":email"]
          ) {
            if (
              item.email === input.ExpressionAttributeValues[":email"] &&
              item.PK &&
              item.PK.startsWith("USER#")
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

      throw new Error(`Unhandled mock command: ${cmdName}`);
    };
  });

  describe("POST /api/auth/register", () => {
    it("should successfully register a new user and return JWT", async () => {
      const { req, res } = mockReqRes({
        body: {
          fName: "Conrad",
          lName: "Murrell",
          email: "conrad@example.com",
          password: "password123",
          nationalities: ["American"],
        },
      });

      await register(req, res);

      assert.equal(res.statusCode, 201);
      assert.ok(res.body.token);
      assert.equal(res.body.message, "User registered successfully");
      assert.equal(res.body.user.email, "conrad@example.com");
      assert.equal(res.body.user.fName, "Conrad");
      assert.equal(res.body.user.lName, "Murrell");
      assert.deepEqual(res.body.user.nationalities, ["American"]);
      assert.equal(res.body.user.firstTime, true);
      assert.equal(res.body.user.password, undefined); // Sensitive data omitted
    });

    it("should default nationalities to [] and firstTime to true if omitted", async () => {
      const { req, res } = mockReqRes({
        body: {
          fName: "Jane",
          lName: "Doe",
          email: "jane@example.com",
          password: "password123",
        },
      });

      await register(req, res);

      assert.equal(res.statusCode, 201);
      assert.deepEqual(res.body.user.nationalities, []);
      assert.equal(res.body.user.firstTime, true);
    });

    it("should reject registration with missing required fields", async () => {
      const { req, res } = mockReqRes({
        body: {
          fName: "Conrad",
        },
      });

      await register(req, res);

      assert.equal(res.statusCode, 400);
      assert.ok(res.body.message.includes("required"));
    });

    it("should reject registration with invalid email format", async () => {
      const { req, res } = mockReqRes({
        body: {
          fName: "Conrad",
          lName: "Murrell",
          email: "invalid-email-string",
          password: "password123",
        },
      });

      await register(req, res);

      assert.equal(res.statusCode, 400);
      assert.ok(res.body.message.includes("valid email"));
    });

    it("should reject registration with password shorter than 6 characters", async () => {
      const { req, res } = mockReqRes({
        body: {
          fName: "Conrad",
          lName: "Murrell",
          email: "conrad@example.com",
          password: "123",
        },
      });

      await register(req, res);

      assert.equal(res.statusCode, 400);
      assert.ok(res.body.message.includes("at least 6 characters"));
    });

    it("should return 409 conflict when registering with an existing email", async () => {
      const first = mockReqRes({
        body: {
          fName: "Conrad",
          lName: "Murrell",
          email: "duplicate@example.com",
          password: "password123",
        },
      });
      await register(first.req, first.res);
      assert.equal(first.res.statusCode, 201);

      // Attempt duplicate with uppercase to test case insensitivity
      const duplicate = mockReqRes({
        body: {
          fName: "Another",
          lName: "Person",
          email: "DUPLICATE@example.com",
          password: "password456",
        },
      });
      await register(duplicate.req, duplicate.res);

      assert.equal(duplicate.res.statusCode, 409);
      assert.equal(duplicate.res.body.error, "Conflict");
      assert.ok(duplicate.res.body.message.includes("already exists"));
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      const { req, res } = mockReqRes({
        body: {
          fName: "Test",
          lName: "User",
          email: "login@example.com",
          password: "securepassword",
        },
      });
      await register(req, res);
    });

    it("should successfully log in with valid credentials and return JWT", async () => {
      const { req, res } = mockReqRes({
        body: {
          email: "login@example.com",
          password: "securepassword",
        },
      });

      await login(req, res);

      assert.equal(res.statusCode, 200);
      assert.ok(res.body.token);
      assert.equal(res.body.message, "Login successful");
      assert.equal(res.body.user.email, "login@example.com");
      assert.equal(res.body.user.password, undefined);
    });

    it("should reject login with missing email or password", async () => {
      const { req, res } = mockReqRes({
        body: {
          email: "login@example.com",
        },
      });

      await login(req, res);

      assert.equal(res.statusCode, 400);
      assert.ok(res.body.message.includes("required"));
    });

    it("should reject login with incorrect password", async () => {
      const { req, res } = mockReqRes({
        body: {
          email: "login@example.com",
          password: "wrongpassword",
        },
      });

      await login(req, res);

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.message, "Invalid email or password");
    });

    it("should reject login with non-existent email", async () => {
      const { req, res } = mockReqRes({
        body: {
          email: "nonexistent@example.com",
          password: "securepassword",
        },
      });

      await login(req, res);

      assert.equal(res.statusCode, 401);
      assert.equal(res.body.message, "Invalid email or password");
    });
  });

  describe("Express JWT Middleware", () => {
    const secret = process.env.JWT_SECRET || "voyouger_super_secret_jwt_key_2026";

    it("should reject request without Authorization header", () => {
      const { req, res } = mockReqRes({ headers: {} });
      let nextCalled = false;

      authenticateToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.error, "Unauthorized");
    });

    it("should reject request with malformed Authorization header", () => {
      const { req, res } = mockReqRes({
        headers: { authorization: "TokenOnlyWithoutBearer" },
      });
      let nextCalled = false;

      authenticateToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.ok(res.body.message.includes("Invalid token format"));
    });

    it("should reject request with invalid signature token", () => {
      const { req, res } = mockReqRes({
        headers: { authorization: "Bearer invalid.fake.token" },
      });
      let nextCalled = false;

      authenticateToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 403);
      assert.equal(res.body.error, "Forbidden");
    });

    it("should reject request with expired token", () => {
      const expiredToken = jwt.sign(
        { userId: "123", email: "expired@example.com" },
        secret,
        { expiresIn: "0s" }
      );

      const { req, res } = mockReqRes({
        headers: { authorization: `Bearer ${expiredToken}` },
      });
      let nextCalled = false;

      authenticateToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, false);
      assert.equal(res.statusCode, 401);
      assert.ok(res.body.message.includes("expired"));
    });

    it("should pass request with valid token and attach user payload to req", () => {
      const validToken = generateToken({
        id: "user-12345",
        email: "valid@example.com",
      });

      const { req, res } = mockReqRes({
        headers: { authorization: `Bearer ${validToken}` },
      });
      let nextCalled = false;

      authenticateToken(req, res, () => {
        nextCalled = true;
      });

      assert.equal(nextCalled, true);
      assert.equal(req.user.userId, "user-12345");
      assert.equal(req.user.email, "valid@example.com");
    });
  });

  describe("Authenticated Endpoints & User Data Management", () => {
    let registeredUser;

    beforeEach(async () => {
      const { req, res } = mockReqRes({
        body: {
          fName: "Alice",
          lName: "Smith",
          email: "alice@example.com",
          password: "password123",
          nationalities: ["Canada"],
        },
      });
      await register(req, res);
      registeredUser = res.body.user;
    });

    it("should retrieve profile of authenticated user via getMe", async () => {
      const { req, res } = mockReqRes({
        user: { userId: registeredUser.id, email: registeredUser.email },
      });

      await getMe(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.user.id, registeredUser.id);
      assert.equal(res.body.user.email, "alice@example.com");
      assert.equal(res.body.user.fName, "Alice");
      assert.equal(res.body.user.lName, "Smith");
      assert.deepEqual(res.body.user.nationalities, ["Canada"]);
      assert.equal(res.body.user.password, undefined);
    });

    it("should update profile attributes via updateMe", async () => {
      const { req, res } = mockReqRes({
        user: { userId: registeredUser.id, email: registeredUser.email },
        body: {
          firstTime: false,
          nationalities: ["Canada", "France"],
          fName: "Alicia",
        },
      });

      await updateMe(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.user.fName, "Alicia");
      assert.equal(res.body.user.firstTime, false);
      assert.deepEqual(res.body.user.nationalities, ["Canada", "France"]);
    });
  });
});
