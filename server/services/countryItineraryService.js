const {TRIP_POLICY}=require('../config/tripPolicy');
const {instrument,measured,count}=require('./telemetryService');
const llm = require("./llmclient");
const discovery = require("./stopDiscoveryService");
const { computeItinerarySchedule } = require("./itineraryPromptBuilder");
const { validateOutline, planningError } = require("./tripOutlineService");
const { countryItinerarySchema, getCountryItineraryJsonSchema } = require("../schemas/countryItinerarySchema");
const { recommendNeighborhoods } = require("./neighborhoodRecommendationService");
const { distanceKm } = require("./placeGroupingService");
const { validateStartDate } = require("./tripTimingService");
const { tripSummary } = require("./tripSummaryService");
const { checkHours } = require('./venueHoursService');
const { buildDailyPlan } = require('./dailyPlanService');
const { practicalInfoForOutline, activityTravelTip } = require('./travelGuidanceService');

function buildSchedule(outline, startDate) {
  validateStartDate(startDate);
  return computeItinerarySchedule(startDate, outline.numberOfDays).map((day) => {
    const stop = outline.stops.find((item) => day.day >= item.startDay && day.day <= item.endDay);
    const excursion = outline.excursions?.find((item) => item.day === day.day);
    const type = outline.numberOfDays === 1 ? "visit" : day.day === 1 ? "arrival" : day.day === outline.numberOfDays ? "departure"
      : outline.transfers.some((transfer) => transfer.day === day.day) ? "transfer" : excursion ? "excursion" : "full";
    return {
      ...day, stopId: stop.stopId, type,
      locationId: excursion ? `excursion:${stop.stopId}:${excursion.destinationId}` : stop.stopId,
      locationName: excursion?.name || stop.name,
      allowedSlots: type === "arrival" || type === "transfer" ? ["evening"]
        : type === "departure" ? ["morning"] : type === "excursion" ? ["afternoon"] : ["morning", "afternoon", "evening"],
      maxActivities: ["full", "visit"].includes(type) ? TRIP_POLICY.maxActivitiesPerFullDay : type === "excursion" ? 2 : 1,
    };
  });
}

