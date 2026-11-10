const {createHash} = require('node:crypto');
const {z} = require('zod');
const llm = require('./llmclient');
const {TRIP_POLICY} = require('../config/tripPolicy');
const {travelerPreferences} = require('../prompts/travelerPreferences');
const template = require('../prompts/itineraryPrompt');
const {count, measured} = require('./telemetryService');

const SLOTS = ['morning', 'afternoon', 'evening'];
const text = max => z.string().trim().min(1).max(max);
const themeSchema = z.object({day:z.number().int().min(1).max(21), theme:text(240)}).strict();
const descriptionSchema = z.object({placeId:text(256), description:text(1000)}).strict();
const narrativeSchema = z.object({
  tripTitle:text(160), summary:text(2000),
  dayThemes:z.array(themeSchema).max(21),
  activityDescriptions:z.array(descriptionSchema).max(84),
}).strict();
const cache = new Map();

// Conservative screen for common unsupported assertions, not a fact checker.
function groundedText(value, max) {
  const parsed = text(max).safeParse(value);
  if (!parsed.success) return null;
  if (/(?:https?:\/\/|<[^>]+>|\b(?:inside|indoors|interior|guaranteed|guarantees|free admission|free entry)\b|[$€£¥]\s*\d|\b\d+(?:\.\d+)?\s*(?:minutes?|hours?|euros?|dollars?)\b|\b\d{1,2}:\d{2}\b|\b(?:allergen|gluten)[ -]free\b|\bsafe for\b)/i.test(parsed.data)) return null;
  if (/\b(?:signature|seasonal|organic|traditional|authentic|gourmet|upscale|award-winning|michelin|rooftop|hilltop|panoramic|sweeping viewpoints|railway station|Tibetan|Asian-inspired|locally sourced|world-renowned|famous for|known for|renowned for|housed in|crafted with|serves|serving|speciali[sz]es|featuring)\b/i.test(parsed.data)) return null;
  // A restaurant's search/category metadata is not a verified menu or proof
  // that a particular meal meets dietary restrictions.
  if (/\b(?:vegan|vegetarian|plant-based|meat-free)\s+(?:meals?|dishes|dish|foods?|menus?|cuisines?|specialties|specialty|eater(?:y|ies)|bites?|flavou?rs?|options?|breakfast|brunch)\b/i.test(parsed.data)) return null;
  return parsed.data;
}

function buildNarrativePayload({itinerary, discovered, quiz}) {
  const byId = new Map(discovered.flatMap(location => location.candidatePlaces.map(place => [place.placeId, place])));
  const selected = new Map();
  const days = itinerary.days.map(day => ({day:day.day, location:day.locationName, type:day.type,
    slots:Object.fromEntries(SLOTS.map(slot => [slot, day[slot].map(activity => {
      const place = byId.get(activity.placeId) || {};
      selected.set(activity.placeId, {placeId:activity.placeId, name:place.name || activity.placeName,
        category:activity.category, types:place.types || [], accessVerified:false});
      return activity.placeId;
    })]))}));
  return {preferences:travelerPreferences(quiz), evidenceLimit:'Only names and categories/types are supplied. Menus, views, history, exhibits, access, prices and journey times are unverified.', trip:{country:itinerary.outline.country,
    days:itinerary.days.length, nights:itinerary.outline.numberOfNights,
    bases:itinerary.outline.stops.map(stop=>({name:stop.name,nights:stop.nights}))}, days, places:[...selected.values()]};
}

function inspectNarrative(data, payload) {
  const days = new Set(payload.days.map(day=>day.day)), ids = new Set(payload.places.map(place=>place.placeId));
  const result = {tripTitle:null, summary:null, dayThemes:new Map(), activityDescriptions:new Map(), invalid:0, unknown:0, duplicates:0};
  result.tripTitle = groundedText(data?.tripTitle,160);
  result.summary = groundedText(data?.summary,2000);
  for (const [field, schema, allowed, key] of [
    ['dayThemes',themeSchema,days,'day'], ['activityDescriptions',descriptionSchema,ids,'placeId'],
  ]) {
    const entries = data?.[field], seen = new Set(), duplicated = new Set();
    if (!Array.isArray(entries) || entries.length > (field === 'dayThemes' ? 21 : 84)) {result.invalid++;continue;}
    for (const item of entries) {
      const parsed = schema.safeParse(item);
      if (!parsed.success) {result.invalid++;continue;}
      const id = parsed.data[key];
      if (!allowed.has(id)) {result.unknown++;continue;}
      if (seen.has(id)) {duplicated.add(id);result[field].delete(id);result.duplicates++;continue;}
      seen.add(id);
      const value = groundedText(parsed.data[field === 'dayThemes' ? 'theme' : 'description'],field === 'dayThemes' ? 240 : 1000);
      if (value && !duplicated.has(id)) result[field].set(id,value); else result.invalid++;
    }
  }
  result.accepted = Number(!!result.tripTitle) + Number(!!result.summary) + result.dayThemes.size + result.activityDescriptions.size;
  result.expected = 2 + days.size + ids.size;
  result.complete = narrativeSchema.safeParse(data).success && result.accepted === result.expected && !result.invalid && !result.unknown && !result.duplicates;
  return result;
}

