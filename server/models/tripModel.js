const crypto = require("crypto");
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient, TABLE_NAME } = require("../db/dynamo");
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

module.exports = { createTrip };