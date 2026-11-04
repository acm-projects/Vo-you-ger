const { TRIP_POLICY } = require('../config/tripPolicy');
const { distanceKm, isValidLocation } = require('./placeGroupingService');
const { checkHours } = require('./venueHoursService');
const { isRelaxed } = require('./destinationScoringService');
const { personaTags } = require('../config/interestTags');
const { apiError } = require('./apiError');

const SLOTS = ['morning', 'afternoon', 'evening'];
const isSightseeing = day => ['full', 'visit', 'excursion'].includes(day.type);
const activities = day => SLOTS.flatMap(slot => day[slot]);

function openSlots(place, day) {
  return day.allowedSlots.filter(slot => {
    try { checkHours(place, day.dayOfWeek, slot); return true; }
    catch (error) { if (error.statusCode === 502) return false; throw error; }
  });
}

function preferenceScore(place, quiz) {
  const tags = personaTags(quiz.travelAlterEgo);
  const text = `${place.name} ${(place.types || []).join(' ')}`.toLowerCase();
  let score = Number.isFinite(place.rating) ? Math.max(0, Math.min(5, place.rating)) : 0;
  if (tags.includes('food') && place.category === 'food') score += 4;
  if (tags.includes('history') && /museum|historic|heritage|art_gallery|cultural/.test(text)) score += 6;
  if (tags.includes('nature') && /park|garden|hiking|nature|wildlife|beach/.test(text)) score += 6;
  if (tags.includes('spa') && /spa|wellness|beach|garden/.test(text)) score += 6;
  const restrictions = Array.isArray(quiz.dietaryRestrictions)
    ? quiz.dietaryRestrictions
    : quiz.dietaryRestrictions ? [quiz.dietaryRestrictions] : [];
  if (restrictions.some(value => /vegetarian|vegan/i.test(value)) &&
      place.category === 'food' && /vegetarian|vegan/.test(text)) score += 4;
  const price = {PRICE_LEVEL_FREE:0,PRICE_LEVEL_INEXPENSIVE:1,PRICE_LEVEL_MODERATE:2,PRICE_LEVEL_EXPENSIVE:3,PRICE_LEVEL_VERY_EXPENSIVE:4}[place.priceLevel];
  const budget = {$:1,$$:2,$$$:4}[quiz.budgetLevel];
  if (price !== undefined && budget !== undefined && price > budget) score -= 8;
  return score;
}

function defaultTheme(day) {
  if (day.type === 'arrival') return `Arrive and settle into ${day.locationName}`;
  if (day.type === 'transfer') return `Travel to ${day.locationName}`;
  if (day.type === 'departure') return `A final morning in ${day.locationName}`;
  return `Explore ${day.locationName}`;
}

function description(place, slot) {
  // Use only supplied category/type data. Practical checks live in travelTip.
  if (place.category === 'food') return {
    morning: 'Take a break for something to eat, leaving time to enjoy your meal at your own pace.',
    afternoon: 'Pause for a meal between today’s visits before continuing your exploration.',
    evening: 'Wind down over a meal and leave the rest of the evening flexible.',
  }[slot];
  if (place.types?.includes('museum')) return 'Explore the museum at your own pace, focusing on the exhibits that interest you most.';
  if (place.types?.some(type => ['park', 'botanical_garden', 'garden'].includes(type))) return 'Spend some time exploring the grounds, choosing a pace and distance that feel comfortable.';
  if (place.types?.includes('art_gallery')) return 'Browse the gallery and take time with the works that catch your attention.';
  return 'Explore this stop at your own pace, with room to follow your interests and take breaks.';
}