function correctionFeedback(candidate, payload) {
  // Send only server-validated copy and canonical IDs, never rejected model text.
  // A fallback can preserve good fields and concentrate on the missing ones.
  return {
    rule:'CONTENT_MISMATCH',
    instruction:'Preserve acceptedText verbatim. Fill every repair field, remove unknown IDs and extra fields, and return the complete original JSON structure. For food descriptions, suggest a meal break without describing dishes, menus or dietary suitability.',
    acceptedText:{tripTitle:candidate.tripTitle,summary:candidate.summary,
      dayThemes:[...candidate.dayThemes].map(([day,theme])=>({day,theme})),
      activityDescriptions:[...candidate.activityDescriptions].map(([placeId,description])=>({placeId,description}))},
    repair:{tripTitle:!candidate.tripTitle,summary:!candidate.summary,
      days:payload.days.filter(day=>!candidate.dayThemes.has(day.day)).map(day=>day.day),
      placeIds:payload.places.filter(place=>!candidate.activityDescriptions.has(place.placeId)).map(place=>place.placeId)},
  };
}

function applyNarrative(itinerary, candidate) {
  if (candidate?.tripTitle) itinerary.tripTitle = candidate.tripTitle;
  if (candidate?.summary) itinerary.summary = candidate.summary;
  for (const day of itinerary.days) {
    if (candidate?.dayThemes.has(day.day)) day.theme = candidate.dayThemes.get(day.day);
    day.themeSource = candidate?.dayThemes.has(day.day) ? 'gemini' : 'deterministic_fallback';
    for (const activity of SLOTS.flatMap(slot=>day[slot])) {
      const value = candidate?.activityDescriptions.get(activity.placeId);
      if (value) activity.activityDescription = value;
      activity.descriptionSource = value ? 'gemini' : 'deterministic_fallback';
    }
  }
}

async function writeNarrative({itinerary, discovered, quiz}) {
  const payload = buildNarrativePayload({itinerary,discovered,quiz}), prompt = JSON.stringify(payload);
  // Only generated text is cached. Dates, supplied facts, preferences, fixed
  // assignments and prompt version all contribute to this process-local key.
  const key = createHash('sha256').update(JSON.stringify({version:template.version,startDate:itinerary.startDate,payload})).digest('hex');
  let candidate = null, model = null, reason = 'prompt_too_large', diagnostics = [], cacheHit = false;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) {
    candidate = cached.candidate; model = cached.model; reason = null; cacheHit = true;
    cache.delete(key);cache.set(key,cached);count('narrativeCacheHits');
  } else {
    cache.delete(key);
    if (Buffer.byteLength(prompt) <= TRIP_POLICY.maxPromptBytes) {
      const jsonSchema = z.toJSONSchema(narrativeSchema);delete jsonSchema.$schema;
      try {
        count('geminiStructuredCalls');
        const response = await measured('geminiNarrative',()=>llm.generateStructured({
          systemPrompt:template.systemPrompt, prompt, jsonSchema, zodSchema:narrativeSchema,
          operation:'itinerary', maxAttempts:TRIP_POLICY.geminiMaxAttempts, timeoutMs:TRIP_POLICY.geminiDeadlineMs,
          maxOutputTokens:Math.min(TRIP_POLICY.maxGeminiOutputTokens,512+payload.days.length*48+payload.places.length*160),
          validateResponse:data=>inspectNarrative(data,payload).complete,
          onInvalidResponse:({data,model:attemptModel})=>{
            const partial = inspectNarrative(data,payload);
            if (!candidate || partial.accepted > candidate.accepted) {candidate=partial;model=attemptModel;}
            return correctionFeedback(candidate,payload);
          },
        }));
        // Adapters/test doubles cannot bypass the known-ID/content checks.
        const inspected = inspectNarrative(response.data,payload);
        if (!candidate || inspected.accepted >= candidate.accepted) {candidate=inspected;model=response.model || null;}
        reason = inspected.complete ? null : 'invalid_response';
        diagnostics = response.diagnostics || [];
        if (candidate.complete) {
          cache.set(key,{candidate,model,until:Date.now()+TRIP_POLICY.narrativeCacheTtlMs});
          while (cache.size > TRIP_POLICY.narrativeCacheEntries) cache.delete(cache.keys().next().value);
        }
      } catch (error) {
        if (![429,502,503,504].includes(error.statusCode)) throw error;
        reason = llm.fallbackReason(error);diagnostics=error.diagnostics || [];
      }
    }
  }
  applyNarrative(itinerary,candidate);
  const accepted = candidate?.accepted || 0;
  itinerary.narrativeSource = candidate?.complete ? 'gemini' : accepted ? 'partial' : 'deterministic_fallback';
  itinerary.narrativeFallbackReason = candidate?.complete ? null : reason;
  itinerary.narrativeCacheHit = cacheHit;
  itinerary.narrativeDiagnostics = {expectedFields:2+payload.days.length+payload.places.length,acceptedFields:accepted,
    invalidFields:candidate?.invalid || 0,unknownIds:candidate?.unknown || 0,duplicateIds:candidate?.duplicates || 0,
    attempts:diagnostics};
  count('narrativeAcceptedFields',accepted);
  if (itinerary.narrativeSource !== 'gemini') count('narrativeFallbacks');
  if (itinerary.narrativeSource === 'partial') count('narrativePartialResponses');
  return {model:accepted ? model : null};
}

module.exports = {writeNarrative,buildNarrativePayload,inspectNarrative,narrativeSchema,clearNarrativeCache:()=>cache.clear()};
