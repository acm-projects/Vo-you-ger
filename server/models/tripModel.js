/**
 * server/models/tripModel.js
 *
 * Data access model for trips and itineraries in DynamoDB single-table design.
 *
 * Schema:
 * - PK: USER#<userId>
 * - SK: TRIP#<tripId>
 * - tripId: string (e.g. t-<uuid>)
 * - userId: string
 * - title: string
 * - summary: string
 * - recommendations: array of initial 3 recommended destinations (Phase 1B)
 * - itinerary: null initially, updated with day-by-day activities in Phase 3
 * - quizSnapshot: snapshot of the quiz answers used to craft recommendations
 * - generatedBy: Gemini model version used
 * - createdAt, updatedAt: ISO 8601 timestamps
 */

const crypto = require("crypto");
const {
  PutCommand,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAME } = require("../db/dynamo");

/**
 * Creates an initial Trip containing the 3 recommended destinations (Phase 1B).
 * Itinerary remains null until Phase 3 generation is invoked.
 */
async function createTrip(userId, { title, summary, recommendations, quiz, model }) {
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
 * Retrieves a single Trip by userId and tripId.
 *
 * @param {string} userId - ID of the authenticated user
 * @param {string} tripId - ID of the trip (e.g. "t-123")
 * @returns {Promise<object|null>} The trip item or null if not found
 */
async function getTripById(userId, tripId) {
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
 * @returns {Promise<object>} The updated trip item
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
  getTripById,
  updateTripItinerary,
};