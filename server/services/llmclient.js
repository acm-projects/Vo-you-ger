require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Models in priority order, best first. Set LLM_MODELS in .env to change this.
const MODELS = (
  process.env.LLM_MODELS ||
  "gemini-3.8-flash,gemini-3.7-flash,gemini-3.6-flash,gemini-3.5-flash,gemini-3.5-flash-lite,gemini-3.1-flash-lite"
)
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

const RETRIES_PER_MODEL = 1; // extra attempts on the same model for 503/500
const RETRY_DELAY_MS = 1000;
const COOLDOWN_MS = 60 * 1000; // how long to skip a model after 503/429/timeout
const REQUEST_TIMEOUT_MS = 20 * 1000; // give up on a stalled request

// model name -> timestamp when we may try it again (Infinity = never, e.g. 404)
const unavailableUntil = new Map();

function getStatus(err) {
  const status = err.status ?? err.code ?? err.statusCode;
  if (typeof status === "number") return status;
  // Fallback: pull a status out of the message text if the SDK didn't set one
  const match = /\b(400|401|403|404|429|500|503)\b/.exec(err.message || "");
  return match ? Number(match[1]) : null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Call Gemini, falling back through MODELS until one works.
 * `config` is passed straight to the SDK.
 * Returns { text, model } so callers know which model answered.
 */
async function generateWithFallback(contents, config = {}) {
  const errors = [];

  for (const model of MODELS) {
    const blockedUntil = unavailableUntil.get(model);
    if (blockedUntil && Date.now() < blockedUntil) {
      errors.push(`${model}: skipped (recently unavailable)`);
      continue;
    }

    for (let attempt = 0; attempt <= RETRIES_PER_MODEL; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            httpOptions: { timeout: REQUEST_TIMEOUT_MS },
            ...config,
          },
        });
        unavailableUntil.delete(model);
        return { text: response.text, model };
      } catch (err) {
        const status = getStatus(err);

        // Our fault, not the model's: every model would fail the same way
        if (status === 400 || status === 401 || status === 403) {
          throw err;
        }

        // Transient overload: retry the same model once before giving up on it
        if ((status === 503 || status === 500) && attempt < RETRIES_PER_MODEL) {
          await sleep(RETRY_DELAY_MS);
          continue;
        }

        // Done with this model: remember it so later requests skip it
        if (status === 404) {
          unavailableUntil.set(model, Infinity);
        } else {
          unavailableUntil.set(model, Date.now() + COOLDOWN_MS);
        }
        errors.push(`${model}: ${status ?? "timeout/unknown error"}`);
        console.warn(`LLM model ${model} failed (${status ?? err.message}), trying next`);
        break;
      }
    }
  }

  const error = new Error(`All LLM models failed. ${errors.join("; ")}`);
  error.statusCode = 503;
  throw error;
}

/**
 * Ask Gemini for JSON matching `jsonSchema`, then parse it and validate it
 * with `zodSchema`. Returns { data, model }.
 *
 * - prompt:         the user-facing prompt text
 * - systemPrompt:   optional instructions/rules for the model
 * - jsonSchema:     JSON Schema sent to Gemini (tells it the shape)
 * - zodSchema:      zod schema used to double-check the reply
 */
async function generateStructured({ prompt, systemPrompt, jsonSchema, zodSchema }) {
  const config = {
    responseMimeType: "application/json",
    responseJsonSchema: jsonSchema,
  };
  if (systemPrompt) config.systemInstruction = systemPrompt;

  const { text, model } = await generateWithFallback(prompt, config);

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const error = new Error(`Model ${model} returned invalid JSON`);
    error.statusCode = 502;
    throw error;
  }

  const result = zodSchema.safeParse(parsed);
  if (!result.success) {
    const error = new Error(
      `Model ${model} returned JSON that did not match the schema: ` +
        result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
    );
    error.statusCode = 502;
    throw error;
  }

  return { data: result.data, model };
}

module.exports = { generateWithFallback, generateStructured, MODELS };