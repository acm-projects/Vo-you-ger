/**
 * server/services/itineraryPromptBuilder.js
 *
 * Constructs the system prompt and contextual prompt for Gemini Itinerary Generation (Phase 3).
 *
 * Key Capabilities:
 * 1. Specific Dates & Days of the Week:
 *    - Automatically calculates calendar dates and day-of-week (e.g. Day 1: Saturday 2026-10-24).
 *    - Injects strict operating hours rules to prevent scheduling closed venues on specific weekdays.
 * 2. Multi-Activity Pacing ("See It All" vs "Deeply"):
 *    - Instructs Gemini to pack 2 activities in morning/afternoon when `seeAllOrDeeply === 'seeAll'`.
 *    - Instructs 1 focused activity per slot when `'deeply'`.
 * 3. Night Owls & Late Nights:
 *    - Instructs Gemini to populate the optional `lateNight` slot if the user indicated `sleepInOrEarly === 'Sleep in'`.
 * 4. Strict Negative Constraints:
 *    - Candidates list ONLY (zero hallucinated venues).
 *    - Exact placeId enforcement.
 *    - No public transit routing guesswork.
 */

const MONTH_MAP = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Calculates a sequential calendar date schedule for the itinerary.
 * Uses a provided `startDate`, or derives a realistic upcoming Saturday
 * within the traveler's preferred quiz months.
 *
 * @param {string} [startDate] - Optional YYYY-MM-DD start date
 * @param {number} targetDays - Number of days to generate
 * @param {string[]} [preferredMonths] - e.g. ["October", "November"]
 * @returns {Array<{ day: number, date: string, dayOfWeek: string }>}
 */
