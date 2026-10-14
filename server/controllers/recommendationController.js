const destinations = require("../data/destinations.json");
const { quizSchema, recommendationResultSchema, getResponseJsonSchema } = require("../schemas/recommendationSchema");
const { buildPrompt } = require("../services/promptBuilder");

// Imported as module objects (not destructured) so tests can stub them
const llm = require("../services/llmclient");
const userModel = require("../models/userModel");
const tripModel = require("../models/tripModel");

/**
 * POST /api/recommendations
 * Body: { quiz?: {...} }. Falls back to the user's saved quizResponse.
 */
async function createRecommendations(req, res) {
  try {
    const user = await userModel.findUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: "Not Found", message: "User not found" });
    }

    // 1. Pick and validate the quiz
    const rawQuiz = req.body?.quiz ?? user.quizResponse;
    if (!rawQuiz || typeof rawQuiz !== "object" || Object.keys(rawQuiz).length === 0) {
      return res.status(400).json({
        error: "Bad Request",
        message: "Quiz answers are required (send { quiz } or save a quiz to your profile first)",
      });
    }

    const parsedQuiz = quizSchema.safeParse(rawQuiz);
    if (!parsedQuiz.success) {
      return res.status(400).json({
        error: "Bad Request",
        message:
          "Invalid quiz answers: " +
          parsedQuiz.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    }
    const quiz = parsedQuiz.data;

    // 2. Build the prompt (this is where destinations get filtered)
    const { systemPrompt, prompt, candidateIds } = buildPrompt({
      quiz,
      nationalities: user.nationalities || [],
      destinations,
    });

    // 3. Ask the model
    const { data, model } = await llm.generateStructured({
      prompt,
      systemPrompt,
      jsonSchema: getResponseJsonSchema(),
      zodSchema: recommendationResultSchema,
    });

    // 4. Drop anything the model invented that isn't in our candidate list
    const allowed = new Set(candidateIds);
    const recommendations = data.recommendations.filter((r) => allowed.has(r.destinationId));
    if (recommendations.length === 0) {
      return res.status(502).json({
        error: "Bad Gateway",
        message: "The AI returned no usable recommendations. Please try again.",
      });
    }

    // 5. Save as a trip and return it
    const trip = await tripModel.createTrip(user.id || req.user.userId, {
      title: data.title,
      summary: data.summary,
      recommendations,
      quiz,
      model,
    });

    const { PK, SK, ...safeTrip } = trip;
    return res.status(201).json({ message: "Recommendations generated", trip: safeTrip });
  } catch (err) {
    if (err.statusCode === 503) {
      return res.status(503).json({
        error: "Service Unavailable",
        message: "The AI service is busy right now. Please try again in a moment.",
      });
    }
    if (err.statusCode === 502) {
      return res.status(502).json({
        error: "Bad Gateway",
        message: "The AI returned an invalid response. Please try again.",
      });
    }

    console.error("Error generating recommendations:", err);
    return res.status(500).json({
      error: "Internal Server Error",
      message: "An error occurred while generating recommendations",
    });
  }
}

module.exports = { createRecommendations };