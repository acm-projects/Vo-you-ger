
require("dotenv").config();

const { describe, it, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");

const { docClient } = require("../db/dynamo");
const {
  createTrip,
  findTripById,
  updateTripItinerary,
  saveTrip,
  unsaveTrip,
  getSavedTrips,
} = require("../models/tripModel");

const originalSend = docClient.send;
const store = new Map();

function key(pk, sk) {
  return `${pk}::${sk}`;
}

function conditionalFailure() {
  const error = new Error("Conditional request failed");
  error.name = "ConditionalCheckFailedException";
  return error;
}

beforeEach(() => {
  store.clear();

  docClient.send = async (command) => {
    const { input } = command;
    const commandName = command.constructor.name;

    if (commandName === "PutCommand") {
      const itemKey = key(input.Item.PK, input.Item.SK);

      if (store.has(itemKey)) {
        throw conditionalFailure();
      }

      store.set(itemKey, structuredClone(input.Item));
      return {};
    }

    if (commandName === "GetCommand") {
      const item = store.get(key(input.Key.PK, input.Key.SK));

      return {
        Item: item ? structuredClone(item) : undefined,
      };
    }

    if (commandName === "UpdateCommand") {
      const itemKey = key(input.Key.PK, input.Key.SK);
      const item = store.get(itemKey);

      if (!item) {
        throw conditionalFailure();
      }

      const values = input.ExpressionAttributeValues;
      const expression = input.UpdateExpression || "";
      const condition = input.ConditionExpression || "";

      const isSaveOperation = expression.includes(
        "isSaved = :saved"
      );

      const isUnsaveOperation = expression.includes(
        "isSaved = :unsaved"
      );

      // Simulate DynamoDB's itinerary type condition.
      if (condition.includes("attribute_type(itinerary")) {
        const isMap =
          item.itinerary !== null &&
          typeof item.itinerary === "object" &&
          !Array.isArray(item.itinerary);

        if (!isMap) {
          throw conditionalFailure();
        }
      }

      // Simulate DynamoDB's conditional save.
      if (
        isSaveOperation &&
        condition.includes("isSaved = :unsaved") &&
        item.isSaved === true
      ) {
        throw conditionalFailure();
      }

      // Update the itinerary.
      if (expression.includes("itinerary = :itinerary")) {
        item.itinerary = structuredClone(values[":itinerary"]);
      }

      // Update the model information.
      if (expression.includes("generatedBy = :model")) {
        item.generatedBy = values[":model"];
      }

      // Save operation.
      if (isSaveOperation) {
        item.isSaved = true;
        item.savedAt = values[":timestamp"];
      }

      // Unsave operation.
      if (isUnsaveOperation) {
        item.isSaved = false;
        item.savedAt = null;
      }

      // Update timestamp.
      if (values[":timestamp"] !== undefined) {
        item.updatedAt = values[":timestamp"];
      } else if (values[":updatedAt"] !== undefined) {
        item.updatedAt = values[":updatedAt"];
      }

      store.set(itemKey, item);

      return {
        Attributes: structuredClone(item),
      };
    }

    if (commandName === "QueryCommand") {
      const pk = input.ExpressionAttributeValues[":pk"];
      const skPrefix = input.ExpressionAttributeValues[":sk"];

      return {
        Items: [...store.values()]
          .filter(
            (item) =>
              item.PK === pk &&
              item.SK.startsWith(skPrefix)
          )
          .map((item) => structuredClone(item)),
      };
    }

    throw new Error(`Unexpected command: ${commandName}`);
  };
});

after(() => {
  docClient.send = originalSend;
});

async function makeTrip(userId = "user-1") {
  return createTrip(userId, {
    title: "Tokyo Adventure",
    summary: "Exploring Japan",
    recommendations: [
      {
        destinationId: "tokyo-jp",
        name: "Tokyo",
        country: "Japan",
      },
    ],
    quiz: {
      travelAlterEgo: "Explorer",
    },
    model: "test-model",
  });
}

describe("Saved Trips - DynamoDB Model", () => {

  it("creates trips in an unsaved state", async () => {
    const trip = await makeTrip();

    assert.equal(trip.isSaved, false);
    assert.equal(trip.savedAt, null);
    assert.equal(trip.itinerary, null);
  });

  it("rejects saving before itinerary generation", async () => {
    const trip = await makeTrip();

    await assert.rejects(
      saveTrip("user-1", trip.tripId),
      (error) => error.statusCode === 400
    );
  });

  it("saves a generated itinerary", async () => {
    const trip = await makeTrip();

    const itinerary = {
      days: [
        {
          day: 1,
          title: "Explore Tokyo",
        },
      ],
    };

    await updateTripItinerary(
      "user-1",
      trip.tripId,
      itinerary,
      "test-model"
    );

    const saved = await saveTrip(
      "user-1",
      trip.tripId
    );

    assert.equal(saved.isSaved, true);
    assert.ok(saved.savedAt);
    assert.deepEqual(saved.itinerary, itinerary);
  });

  // NEW TEST: Accommodation recommendations
  it("preserves accommodation-area recommendations", async () => {
    const trip = await makeTrip();

    const itinerary = {
      destination: "Tokyo, Japan",
      recommendedStayArea: "Shinjuku",
      stayAreaRationale:
        "Shinjuku provides convenient transport connections and access to the planned activities.",
      days: [
        {
          day: 1,
          title: "Explore Tokyo",
        },
      ],
    };

    await updateTripItinerary(
      "user-1",
      trip.tripId,
      itinerary,
      "test-model"
    );

    await saveTrip("user-1", trip.tripId);

    const retrieved = await findTripById(
      "user-1",
      trip.tripId
    );

    assert.equal(retrieved.isSaved, true);

    assert.equal(
      retrieved.itinerary.recommendedStayArea,
      "Shinjuku"
    );

    assert.equal(
      retrieved.itinerary.stayAreaRationale,
      itinerary.stayAreaRationale
    );

    assert.deepEqual(retrieved.itinerary, itinerary);
  });

  it("preserves savedAt when saving twice", async () => {
    const trip = await makeTrip();

    await updateTripItinerary(
      "user-1",
      trip.tripId,
      { days: [] }
    );

    const first = await saveTrip(
      "user-1",
      trip.tripId
    );

    const second = await saveTrip(
      "user-1",
      trip.tripId
    );

    assert.equal(first.isSaved, true);
    assert.equal(second.isSaved, true);
    assert.equal(first.savedAt, second.savedAt);
  });

  it("preserves savedAt during simultaneous saves", async () => {
    const trip = await makeTrip();

    await updateTripItinerary(
      "user-1",
      trip.tripId,
      { days: [] }
    );

    const [first, second] = await Promise.all([
      saveTrip("user-1", trip.tripId),
      saveTrip("user-1", trip.tripId),
    ]);

    assert.equal(first.isSaved, true);
    assert.equal(second.isSaved, true);
    assert.equal(first.savedAt, second.savedAt);

    const stored = await findTripById(
      "user-1",
      trip.tripId
    );

    assert.equal(stored.isSaved, true);
    assert.equal(stored.savedAt, first.savedAt);
  });

  it("unsaves without deleting the itinerary", async () => {
    const trip = await makeTrip();

    const itinerary = {
      days: [{ day: 1 }],
    };

    await updateTripItinerary(
      "user-1",
      trip.tripId,
      itinerary
    );

    await saveTrip("user-1", trip.tripId);

    const unsaved = await unsaveTrip(
      "user-1",
      trip.tripId
    );

    assert.equal(unsaved.isSaved, false);
    assert.equal(unsaved.savedAt, null);
    assert.deepEqual(unsaved.itinerary, itinerary);
  });

  it("returns only saved trips for the current user", async () => {
    const first = await makeTrip("user-1");

    // Create an additional unsaved trip.
    await makeTrip("user-1");

    // Create a trip belonging to another user.
    const other = await makeTrip("user-2");

    await updateTripItinerary(
      "user-1",
      first.tripId,
      { days: [] }
    );

    await updateTripItinerary(
      "user-2",
      other.tripId,
      { days: [] }
    );

    await saveTrip("user-1", first.tripId);
    await saveTrip("user-2", other.tripId);

    const saved = await getSavedTrips("user-1");

    assert.equal(saved.length, 1);
    assert.equal(saved[0].tripId, first.tripId);
    assert.equal(saved[0].userId, "user-1");
  });

  it("prevents access to another user's trip", async () => {
    const trip = await makeTrip("user-1");

    const inaccessible = await findTripById(
      "user-2",
      trip.tripId
    );

    assert.equal(inaccessible, null);

    await assert.rejects(
      saveTrip("user-2", trip.tripId),
      (error) => error.statusCode === 404
    );
  });

  it("does not create a nonexistent trip when unsaving", async () => {
    await assert.rejects(
      unsaveTrip("user-1", "missing-trip"),
      (error) =>
        error.name === "ConditionalCheckFailedException"
    );

    assert.equal(store.size, 0);
  });

});
