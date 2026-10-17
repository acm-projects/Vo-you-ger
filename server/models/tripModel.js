
const crypto = require("crypto");
const { PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAME } = require("../db/dynamo");

/**
 * Create a new trip and save it to DynamoDB.
 *
 * @param {string} userId
 * @param {object} tripData
 * @returns {Promise<object>}
 */
async function createTrip(
  userId,
  { title, summary, recommendations, quiz, model }
) {
  const tripId = `t-${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  const tripItem = {
    PK: `USER#${userId}`,
    SK: `TRIP#${tripId}`,
    tripId,
    userId,
    title,
    summary,
    recommendations,
    itinerary: null,
    quizSnapshot: quiz || null,
    generatedBy: model || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: tripItem,
      ConditionExpression: "attribute_not_exists(PK)",
    })
  );

  return tripItem;
}

/**
 * Find an existing trip belonging to a specific user.
 *
 * Uses the DynamoDB primary key and sort key.
 *
 * @param {string} userId
 * @param {string} tripId
 * @returns {Promise<object|null>}
 */
async function findTripById(userId, tripId) {
  if (!userId || !tripId) {
    throw new Error("userId and tripId are required");
  }

  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `TRIP#${tripId}`,
      },
    })
  );

  return result.Item || null;
}

module.exports = {
  createTrip,
  findTripById,
};
