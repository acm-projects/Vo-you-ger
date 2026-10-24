
const assert = require("node:assert/strict");

const { docClient, TABLE_NAME } = require("../db/dynamo");
const { findTripById } = require("../models/tripModel");

async function main() {
  const originalSend = docClient.send;

  // Mock DynamoDB so no actual database call happens
  docClient.send = async (command) => {
    assert.equal(command.constructor.name, "GetCommand");

    assert.equal(command.input.TableName, TABLE_NAME);

    assert.deepEqual(command.input.Key, {
      PK: "USER#test-user-123",
      SK: "TRIP#test-trip-456",
    });

    return {
      Item: {
        tripId: "test-trip-456",
        userId: "test-user-123",
        recommendations: [
          {
            destinationId: "tokyo-jp",
            name: "Tokyo",
            country: "Japan",
          },
        ],
        quizSnapshot: {
          budgetLevel: "$$",
          travelAlterEgo: "Foodie",
          dietaryRestrictions: ["Vegetarian"],
        },
      },
    };
  };

  try {
    const trip = await findTripById(
      "test-user-123",
      "test-trip-456"
    );

    assert.equal(trip.tripId, "test-trip-456");
    assert.equal(trip.recommendations[0].name, "Tokyo");
    assert.equal(trip.quizSnapshot.budgetLevel, "$$");

    console.log("\n=== TRIP LOOKUP TEST ===");
    console.log("Trip found:", trip.tripId);
    console.log("Destination:", trip.recommendations[0].name);
    console.log("Saved budget:", trip.quizSnapshot.budgetLevel);
    console.log("\nFINAL RESULT: PASS");
  } finally {
    // Restore original DynamoDB behavior
    docClient.send = originalSend;
  }
}

main().catch((error) => {
  console.error("\nFINAL RESULT: FAIL");
  console.error(error.message);
  process.exitCode = 1;
});
