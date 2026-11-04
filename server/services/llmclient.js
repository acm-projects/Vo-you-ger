require("dotenv").config();
const { GoogleGenAI } = require("@google/genai");
const { TRIP_POLICY } = require('../config/tripPolicy');
const { count } = require('./telemetryService');
const {apiError}=require('./apiError');
const {providerJsonSchema}=require('./geminiSchema');

let ai, configuredKey;
function client() {
  const key=process.env.GEMINI_API_KEY;
  if(!key)throw apiError('GEMINI_NOT_CONFIGURED','The AI service is not configured',503);
  if(!ai || configuredKey!==key){ai=new GoogleGenAI({apiKey:key});configuredKey=key;}
  return ai;
}

// Prefer the low-latency model for bounded travel planning. Override in .env.
const MODELS = (
  process.env.LLM_MODELS ||
  "gemini-3.5-flash-lite,gemini-3.8-flash"
)
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);

const COOLDOWN_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = TRIP_POLICY.geminiRequestTimeoutMs;
const MIN_SERVER_TIMEOUT_MS = 10000;

// model name -> {until, reason}; client/provider timeouts never enter this map.
const unavailableUntil = new Map();

function getStatus(err) {
  const status = err.status ?? err.code ?? err.statusCode;
  if (typeof status === "number" && status >= 400 && status <= 599) return status;
  // Fallback: pull a status out of the message text if the SDK didn't set one
  const match = /\b(400|401|403|404|429|500|502|503|504)\b/.exec(err.message || "");
  return match ? Number(match[1]) : null;
}

// The SDK serializes Google's JSON error into err.message. Only emit known
// reason codes; upstream messages/metadata may contain keys or request content.
function rejectionDetails(err, status) {
  let upstream;
  try { upstream = JSON.parse(err.message).error; } catch { /* Non-JSON SDK error. */ }
  const message = typeof upstream?.message === 'string' ? upstream.message : err.message || '';
  const categories = {
    API_KEY_INVALID: 'AUTHENTICATION',
    API_KEY_EXPIRED: 'AUTHENTICATION',
    API_KEY_NOT_FOUND: 'AUTHENTICATION',
    API_KEY_SERVICE_BLOCKED: 'AUTHENTICATION',
    API_KEY_HTTP_REFERRER_BLOCKED: 'AUTHENTICATION',
    API_KEY_IP_ADDRESS_BLOCKED: 'AUTHENTICATION',
    API_KEY_ANDROID_APP_BLOCKED: 'AUTHENTICATION',
    API_KEY_IOS_APP_BLOCKED: 'AUTHENTICATION',
    SERVICE_DISABLED: 'SERVICE_ACCESS',
    BILLING_DISABLED: 'BILLING',
    CONSUMER_INVALID: 'SERVICE_ACCESS',
  };
  const details = Array.isArray(upstream?.details) ? upstream.details : [];
  const reason = details.map(detail => detail?.reason).find(value => Object.hasOwn(categories, value));
  if (reason) return { category: categories[reason], reason };
  // Some API responses omit ErrorInfo and provide only a human-readable message.
  if (/api[ _-]?key.*expired/i.test(message)) return { category:'AUTHENTICATION', reason:'API_KEY_EXPIRED' };
  if (/api[ _-]?key.*(?:not valid|invalid)|invalid api[ _-]?key/i.test(message)) return { category:'AUTHENTICATION', reason:'API_KEY_INVALID' };
  if (/api[ _-]?key.*(?:blocked|leaked)/i.test(message)) return { category:'AUTHENTICATION', reason:'API_KEY_BLOCKED' };
  if (/deadline.*too short|minimum allowed deadline/i.test(message)) return { category:'TIMEOUT_CONFIG', reason:'DEADLINE_TOO_SHORT' };
  const category = status===401||status===403 ? 'AUTHENTICATION'
    : /thinking/i.test(message) ? 'THINKING_CONFIG'
    : /schema/i.test(message) ? 'SCHEMA_CONFIG'
    : /model/i.test(message) ? 'MODEL_CONFIG' : 'REQUEST_CONFIG';
  return { category, reason:'UNSPECIFIED' };
}

function failureReason(error) {
  const status=getStatus(error);
  if (status===504 || ['AbortError','TimeoutError'].includes(error.name) || error.code===20 || error.code==='ABORT_ERR') return 'request_timeout';
  if (status===429) return 'rate_limited';
  if (status===404) return 'model_unavailable';
  if ([400,401,403].includes(status)) return 'provider_configuration';
  return 'provider_unavailable';
}

function fallbackReason(error) {
  return error.fallbackReason || (['GEMINI_CONFIGURATION','GEMINI_NOT_CONFIGURED'].includes(error.code) ? 'provider_configuration'
    : error.statusCode===502 ? 'invalid_response' : failureReason(error));
}

/**
 * Call Gemini, falling back through MODELS until one works.
 * `config` is passed straight to the SDK.
 * Returns { text, model } so callers know which model answered.
 */