function validateAndEnrich(data, outline, schedule, discovered, quiz) {
  const parsed = countryItinerarySchema.safeParse(data);
  if (!parsed.success) throw planningError("AI returned an invalid country itinerary", 502);
  const result = parsed.data;
  if (result.days.length !== schedule.length) throw planningError("AI returned the wrong number of days", 502);
  const byLocation = new Map(discovered.map((stop) => [stop.locationId || stop.stopId, new Map(stop.candidatePlaces.map((place) => [place.placeId, place]))]));
  const seen = new Set();
  const selectedByStop = new Map(outline.stops.map((stop) => [stop.stopId, []]));

  for (const [index, day] of result.days.entries()) {
    const expected = schedule[index];
    if (day.day !== expected.day || day.stopId !== expected.stopId) {
      throw planningError("AI changed the fixed day order or overnight base", 502);
    }
    const selected = [];
    for (const slot of ["morning", "afternoon", "evening"]) {
      if (!expected.allowedSlots.includes(slot) && day[slot].length) {
        throw planningError("AI scheduled activities during reserved travel time", 502);
      }
      day[slot] = day[slot].map((activity) => {
        const place = byLocation.get(expected.locationId)?.get(activity.placeId);
        if (!place || place.stopId !== day.stopId || (place.locationId || place.stopId) !== expected.locationId || seen.has(activity.placeId)) {
          throw planningError("AI returned an unknown, duplicate, or wrong-stop venue", 502);
        }
        seen.add(activity.placeId);
        selected.push(place);
        if (expected.type !== "excursion") selectedByStop.get(day.stopId).push(place);
        const hours = checkHours(place, expected.dayOfWeek, slot);
        return {
          ...activity, placeName: place.name, category: place.category,
          address: place.address, lat: place.lat, lng: place.lng,
          rating: place.rating, openingHours: place.openingHours,
          attributions: place.attributions || [],
          travelTip: activityTravelTip(place, expected, slot, quiz),
          travelTipSource: 'planning_guidance',
          ...hours,
        };
      });
    }
    const max = ["full", "visit"].includes(expected.type) && require("./destinationScoringService").isRelaxed(quiz) ? TRIP_POLICY.maxActivitiesPerRelaxedDay : expected.maxActivities;
    if (selected.length > max || (["full", "visit", "excursion"].includes(expected.type) && selected.length < 1)) {
      throw planningError("AI returned an overpacked or empty sightseeing day", 502);
    }
    // Conservative editorial geographic limit; never convert this into a walking
    // time or claim a route is walkable without a routing provider.
    const conflicts = selected.flatMap((a, index) => selected.slice(index + 1).flatMap(b => {
      const distance = distanceKm(a, b);
      return distance > TRIP_POLICY.maxDailyActivitySpreadKm
        ? [{placeIds:[a.placeId,b.placeId],distanceKm:Number(distance.toFixed(2))}] : [];
    }));
    if (conflicts.length) {
      const error=planningError(`AI spread day ${day.day}'s activities too far apart`,502);
      error.validationFeedback={rule:'MAX_DAILY_SPREAD',day:day.day,maxDistanceKm:TRIP_POLICY.maxDailyActivitySpreadKm,conflictingPairs:conflicts};
      throw error;
    }
    Object.assign(day, {
      date: expected.date, dayOfWeek: expected.dayOfWeek, type: expected.type,
      locationId: expected.locationId, locationName: expected.locationName,
      excursion: outline.excursions?.find((excursion) => excursion.day === day.day) || null,
      transfer: outline.transfers.find((transfer) => transfer.day === day.day) || null,
    });
  }

  result.schemaVersion = 2;
  result.destination = outline.country;
  result.countryCode = outline.countryCode;
  result.outline = outline;
  result.practicalInfo = practicalInfoForOutline(outline);
  result.stays = outline.stops.filter(stop=>stop.nights>0).map((stop) => {
    const places = selectedByStop.get(stop.stopId);
    const grouped = Object.fromEntries(["attractions", "food", "experiences"].map((category) => [category, places.filter((place) => place.category === category)]));
    const neighborhoods = recommendNeighborhoods(grouped);
    return {
      stopId: stop.stopId, destinationId: stop.destinationId, name: stop.name, nights: stop.nights,
      recommendedStayArea: neighborhoods[0]?.name || null,
      stayAreaRationale: neighborhoods.length
        ? "This area ranks well for straight-line proximity to the scheduled activities. Actual travel times and accommodation availability are unverified."
        : "Google Places did not supply enough neighborhood data to recommend an area reliably.",
      alternatives: neighborhoods.slice(1),
    };
  });
  result.planningNotes = [
    outline.durationBasis,
    "Arrival and departure days are light. Adjust them to your actual travel arrangements.",
    "Transfers are approximate planning allowances, not live schedules or bookings. Different arrival/departure bases may require different tickets.",
    "Regular opening hours may change on holidays. Slot overlap does not confirm visit duration or ticket availability.",
    "Venue identity and location come from Google Places. Dietary suitability, accessibility, prices, and descriptive suggestions need confirmation with the venue.",
  ];
  result.tripSummary = tripSummary(result);
  result.catalogAttribution = {provider:'GeoNames',url:'https://www.geonames.org/',license:'CC-BY-4.0'};
  return result;
}

function matchesFixedPlan(data,plan) {
  return data.days.length===plan.days.length && data.days.every((day,index)=>{
    const fixed=plan.days[index];
    return day.day===fixed.day && day.stopId===fixed.stopId && ['morning','afternoon','evening'].every(slot=>
      day[slot].length===fixed[slot].length && day[slot].every((activity,i)=>activity.placeId===fixed[slot][i].placeId));
  });
}

/**
 * Resolves the optimal start date within the traveler's preferred months (or best reviewed
 * months for the destination if "any month" was selected) that adheres to attraction opening
 * days and hours across the entire trip length.
 *
 * Subsequent days of the itinerary are calculated starting from this first day.
 */