function buildDailyPlan({ outline, schedule, discovered, quiz = {} }) {
  const locations = new Map(discovered.map(location => [location.locationId || location.stopId, location.candidatePlaces]));
  const choices = new Map();
  for (const day of schedule) {
    const seen = new Set();
    const available = (locations.get(day.locationId) || []).filter(place => {
      if (!place.placeId || seen.has(place.placeId) || !isValidLocation(place) ||
          place.stopId !== day.stopId || (place.locationId || place.stopId) !== day.locationId) return false;
      seen.add(place.placeId);
      return true;
    }).map(place => ({place, slots:openSlots(place, day)})).filter(choice => choice.slots.length);
    for (const choice of available) {
      const nearby = available.filter(other => distanceKm(choice.place, other.place) <= TRIP_POLICY.maxDailyActivitySpreadKm);
      choice.score = preferenceScore(choice.place, quiz) + Math.min(5, nearby.length) * 5 +
        (isSightseeing(day) && choice.place.category !== 'food' ? 20 : 0) +
        (nearby.some(other => other.place.category === 'food') ? 5 : 0);
    }
    available.sort((a,b) => b.score-a.score || a.place.placeId.localeCompare(b.place.placeId));
    choices.set(day.day, available);
  }

  // Reserve one distinct open venue for every sightseeing day before filling
  // extras. Matching can reassign an earlier day so a scarce later day isn't
  // left empty by a greedy choice. Arrival/transfer/departure may be free time.
  const owner = new Map(), seeds = new Map();
  function reserve(day, visited) {
    for (const choice of choices.get(day.day)) {
      const id = choice.place.placeId;
      if (visited.has(id)) continue;
      visited.add(id);
      const previous = owner.get(id);
      if (!previous || reserve(previous, visited)) {
        owner.set(id, day); seeds.set(day.day, choice); return true;
      }
    }
    return false;
  }
  const required = schedule.filter(isSightseeing).sort((a,b) => choices.get(a.day).length-choices.get(b.day).length || a.day-b.day);
  for (const day of required) {
    if (!reserve(day, new Set())) {
      throw apiError('INSUFFICIENT_VENUES', `Not enough distinct venues with compatible opening hours to cover day ${day.day} in ${day.locationName}. Try a shorter stay or different dates.`, 422);
    }
  }

  const days = schedule.map(day => ({day:day.day,stopId:day.stopId,theme:defaultTheme(day),morning:[],afternoon:[],evening:[]}));
  const used = new Set();
  function add(day, choice, slot) {
    day[slot].push({placeId:choice.place.placeId,activityDescription:description(choice.place,slot)});
    used.add(choice.place.placeId);
  }
  for (const day of days) {
    const seed = seeds.get(day.day);
    if (seed) add(day, seed, seed.slots[0]);
  }
  // Fill fairly across days instead of consuming all candidates on early days.
  // Each addition must fit every selected venue, not just an area centroid.
  for (let round=0; round<TRIP_POLICY.maxActivitiesPerFullDay; round++) {
    for (const [index, day] of days.entries()) {
      const expected = schedule[index], available = choices.get(day.day);
      const selected = activities(day).map(activity => available.find(choice => choice.place.placeId === activity.placeId).place);
      const max = ['full','visit'].includes(expected.type) && isRelaxed(quiz) ? TRIP_POLICY.maxActivitiesPerRelaxedDay : expected.maxActivities;
      if (selected.length >= max) continue;
      const foodCount = selected.filter(place => place.category === 'food').length;
      const wantedMeals = personaTags(quiz.travelAlterEgo).includes('food') && !isRelaxed(quiz) ? 2 : 1;
      const options = available.filter(choice => !used.has(choice.place.placeId) &&
        selected.every(place => distanceKm(place, choice.place) <= TRIP_POLICY.maxDailyActivitySpreadKm))
        .flatMap(choice => choice.slots.filter(slot => day[slot].length < 2).map(slot => ({
          choice, slot,
          score:preferenceScore(choice.place, quiz) + (day[slot].length===0 ? 20 : 0) +
            (choice.place.category==='food' && foodCount<wantedMeals ? 15 : 0) +
            (choice.place.category==='food' && slot!=='morning' ? 3 : 0) -
            (choice.place.category==='food' && foodCount>=wantedMeals ? 10 : 0),
        }))).sort((a,b) => b.score-a.score || a.choice.place.placeId.localeCompare(b.choice.place.placeId) || SLOTS.indexOf(a.slot)-SLOTS.indexOf(b.slot));
      if (options.length) add(day, options[0].choice, options[0].slot);
    }
  }
  return {
    tripTitle:`${outline.country} — ${outline.numberOfDays} day${outline.numberOfDays===1?'':'s'}`,
    summary:`A ${outline.numberOfDays}-day, ${outline.numberOfNights}-night trip through ${outline.stops.map(stop=>stop.name).join(' and ')}, with activities grouped by area and time reserved for travel.`,
    days,
  };
}

module.exports = { buildDailyPlan };