async function generateWithFallback(contents, config = {}, options = {}) {
  const provider=client();
  const maxAttempts=Number.isInteger(options.maxAttempts)&&options.maxAttempts>0 ? Math.min(2,options.maxAttempts) : TRIP_POLICY.geminiMaxAttempts;
  const timeoutMs=Number.isInteger(options.timeoutMs)&&options.timeoutMs>0 ? Math.min(TRIP_POLICY.geminiDeadlineMs,options.timeoutMs) : TRIP_POLICY.geminiDeadlineMs;
  const deadline=Date.now()+timeoutMs;
  const diagnostics=[];
  // One attempt per distinct model. Split the remaining deadline so the first
  // model cannot consume the time reserved for the second; SDK retries stay off.
  const models=[...new Set(MODELS)].slice(0,3);
  const eligible=[];
  for (const model of models) {
    const blockedUntil = unavailableUntil.get(model);
    if (blockedUntil && Date.now() < blockedUntil.until) {
      diagnostics.push({model,reason:'cooldown_skipped',previousReason:blockedUntil.reason});
      console.warn(`Gemini model ${model} skipped (cooldown, ${blockedUntil.reason})`);
      continue;
    }
    eligible.push(model);
  }
  const selected=eligible.slice(0,maxAttempts);
  for (const [index,model] of selected.entries()) {
      if (Date.now() >= deadline) break;
      const started=Date.now();
      const remaining=Math.max(1,Math.min(REQUEST_TIMEOUT_MS,Math.floor((deadline-started)/(selected.length-index))));
      try {
        count('geminiRequests');
        const signal=AbortSignal.timeout(remaining);
        const thinkingConfig=model.startsWith('gemini-3') ? {thinkingLevel:model.startsWith('gemini-3.5-flash-lite')?'MINIMAL':'LOW'} : model.startsWith('gemini-2.5-flash') ? {thinkingBudget:0} : undefined;
        const response = await provider.models.generateContent({
          model,
          contents,
          config: {
            ...config,
            maxOutputTokens: Math.min(config.maxOutputTokens || TRIP_POLICY.maxGeminiOutputTokens,TRIP_POLICY.maxGeminiOutputTokens),
            ...(thinkingConfig ? {thinkingConfig:config.thinkingConfig || thinkingConfig} : {}),
            abortSignal:config.abortSignal ? AbortSignal.any([config.abortSignal,signal]) : signal,
            // SDK defaults to five HTTP attempts; our loop is the sole retry owner.
            // Google rejects x-server-timeout below 10 seconds. The abort signal
            // above independently enforces the allocated client deadline.
            httpOptions: { ...config.httpOptions, timeout:Math.max(MIN_SERVER_TIMEOUT_MS,remaining),retryOptions:{attempts:1} },
          },
        });
        unavailableUntil.delete(model);
        return { text: response.text, model, diagnostics };
      } catch (err) {
        const status = getStatus(err);
        const reason=failureReason(err);
        const timeoutOrigin=reason==='request_timeout' ? (status===504?'provider':'client') : undefined;
        diagnostics.push({model,reason,status,elapsedMs:Date.now()-started,attemptTimeoutMs:remaining,
          ...(timeoutOrigin?{timeoutOrigin}:{})});

        // Do not spend fallback attempts on rejected credentials/configuration.
        if (status === 400 || status === 401 || status === 403) {
          const {category,reason}=rejectionDetails(err,status);
          console.warn(`Gemini rejected a request (${status}, ${category}, ${reason})`);
          const error=apiError('GEMINI_CONFIGURATION','The trip generation service is temporarily unavailable. Please try again later.',503);
          error.providerStatus=status;error.providerCategory=category;error.providerReason=reason;
          error.fallbackReason='provider_configuration';error.diagnostics=diagnostics;
          throw error;
        }
        // A caller's timeout is not evidence that a model is unavailable to
        // longer requests. Only explicit quota/model/provider failures cool down.
        if (reason!=='request_timeout' && status) unavailableUntil.set(model,{until:Date.now()+COOLDOWN_MS,reason});
        console.warn(`Gemini model ${model} failed (${reason}, HTTP ${status ?? 'none'}, ${Date.now()-started}ms, budget ${remaining}ms${timeoutOrigin?`, timeout ${timeoutOrigin}`:''})`);
      }
  }
  const last=diagnostics.findLast(item=>item.reason!=='cooldown_skipped');
  const reason=last?.reason || (diagnostics.length ? 'cooldown_skipped' : 'provider_unavailable');
  const error=apiError(reason==='request_timeout'?'GEMINI_TIMEOUT':reason==='rate_limited'?'GEMINI_RATE_LIMIT':reason==='cooldown_skipped'?'GEMINI_COOLDOWN':'GEMINI_UNAVAILABLE',
    'The AI service could not complete this request. Please try again later.',reason==='request_timeout'?504:reason==='rate_limited'?429:503);
  error.fallbackReason=reason;error.diagnostics=diagnostics;
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
async function generateStructured({ prompt, systemPrompt, jsonSchema, zodSchema, maxAttempts, timeoutMs, maxOutputTokens }) {
  const config = {
    responseMimeType: "application/json",
    responseJsonSchema: providerJsonSchema(jsonSchema),
    ...(maxOutputTokens ? {maxOutputTokens}:{}),
  };
  if (systemPrompt) config.systemInstruction = systemPrompt;

  const { text, model, diagnostics } = await generateWithFallback(prompt, config,{maxAttempts,timeoutMs});

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

  return { data: result.data, model, diagnostics };
}

module.exports = { generateWithFallback, generateStructured, fallbackReason, MODELS };
