const { z } = require("zod");
const { TRIP_POLICY } = require('../config/tripPolicy');

// Facts (name, address, hours, rating) are attached from Google by the server.
const countryActivitySchema = z.object({
  placeId: z.string().min(1).max(256),
  activityDescription: z.string().min(1).max(1000).describe("Describe a suggested visit without inventing venue facts, prices, dietary guarantees, transport, or bookings."),
});

const countryItinerarySchema = z.object({
  tripTitle: z.string().min(1).max(160),
  summary: z.string().min(1).max(2000),
  days: z.array(z.object({
    day: z.number().int().min(1).max(TRIP_POLICY.maxSupportedDays),
    stopId: z.string().min(1).max(64),
    theme: z.string().min(1).max(240),
    morning: z.array(countryActivitySchema).max(2),
    afternoon: z.array(countryActivitySchema).max(2),
    evening: z.array(countryActivitySchema).max(2),
  })).min(1).max(TRIP_POLICY.maxSupportedDays),
});

function getCountryItineraryJsonSchema() {
  const schema = z.toJSONSchema(countryItinerarySchema);
  delete schema.$schema;
  return schema;
}

module.exports = { countryItinerarySchema, getCountryItineraryJsonSchema };
