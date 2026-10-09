const crypto = require("crypto");
const {
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAME } = require("../db/dynamo");

const GSI_NAME = process.env.DYNAMODB_GSI_NAME || "GSI1";

/**
 * Remove sensitive and internal attributes before returning user data.
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { password, PK, SK, GSI1PK, GSI1SK, ...safeUser } = user;
  return {
    id: safeUser.id || safeUser.userId,
    fName: safeUser.fName,
    lName: safeUser.lName,
    email: safeUser.email,
    nationalities: Array.isArray(safeUser.nationalities) ? safeUser.nationalities : [],
    firstTime: safeUser.firstTime !== undefined ? safeUser.firstTime : true,
    quizResponse: safeUser.quizResponse !== undefined ? safeUser.quizResponse : null,
    createdAt: safeUser.createdAt,
    updatedAt: safeUser.updatedAt,
  };
}

/**
 * Create a new user in DynamoDB matching team single-table schema:
 * PK: USER#<userId>
 * SK: PROFILE
 * GSI1PK: <email>
 * GSI1SK: PROFILE
 */
async function createUser({ fName, lName, email, passwordHash, nationalities, quizResponse }) {
  const normalizedEmail = email.trim().toLowerCase();
  const userId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  // Check if user already exists via email
  const existingUser = await findUserByEmail(normalizedEmail);
  if (existingUser) {
    const error = new Error("An account with this email already exists");
    error.statusCode = 409;
    error.code = "EMAIL_ALREADY_EXISTS";
    throw error;
  }

  const userItem = {
    PK: `USER#${userId}`,
    SK: "PROFILE",
    GSI1PK: normalizedEmail,
    GSI1SK: "PROFILE",
    id: userId,
    fName: fName.trim(),
    lName: lName.trim(),
    email: normalizedEmail,
    password: passwordHash,
    nationalities: Array.isArray(nationalities) ? nationalities : [],
    firstTime: true,
    quizResponse: quizResponse || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  try {
    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: userItem,
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );

    return userItem;
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      const error = new Error("An account with this email already exists");
      error.statusCode = 409;
      error.code = "EMAIL_ALREADY_EXISTS";
      throw error;
    }
    throw err;
  }
}

/**
 * Find user by email.
 * Queries GSI1 (GSI1PK = email AND GSI1SK = PROFILE).
 * Falls back to alternate index names or Scan if index is differently named.
 */
async function findUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Try querying configured GSI (defaults to GSI1)
  const indexNamesToTry = [GSI_NAME, "GSI1PK-GSI1SK-index", "EmailIndex"];
  for (const indexName of indexNamesToTry) {
    try {
      const result = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: indexName,
          KeyConditionExpression: "GSI1PK = :email AND GSI1SK = :sk",
          ExpressionAttributeValues: {
            ":email": normalizedEmail,
            ":sk": "PROFILE",
          },
        })
      );

      if (result.Items && result.Items.length > 0) {
        return result.Items[0];
      }
    } catch (err) {
      // If index not found or error, continue to try next or fallback
      if (err.name !== "ResourceNotFoundException" && err.name !== "ValidationException") {
        // Log unexpected error but allow scan fallback
      }
    }
  }

  // 2. Scan fallback (guarantees retrieval even before GSI is created in DynamoDB)
  try {
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "(email = :email OR GSI1PK = :email) AND begins_with(PK, :userPrefix)",
        ExpressionAttributeValues: {
          ":email": normalizedEmail,
          ":userPrefix": "USER#",
        },
      })
    );

    if (scanResult.Items && scanResult.Items.length > 0) {
      return scanResult.Items[0];
    }
  } catch (scanErr) {
    // Return null if table not accessible
  }

  return null;
}

/**
 * Find user by ID.
 */
async function findUserById(userId) {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: "PROFILE",
      },
    })
  );

  return result.Item || null;
}

/**
 * Update user attributes (e.g. nationalities, firstTime, fName, lName, quizResponse).
 */
async function updateUser(userId, updates) {
  const allowedFields = ["fName", "lName", "nationalities", "firstTime", "quizResponse"];
  const expressionAttributeNames = {};
  const expressionAttributeValues = {};
  const updateClauses = [];

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      expressionAttributeNames[`#${field}`] = field;
      expressionAttributeValues[`:${field}`] = updates[field];
      updateClauses.push(`#${field} = :${field}`);
    }
  }

  if (updateClauses.length === 0) {
    return await findUserById(userId);
  }

  // Update timestamp
  expressionAttributeNames["#updatedAt"] = "updatedAt";
  expressionAttributeValues[":updatedAt"] = new Date().toISOString();
  updateClauses.push("#updatedAt = :updatedAt");

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: "PROFILE",
      },
      UpdateExpression: `SET ${updateClauses.join(", ")}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    })
  );

  return result.Attributes;
}

module.exports = {
  sanitizeUser,
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
};
