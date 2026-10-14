const {
  quizSchema,
  recommendationResultSchema,
  getResponseJsonSchema,
} = require("../schemas/recommendationSchema");

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

// 2. Output validation: good sample
const good = {
  title: "Food-forward getaways",
  summary: "A foodie who wants a relaxed week somewhere warm.",
  recommendations: [
    {
      destinationId: "lisbon-pt",
      name: "Lisbon",
      type: "city",
      country: "Portugal",
      matchScore: 88,
      reason: "Great food scene and relaxed pace.",
      highlights: ["Time Out Market", "Alfama walk"],
    },
  ],
};
console.log("good output ok:", recommendationResultSchema.safeParse(good).success);

// 3. Output validation: bad sample
const bad = { recommendations: [{ destinationId: "x", matchScore: 500 }] };
const result = recommendationResultSchema.safeParse(bad);
console.log("bad output rejected:", !result.success);
if (!result.success) console.log(result.error.issues.map((i) => i.message));

// 4. The JSON Schema we'll send to Gemini
console.log(JSON.stringify(getResponseJsonSchema(), null, 2));