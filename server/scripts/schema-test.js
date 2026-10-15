const {
  quizSchema,
  recommendationResultSchema,
  getResponseJsonSchema,
} = require("../schemas/recommendationSchema");

const rec = (id, name, country) => ({
  destinationId: id,
  name,
  type: "city",
  country,
  matchScore: 88,
  reason: "Great food scene and relaxed pace.",
  highlights: ["a", "b"],
});

// 1. Quiz validation
const goodQuiz = {
  startingLocation: "Dallas, TX",
  minNights: 4,
  maxNights: 8,
  riskTolerance: 2,
  travelAlterEgo: "Foodie",
  someNewFieldFromFrontend: "still allowed",
};
console.log("quiz ok:", quizSchema.safeParse(goodQuiz).success);
console.log("quiz rejects bad slider:", !quizSchema.safeParse({ riskTolerance: 9 }).success);
console.log("quiz rejects non-object:", !quizSchema.safeParse("hello").success);

// 2. Output: exactly 3 is accepted
const three = {
  title: "Food-forward getaways",
  summary: "A foodie who wants a relaxed week somewhere warm.",
  recommendations: [
    rec("lisbon-pt", "Lisbon", "Portugal"),
    rec("tokyo-jp", "Tokyo", "Japan"),
    rec("rome-it", "Rome", "Italy"),
  ],
};
console.log("3 results ok:", recommendationResultSchema.safeParse(three).success);

// 3. Output: 1 or 4 is rejected
const one = { ...three, recommendations: three.recommendations.slice(0, 1) };
const four = { ...three, recommendations: [...three.recommendations, rec("osaka-jp", "Osaka", "Japan")] };
console.log("1 result rejected:", !recommendationResultSchema.safeParse(one).success);
console.log("4 results rejected:", !recommendationResultSchema.safeParse(four).success);

// 4. Malformed output is rejected
console.log(
  "bad output rejected:",
  !recommendationResultSchema.safeParse({ recommendations: [{ destinationId: "x", matchScore: 500 }] }).success
);

// 5. The JSON Schema we send to Gemini
const js = getResponseJsonSchema();
console.log("json schema has no $schema:", !("$schema" in js));
console.log("json schema pins 3 items:", js.properties.recommendations.minItems === 3 && js.properties.recommendations.maxItems === 3);