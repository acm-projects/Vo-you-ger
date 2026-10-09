const crypto = require("crypto");
const {
  GetCommand,
  PutCommand,
  TransactWriteCommand,
  ScanCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAME } = require("../db/dynamo");

/**
 * Remove sensitive and internal attributes before returning user data.
 */
function sanitizeUser(user) {
  if (!user) return null;
  const { password, PK, SK, ...safeUser } = user;
  return {
    id: safeUser.id || safeUser.userId,
    fName: safeUser.fName,
    lName: safeUser.lName,
    email: safeUser.email,
    nationalities: Array.isArray(safeUser.nationalities) ? safeUser.nationalities : [],
    firstTime: safeUser.firstTime !== undefined ? safeUser.firstTime : true,
    createdAt: safeUser.createdAt,
    updatedAt: safeUser.updatedAt,
  };
}

/**
 * Create a new user in DynamoDB.
 * Enforces email uniqueness using a single-table transaction with an EMAIL pointer item.
 */
async function createUser({ fName, lName, email, passwordHash, nationalities }) {
  const normalizedEmail = email.trim().toLowerCase();
  const userId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const userItem = {
    PK: `USER#${userId}`,
    SK: "PROFILE",
    id: userId,
    fName: fName.trim(),
    lName: lName.trim(),
    email: normalizedEmail,
    password: passwordHash,
    nationalities: Array.isArray(nationalities) ? nationalities : [],
    firstTime: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const emailLookupItem = {
    PK: `EMAIL#${normalizedEmail}`,
    SK: "ACCOUNT",
    userId,
    email: normalizedEmail,
    createdAt: timestamp,
  };

  try {
    // Atomic creation using TransactWriteItems to guarantee email uniqueness
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: TABLE_NAME,
              Item: emailLookupItem,
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
          {
            Put: {
              TableName: TABLE_NAME,
              Item: userItem,
              ConditionExpression: "attribute_not_exists(PK)",
            },
          },
        ],
      })
    );

    return userItem;
  } catch (err) {
    // Check for transaction cancellation due to condition check failure (email already exists)
    const isConflict =
      err.name === "TransactionCanceledException" ||
      err.name === "ConditionalCheckFailedException" ||
      (err.CancellationReasons &&
        err.CancellationReasons.some(
          (reason) => reason.Code === "ConditionalCheckFailed"
        ));

    if (isConflict) {
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
 * First checks the EMAIL#<email> pointer, then retrieves USER#<userId>.
 * Falls back to a Scan if the pointer is missing.
 */
async function findUserByEmail(email) {
  const normalizedEmail = email.trim().toLowerCase();

  // 1. Direct O(1) lookup via EMAIL pointer
  try {
    const emailResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `EMAIL#${normalizedEmail}`,
          SK: "ACCOUNT",
        },
      })
    );

    if (emailResult.Item && emailResult.Item.userId) {
      const userResult = await findUserById(emailResult.Item.userId);
      if (userResult) {
        return userResult;
      }
    }
  } catch (err) {
    // If primary lookup errors, continue to scan fallback
  }

  // 2. Scan fallback in case records were created without pointer item
  const scanResult = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "email = :email AND begins_with(PK, :userPrefix)",
      ExpressionAttributeValues: {
        ":email": normalizedEmail,
        ":userPrefix": "USER#",
      },
    })
  );

  if (scanResult.Items && scanResult.Items.length > 0) {
    return scanResult.Items[0];
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
 * Update user attributes (e.g. nationalities, firstTime, fName, lName).
 */
async function updateUser(userId, updates) {
  const allowedFields = ["fName", "lName", "nationalities", "firstTime"];
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