function resolveOptimalStartDate({ outline, quiz = {}, discovered = [] }) {
  const MONTH_MAP = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  };

  const targetMonths = [];

  // Step 1: Parse traveler's preferred months from quiz profile
  const preferred = Array.isArray(quiz.preferredMonths)
    ? quiz.preferredMonths
    : (quiz.preferredMonths ? [quiz.preferredMonths] : []);

  for (const m of preferred) {
    if (!m) continue;
    const clean = String(m).trim().toLowerCase();
    if (clean === "any" || clean === "any month" || clean === "anytime" || clean.includes("not sure")) {
      continue;
    }
    if (MONTH_MAP[clean] !== undefined) {
      if (!targetMonths.includes(MONTH_MAP[clean])) targetMonths.push(MONTH_MAP[clean]);
    } else {
      const prefix = clean.slice(0, 3);
      if (MONTH_MAP[prefix] !== undefined) {
        if (!targetMonths.includes(MONTH_MAP[prefix])) targetMonths.push(MONTH_MAP[prefix]);
      }
    }
  }

  // Step 2: If "any month" or no specific month provided, resolve the destination's best reviewed months
  if (targetMonths.length === 0) {
    const catalog = require("./planningDataService");
    const stops = outline.stops || [];
    for (const stop of stops) {
      const base = catalog.destinationById?.get(stop.destinationId);
      if (base && Array.isArray(base.bestMonths)) {
        for (const bm of base.bestMonths) {
          const clean = String(bm).trim().toLowerCase().slice(0, 3);
          if (MONTH_MAP[clean] !== undefined && !targetMonths.includes(MONTH_MAP[clean])) {
            targetMonths.push(MONTH_MAP[clean]);
          }
        }
      }
    }
  }

  // Fallback: Default to next month if no preferred or catalog months are available
  if (targetMonths.length === 0) {
    const now = new Date();
    targetMonths.push((now.getMonth() + 1) % 12);
  }

  // Step 3: Determine target planning year (e.g. 2026/2027)
  const now = new Date();
  const currentYear = Math.max(now.getFullYear(), 2026);

  const formatDate = (y, m, d) =>
    `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  let bestCandidateDate = null;
  let highestScore = -Infinity;

  // Step 4: Evaluate candidate dates across the target months adhering to venue opening hours
  for (const targetMonth of targetMonths) {
    const year = targetMonth < now.getMonth() && currentYear === now.getFullYear()
      ? currentYear + 1
      : currentYear;

    const daysInMonth = new Date(year, targetMonth + 1, 0).getDate();

    // Prioritize weekend departures (Saturdays, Fridays, Sundays) followed by mid-month departures
    const candidateDays = [];
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, targetMonth, d).getDay() === 6) candidateDays.push(d); // Saturday
    }
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, targetMonth, d).getDay() === 5 && !candidateDays.includes(d)) candidateDays.push(d); // Friday
    }
    for (let d = 1; d <= daysInMonth; d++) {
      if (new Date(year, targetMonth, d).getDay() === 0 && !candidateDays.includes(d)) candidateDays.push(d); // Sunday
    }
    for (let d = 1; d <= Math.min(daysInMonth, 15); d++) {
      if (!candidateDays.includes(d)) candidateDays.push(d);
    }

    for (const d of candidateDays) {
      const candidateDateStr = formatDate(year, targetMonth, d);
      try {
        const candidateSchedule = buildSchedule(outline, candidateDateStr);
        // Test whether candidate schedule satisfies all attraction opening hours
        const testPlan = buildDailyPlan({
          outline,
          schedule: candidateSchedule,
          discovered,
          quiz
        });

        // Score based on number of scheduled activities + preferred weekend departure bonus
        let score = 0;
        for (const day of testPlan.days) {
          score += (day.morning?.length || 0) + (day.afternoon?.length || 0) + (day.evening?.length || 0);
        }
        const startDayOfWeek = new Date(year, targetMonth, d).getDay();
        if (startDayOfWeek === 6) score += 5; // Saturday departure bonus
        if (startDayOfWeek === 5) score += 3; // Friday departure bonus

        if (score > highestScore) {
          highestScore = score;
          bestCandidateDate = candidateDateStr;
        }
      } catch (err) {
        // If a candidate date encounters venue closure conflicts (e.g. INSUFFICIENT_VENUES), skip it
        continue;
      }
    }

    if (bestCandidateDate) {
      break; // Feasible date adhering to opening hours found
    }
  }

  // Fallback safe date if all candidates encountered strict opening hour collisions
  if (!bestCandidateDate) {
    const primaryMonth = targetMonths[0];
    const year = primaryMonth < now.getMonth() && currentYear === now.getFullYear()
      ? currentYear + 1
      : currentYear;
    let d = 1;
    while (new Date(year, primaryMonth, d).getDay() !== 6 && d < 28) d++;
    bestCandidateDate = formatDate(year, primaryMonth, d);
  }

  return bestCandidateDate;
}

async function generate({ outline, quiz, startDate }) {
  validateOutline(outline, quiz);

  // 1. Discover places first (this does not depend on a calendar start date)
  const discovered = await measured("placesDiscovery",()=>discovery.discoverStops(outline, quiz));

  // 2. Resolve start date: if traveler didn't supply a fixed startDate (only preferred months),
  // pick the optimal start date within those months (or best month) adhering to attraction opening hours
  let effectiveStartDate = startDate ?? outline.startDate;
  if (!effectiveStartDate) {
    effectiveStartDate = resolveOptimalStartDate({ outline, quiz, discovered });
    outline.startDate = effectiveStartDate;
  } else {
    validateStartDate(effectiveStartDate);
    if (outline.startDate && outline.startDate !== effectiveStartDate) {
      throw planningError("Itinerary startDate does not match the selected outline");
    }
    outline.startDate = effectiveStartDate;
  }

  // 3. Calculate subsequent days from that first day
  const schedule = buildSchedule(outline, effectiveStartDate);

  // 4. Build daily plan verifying every attraction's opening days and hours
  const plan = buildDailyPlan({outline,schedule,discovered,quiz});
  const itinerary = validateAndEnrich(plan,outline,schedule,discovered,quiz);
  itinerary.startDate = effectiveStartDate;
  const template = require('../prompts/itineraryPrompt');
  const selectedIds = new Set(plan.days.flatMap(day => ['morning','afternoon','evening'].flatMap(slot => day[slot].map(activity => activity.placeId))));
  const payload = {
    quiz:require('../prompts/travelerPreferences').travelerPreferences(quiz),
    outline:{country:outline.country,numberOfDays:outline.numberOfDays,numberOfNights:outline.numberOfNights,
      stops:outline.stops.map(({stopId,name,nights})=>({stopId,name,nights}))},
    schedule,plan,
    candidates:discovered.map(stop=>({stopId:stop.stopId,locationId:stop.locationId||stop.stopId,
      places:stop.candidatePlaces.filter(place=>selectedIds.has(place.placeId))
        .map(({placeId,name,category,types})=>({placeId,name,category,types}))})),
  };
  let model=null, narrativeSource='deterministic_fallback', narrativeFallbackReason='prompt_too_large';
  const prompt=JSON.stringify(payload);
  if(Buffer.byteLength(prompt)<=TRIP_POLICY.maxPromptBytes) {
    try {
      count('geminiStructuredCalls');
      const response=await measured('geminiNarrative',()=>llm.generateStructured({
        systemPrompt:template.systemPrompt,prompt,
        jsonSchema:getCountryItineraryJsonSchema(),zodSchema:countryItinerarySchema,
        maxAttempts:TRIP_POLICY.geminiMaxAttempts,timeoutMs:TRIP_POLICY.geminiDeadlineMs,
      }));
      const parsed=countryItinerarySchema.safeParse(response.data);
      narrativeFallbackReason=parsed.success ? 'schedule_changed' : 'invalid_response';
      // Treat the response strictly as copy for the fixed plan. Empty/extra days,
      // invented IDs, changed slots, repeats, and rescheduling use neutral copy.
      if(parsed.success && matchesFixedPlan(parsed.data,plan)) {
        itinerary.tripTitle=parsed.data.tripTitle;
        itinerary.summary=parsed.data.summary;
        for(const [index,day] of itinerary.days.entries()) {
          day.theme=parsed.data.days[index].theme;
          for(const slot of ['morning','afternoon','evening']) {
            for(const [activityIndex,activity] of day[slot].entries()) {
              activity.activityDescription=parsed.data.days[index][slot][activityIndex].activityDescription;
            }
          }
        }
        narrativeSource='gemini';model=response.model||null;narrativeFallbackReason=null;
      }
    } catch(error) {
      // The validated plan remains usable during provider/configuration outages.
      // Unexpected application failures still surface rather than being hidden.
      if(![429,502,503,504].includes(error.statusCode)) throw error;
      narrativeFallbackReason=llm.fallbackReason(error);
    }
  }
  if(narrativeSource==='deterministic_fallback')count('narrativeFallbacks');
  itinerary.narrativeSource=narrativeSource;
  itinerary.narrativeFallbackReason=narrativeFallbackReason;
  itinerary.schedulerVersion='2026-10-23.1';
  itinerary.promptVersion=template.version;
  itinerary.tripSummary=tripSummary(itinerary);
  itinerary.placesAttribution={provider:'Google Maps',requiresDisplay:true};
  return {itinerary,model};
}

async function generateCountryItinerary(params) { return instrument("itinerary",()=>generate(params)); }

module.exports = { generateCountryItinerary, buildSchedule, validateAndEnrich, checkHours };