function computeItinerarySchedule(startDate, targetDays, preferredMonths = []) {
  let start;

  if (startDate && !isNaN(new Date(startDate).getTime())) {
    if (typeof startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      const [y, m, d] = startDate.split("-").map(Number);
      start = new Date(y, m - 1, d);
    } else {
      start = new Date(startDate);
    }
  } else {
    // Find a target month from the user's preferred months or default to next month
    const now = new Date();
    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth() + 1; // default to next month

    if (Array.isArray(preferredMonths) && preferredMonths.length > 0) {
      const firstPref = String(preferredMonths[0]).trim().toLowerCase();
      if (MONTH_MAP[firstPref] !== undefined) {
        targetMonth = MONTH_MAP[firstPref];
        // If preferred month is earlier in the year than now, assume next year
        if (targetMonth < now.getMonth()) {
          targetYear += 1;
        }
      }
    }

    // Default to the first Saturday of that target month for ideal weekend departure
    start = new Date(targetYear, targetMonth, 1);
    while (start.getDay() !== 6) {
      // 6 is Saturday
      start.setDate(start.getDate() + 1);
    }
  }

  const schedule = [];
  for (let i = 0; i < targetDays; i++) {
    const current = new Date(start);
    current.setDate(start.getDate() + i);

    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, "0");
    const dayOfMonth = String(current.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${dayOfMonth}`;
    const dayOfWeek = DAY_NAMES[current.getDay()];

    schedule.push({
      day: i + 1,
      date: dateStr,
      dayOfWeek,
    });
  }

  return schedule;
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================
const ITINERARY_SYSTEM_PROMPT = `You are an expert travel itinerary architect for an app called Vo(you)ger.
Your mission is to curate a personalized, sequential day-by-day travel itinerary using ONLY the provided candidate places.

STRICT ZERO-HALLUCINATION RULES:
1. CANDIDATE LIST ONLY: You must ONLY select venues, attractions, and locations from the provided "Candidate Places" list.
2. NO INVENTED VENUES: NEVER invent, fabricate, or suggest any restaurant, museum, park, or venue not present in the candidate list. If a place is not in the list, it does not exist for this trip.
3. EXACT IDs: For every time slot, you must output the EXACT "placeId" and exact "placeName" from the candidate list.
4. NO TRANSPORTATION ROUTING: Do not invent public transit routes, train numbers, subway transfers, or bus schedules. Focus entirely on the venue experience, activities, timing, and travel tips.
5. NO DUPLICATE VENUES (STRICT): Every activity slot across the entire itinerary must feature a UNIQUE placeId. NEVER repeat or schedule the same placeId twice anywhere in the entire itinerary. If there are not enough distinct candidates to pack multiple activities per slot, schedule only ONE activity per slot instead of repeating any venue.

GEOGRAPHIC CLUSTERING & EFFICIENT ROUTING:
- Group venues geographically by neighborhood or proximity each day to minimize transit fatigue.
- For any given day, morning, afternoon, and evening venues should be located in the same neighborhood or directly adjacent areas (e.g. keep all George Town venues together on Day 1, and Air Itam / Penang Hill venues together on Day 2).
- NEVER send a traveler across town or to an outlying district for a single afternoon activity and then haul them all the way back across town for dinner. If an outlying area is visited, cluster the day's activities together in that district.

DAYS OF WEEK & OPERATING HOURS CONSTRAINTS:
- Each day has an exact calendar "date" and "dayOfWeek" (e.g. Saturday, Sunday, Monday).
- You MUST cross-reference candidate places' opening hours and days open:
  * NEVER schedule a venue on a day it is closed (e.g. do not schedule a museum on Monday if closed on Mondays).
  * Morning activities must be open in the morning; evening and late-night activities must be open during evening/night hours.

PACING, MULTI-ACTIVITY & NIGHTLIFE RULES:
- "See It All" vs "Deeply":
  * If the traveler's quiz specifies "seeAll" in seeAllOrDeeply, schedule MULTIPLE activities (1-2 in morning, 2 in afternoon) to maximize their experience, provided enough distinct candidates exist. NEVER duplicate venues just to fill slots.
  * If they specified "deeply", schedule 1 focused, immersive activity per slot to allow relaxed exploration.
- Night Owls & Late Nights:
  * If the traveler specified "Sleep in" or nightlife in sleepInOrEarly, or indicated a desire for late evenings, include the optional "lateNight" slot (e.g. night markets, cocktail bars, late jazz lounges, illuminated walks). If they are early risers or do not want late nights, omit the "lateNight" slot.
- Dietary Requirements: If the traveler has dietary restrictions (e.g. Vegetarian, Halal, Gluten-Free), ensure dining spots explicitly accommodate them.
- Budget Level: Respect the traveler's budgetLevel ($ = budget/value, $$ = moderate, $$$ = luxury/upscale) in estimatedCost fields.

NO INTERNAL DELIBERATIONS OR META-COMMENTARY:
- NEVER leak self-corrections, internal deliberation, or constraint discussions (such as "Wait, let's keep every place unique", "Instead of duplicating...", "Ensure unique venues only") into activityDescription or travelTip.
- Every activityDescription and travelTip must be written strictly as an authentic, engaging travel guide addressing the tourist with vivid experiential details and real tips.

MEAL PLANNING, INCLUDED MEALS & DIETARY RESTRICTIONS:
- Daily Meals: Schedule local dining for lunch (afternoon) and dinner (evening) using candidate hawker centres, food courts, restaurants, or night markets. Populate the optional "mealType" field ("breakfast", "lunch", "dinner", "late_night_eats").
- Included Meals (Ryokans, Onsens, Resorts): If an accommodation specifies "includesMeals" (e.g. ["breakfast", "dinner"] in a Japanese onsen ryokan or resort):
  * Feature the on-site dining experience (e.g. multi-course seasonal Kaiseki dinner or traditional breakfast) in that meal slot.
  * Do NOT schedule a competing external restaurant for any meal that is already included on-site.
- Strict Dietary Adherence: If the traveler has dietary restrictions (e.g. Halal, Vegetarian, Vegan, Gluten-Free), ensure all scheduled dining venues explicitly match their requirements (check "dietaryOptions").

RECOMMENDED BASE / STAY AREA:
- Suggest a single recommended neighborhood, district, or area to stay in ("recommendedStayArea"), such as "George Town (UNESCO Heritage Core)" or "Shinjuku / Shibuya".
- Base this on the geographic clustering of their scheduled activities, walking convenience, transit hubs, and traveler vibe (e.g. quiet vs lively nightlife).
- Provide a clear, helpful 2-3 sentence explanation in "stayAreaRationale" explaining why this base minimizes commute times.
- DO NOT name or suggest specific hotels, hostels, or individual accommodation properties. Recommend the area/neighborhood only.`;

/**
 * Builds the user prompt text by combining destination details, user quiz answers,
 * calendar schedule, and candidate places with opening hours from Phase 2.
 *
 * @param {object} params
 * @param {string|object} params.destination - Target destination (e.g. "Tokyo, Japan")
 * @param {object} params.quiz - User quiz answers
 * @param {Array<object>} params.candidatePlaces - Vetted venues from Phase 2
 * @param {number} [params.numberOfDays] - Target duration in days
 * @param {string} [params.startDate] - Optional YYYY-MM-DD start date
 * @param {object} [params.context] - Optional extra metadata
 * @returns {{ systemPrompt: string, prompt: string, candidatePlaceIds: Set<string>, schedule: Array<object> }}
 */
function buildItineraryPrompt({
  destination,
  quiz = {},
  candidatePlaces = [],
  numberOfDays,
  startDate,
  context = {},
}) {
  const destinationName =
    typeof destination === "string"
      ? destination
      : `${destination?.name || "Selected Destination"}${
          destination?.country ? `, ${destination.country}` : ""
        }`;

  const targetDays =
    Number(numberOfDays) > 0
      ? Number(numberOfDays)
      : Number(quiz.minNights) > 0
      ? Number(quiz.minNights)
      : Number(quiz.maxNights) > 0
      ? Number(quiz.maxNights)
      : 3;

  // Compute exact dates and days of week for the trip
  const schedule = computeItinerarySchedule(startDate, targetDays, quiz.preferredMonths);

  const candidatePlaceIds = new Set(
    candidatePlaces.map((p) => p.placeId).filter(Boolean)
  );

  // Format candidate places with hours, meals, coordinates, and metadata
  const cleanCandidates = candidatePlaces.map((p) => {
    const openingHours = Array.isArray(p.openingHours)
      ? p.openingHours.join("; ")
      : undefined;

    return {
      placeId: p.placeId,
      name: p.name,
      category: p.category || "attraction",
      neighborhood: p.neighborhood || undefined,
      lat: Number.isFinite(p.lat) ? p.lat : undefined,
      lng: Number.isFinite(p.lng) ? p.lng : undefined,
      description: p.description || "",
      estimatedCost:
        p.estimatedCost || (p.priceLevel ? String(p.priceLevel) : "Varies"),
      daysOpen: p.daysOpen || undefined,
      openingHours,
      rating: p.rating || undefined,
      includesMeals: p.includesMeals || undefined,
      dietaryOptions: p.dietaryOptions || undefined,
      tags: p.tags || [],
    };
  });

  const scheduleListText = schedule
    .map((s) => `Day ${s.day}: ${s.dayOfWeek}, ${s.date}`)
    .join("\n");

  const prompt = `TRAVEL DESTINATION:
${destinationName}

CALENDAR SCHEDULE (Use these exact dates and days of the week):
${scheduleListText}

TRAVELER QUIZ PROFILE:
${JSON.stringify(quiz, null, 2)}

ADDITIONAL CONTEXT:
${JSON.stringify(context, null, 2)}

CANDIDATE PLACES CATALOG (You MUST choose ALL activities exclusively from this list):
${JSON.stringify(cleanCandidates, null, 2)}

REMINDERS:
- Return an itinerary containing exactly ${targetDays} day(s), using the exact date and dayOfWeek calculated above.
- Geographic Clustering: Cluster activities by neighborhood or proximity each day. Avoid zigzagging or sending travelers far away for a single activity.
- Verify opening hours and daysOpen against each day's dayOfWeek before assigning a place.
- seeAllOrDeeply preference: "${quiz.seeAllOrDeeply || "flexible"}" (if seeAll, provide 2 morning and 2 afternoon activities ONLY if enough distinct venues exist).
- sleepInOrEarly preference: "${quiz.sleepInOrEarly || "balanced"}" (if "Sleep in" or nightlife, include the optional lateNight slot).
- ZERO DUPLICATES: Every placeId must be unique across the entire trip. Never repeat a placeId.
- Recommend a strategic neighborhood in "recommendedStayArea" and explain why in "stayAreaRationale" without naming specific hotels.
- Every placeId MUST strictly match one of the candidate places listed above.`;

  return {
    systemPrompt: ITINERARY_SYSTEM_PROMPT,
    prompt,
    candidatePlaceIds,
    schedule,
  };
}

module.exports = {
  ITINERARY_SYSTEM_PROMPT,
  computeItinerarySchedule,
  buildItineraryPrompt,
};
