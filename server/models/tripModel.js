
const crypto = require("crypto");
const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} = require("@aws-sdk/lib-dynamodb");

const { docClient, TABLE_NAME } = require("../db/dynamo");

/**
 * Create a new trip and save it to DynamoDB.
 */
async function createTrip(
  userId,
  { title, summary, recommendations, quiz, model, selectionMetadata = null, itinerary = null },
) {
  if (!userId) throw new Error('userId is required');
  if (itinerary) itinerary = require('../services/itineraryStorageService').storedItinerary(itinerary);
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
    selectionMetadata,
    schemaVersion: recommendations?.length && recommendations.every((item) => item.type === "country" && item.destinationId?.startsWith("country-")) ? 2 : 1,
    itinerary,
    isSaved: false,
    savedAt: null,
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
    }),
  );

  return tripItem;
}

/**
 * Find a trip belonging to a specific user.
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
    }),
  );

  return result.Item || null;
}

/**
 * Update a trip with its generated itinerary.
 */
async function updateTripItinerary(
  userId,
  tripId,
  itinerary,
  model = null,
) {
  itinerary = require('../services/itineraryStorageService').storedItinerary(itinerary);
  if (!userId || !tripId) {
    throw new Error("userId and tripId are required");
  }

  const timestamp = new Date().toISOString();

  const updateExpression = model || itinerary.schemaVersion===2
    ? "SET itinerary = :itinerary, generatedBy = :model, updatedAt = :updatedAt"
    : "SET itinerary = :itinerary, updatedAt = :updatedAt";

  const expressionAttributeValues = {
    ":itinerary": itinerary,
    ":updatedAt": timestamp,
  };
  if(itinerary.schemaVersion===2) expressionAttributeValues[':draftOnly']=false;

  if (model || itinerary.schemaVersion===2) {
    expressionAttributeValues[":model"] = model || null;
  }

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `TRIP#${tripId}`,
      },
      UpdateExpression: updateExpression,
      ConditionExpression:
        "attribute_exists(PK) AND attribute_exists(SK)" + (itinerary.schemaVersion===2 ? " AND (attribute_not_exists(isSaved) OR isSaved = :draftOnly)" : ""),
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW",
    }),
  );

  return result.Attributes;
}

/**
 * Save a generated itinerary to the user's profile.
 *
 * Saving is idempotent: repeated saves preserve savedAt.
 * The conditional update protects against concurrent saves.
 */
async function saveTrip(userId, tripId) {
  if (!userId || !tripId) {
    throw new Error("userId and tripId are required");
  }

  const existingTrip = await findTripById(userId, tripId);

  if (!existingTrip) {
    const error = new Error("Trip not found");
    error.statusCode = 404;
    throw error;
  }

  if (existingTrip.itinerary == null) {
    const error = new Error(
      "Generate an itinerary before saving this trip",
    );
    error.statusCode = 400;
    throw error;
  }

  if (existingTrip.isSaved === true) {
    return existingTrip;
  }

  const timestamp = new Date().toISOString();

  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${userId}`,
          SK: `TRIP#${tripId}`,
        },
        UpdateExpression:
          "SET isSaved = :saved, savedAt = :timestamp, updatedAt = :timestamp",
        ConditionExpression:
          "attribute_exists(PK) AND attribute_exists(SK) AND attribute_type(itinerary, :mapType) AND (attribute_not_exists(isSaved) OR isSaved = :unsaved)",
        ExpressionAttributeValues: {
          ":saved": true,
          ":unsaved": false,
          ":timestamp": timestamp,
          ":mapType": "M",
        },
        ReturnValues: "ALL_NEW",
      }),
    );

    return result.Attributes;
  } catch (error) {
    if (error.name !== "ConditionalCheckFailedException") {
      throw error;
    }

    // Another request may have saved this trip first.
    const latestTrip = await findTripById(userId, tripId);

    if (latestTrip?.isSaved === true) {
      return latestTrip;
    }

    if (!latestTrip) {
      const notFoundError = new Error("Trip not found");
      notFoundError.statusCode = 404;
      throw notFoundError;
    }

    if (latestTrip.itinerary == null) {
      const invalidTripError = new Error(
        "Generate an itinerary before saving this trip",
      );
      invalidTripError.statusCode = 400;
      throw invalidTripError;
    }

    // Preserve the original error if the condition failed
    // for an unexpected reason.
    throw error;
  }
}

/**
 * Remove a trip from the user's saved trips.
 * The generated itinerary is preserved.
 */
async function unsaveTrip(userId, tripId) {
  if (!userId || !tripId) {
    throw new Error("userId and tripId are required");
  }

  const timestamp = new Date().toISOString();

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${userId}`,
        SK: `TRIP#${tripId}`,
      },
      UpdateExpression:
        "SET isSaved = :unsaved, savedAt = :null, updatedAt = :timestamp",
      ConditionExpression:
        "attribute_exists(PK) AND attribute_exists(SK)",
      ExpressionAttributeValues: {
        ":unsaved": false,
        ":null": null,
        ":timestamp": timestamp,
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  return result.Attributes;
}

/**
 * Retrieve all saved trips belonging to a user.
 *
 * Queries only that user's TRIP records.
 * Handles DynamoDB pagination.
 */
async function getSavedTrips(userId) {
  if (!userId) {
    throw new Error("userId is required");
  }

  const savedTrips = [];
  let lastEvaluatedKey;

  do {
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression:
          "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: {
          ":pk": `USER#${userId}`,
          ":sk": "TRIP#",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    savedTrips.push(
      ...(result.Items || []).filter(
        (trip) => trip.isSaved === true,
      ),
    );

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return savedTrips.sort(
    (a, b) =>
      new Date(b.savedAt || b.createdAt || 0) -
      new Date(a.savedAt || a.createdAt || 0),
  );
}

module.exports = {
  createTrip,
  findTripById,
  updateTripItinerary,
  saveTrip,
  unsaveTrip,
  getSavedTrips,
  getSavedTripSummaries,
};

// Project just the metadata required by the globe. Legacy fields allow older
// saved trips to appear without a database migration. Projection reduces payload,
// not DynamoDB read capacity; add a dedicated summary index if scale requires it.
async function getSavedTripSummaries(userId) {
  if (!userId) throw new Error("userId is required");
  const items = [];
  let lastEvaluatedKey;
  do {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      FilterExpression: "#saved = :saved",
      ProjectionExpression: "tripId, #title, savedAt, #i.#summary, #i.#tripTitle, #i.#outline, #i.#destination, #i.#countryCode, #i.#info.#countryCode, #i.#days[0].#date",
      ExpressionAttributeNames: {
        "#saved": "isSaved", "#title": "title", "#i": "itinerary", "#summary": "tripSummary",
        "#tripTitle": "tripTitle", "#outline": "outline", "#destination": "destination",
        "#countryCode": "countryCode", "#info": "practicalInfo", "#days": "days", "#date": "date",
      },
      ExpressionAttributeValues: { ":pk": `USER#${userId}`, ":sk": "TRIP#", ":saved": true },
      ExclusiveStartKey: lastEvaluatedKey,
    }));
    items.push(...(result.Items || []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);
  return items.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
}
