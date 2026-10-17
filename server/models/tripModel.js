const crypto = require("crypto");
const {
  PutCommand,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
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

/**
 * Updates an existing Trip with its generated day-by-day itinerary (Phase 3).
 *
 * @param {string} userId - ID of the authenticated user
 * @param {string} tripId - ID of the trip
 * @param {object} itinerary - The structured itinerary object from Gemini
 * @param {string} [model] - Gemini model version used for generation
 * @returns {Promise<object>} The updated trip attributes
 */
async function updateTripItinerary(userId, tripId, itinerary, model = null) {
  const timestamp = new Date().toISOString();

  const updateExpression = model
    ? "SET itinerary = :itinerary, generatedBy = :model, updatedAt = :updatedAt"
    : "SET itinerary = :itinerary, updatedAt = :updatedAt";

  const expressionAttributeValues = {
    ":itinerary": itinerary,
    ":updatedAt": timestamp,
  };

  if (model) {
    expressionAttributeValues[":model"] = model;
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `TRIP#${tripId}`,
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    })
  );

  return result.Attributes;
}

module.exports = {
  createTrip,
  findTripById,
  updateTripItinerary,
};