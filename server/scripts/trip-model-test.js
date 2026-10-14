const { docClient } = require("../db/dynamo");
const { createTrip } = require("../models/tripModel");

// Capture what would be written instead of calling DynamoDB
let captured = null;
docClient.send = async (command) => {
  captured = command.input;
  return {};
};

async function main() {
  const trip = await createTrip("u-101", {
    title: "Food-forward getaways",
    summary: "A foodie wanting a relaxed week.",
    recommendations: [{ destinationId: "lisbon-pt", name: "Lisbon" }],
    quiz: { travelAlterEgo: "Foodie" },
    model: "gemini-3.5-flash-lite",
  });

  console.log("PK:", captured.Item.PK);
  console.log("SK:", captured.Item.SK);
  console.log("starts with USER#:", captured.Item.PK.startsWith("USER#"));
  console.log("starts with TRIP#:", captured.Item.SK.startsWith("TRIP#"));
  console.log("no GSI fields:", !("GSI1PK" in captured.Item) && !("GSI1SK" in captured.Item));
  console.log("itinerary null:", trip.itinerary === null);
}

main();