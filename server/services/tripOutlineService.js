const catalog = require("./planningDataService");
const destinations = require("../data/destinations.json");
const { validateStartDate } = require("./tripTimingService");

const BUDGET = { $: 1, $$: 2, $$$: 3 };
const { TRIP_POLICY, maxBasesForDays, minimumNights } = require('../config/tripPolicy');
const weights = require('../config/scoringWeights');
const { scoreDestination, isRelaxed, wantsVariety } = require('./destinationScoringService');
const { apiError } = require('./apiError');
const { measuredSync } = require('./telemetryService');

function planningError(message, statusCode = 400) {
  const code = /countryId/.test(message) ? 'UNSUPPORTED_COUNTRY' : /night|duration|calendar days|day allocation/i.test(message) ? 'INVALID_DURATION' : statusCode === 502 ? 'INVALID_AI_OUTPUT' : 'INVALID_TRIP';
  return apiError(code, message, statusCode);
}

function isCountryTrip(trip) {
  return trip?.schemaVersion === 2 || Boolean(trip?.recommendations?.length &&
    trip.recommendations.every((item) => item.type === "country" && item.destinationId?.startsWith("country-")));
}

// Days are calendar days at the destination, including light arrival/departure
// days. Four nights mean five days. International travel is not estimated.
function resolveDuration(quiz = {}, numberOfDays, numberOfNights) {
  if (numberOfNights != null && (!Number.isInteger(numberOfNights) || numberOfNights < 0 || numberOfNights >= TRIP_POLICY.maxSupportedDays)) {
    throw planningError("numberOfNights must be an integer from 0 to 20");
  }
  if (numberOfDays != null && numberOfNights != null && numberOfDays !== numberOfNights + 1) {
    throw planningError("numberOfDays and numberOfNights disagree");
  }
  const days = numberOfDays ?? (numberOfNights != null ? numberOfNights + 1 : (quiz.minNights ?? quiz.maxNights ?? 5) + 1);
  if (!Number.isInteger(days) || days < TRIP_POLICY.minSupportedDays || days > TRIP_POLICY.maxSupportedDays) {
    throw planningError("Country trips support 1–21 calendar days at the destination");
  }
  if (quiz.minNights != null && days - 1 < quiz.minNights) {
    throw planningError("Trip duration is shorter than minNights");
  }
  if (quiz.maxNights != null && days - 1 > quiz.maxNights) {
    throw planningError("Trip duration exceeds maxNights");
  }
  return days;
}

function supportedBases(countryCode, quiz = {}) {
  return (catalog.basesByCountry.get(countryCode) || []).flatMap((base) => {
    const destination = catalog.destinationById.get(base.destinationId);
    if (!destination || destination.countryCode !== countryCode) return [];
    if (BUDGET[quiz.budgetLevel] && BUDGET[destination.budget] > BUDGET[quiz.budgetLevel]) return [];
    if (quiz.highRiskDestWillingness === false && (typeof destination.safety !== 'number' || destination.safety > 1)) return [];
    return [{ ...destination, ...base }];
  });
}

function baseScore(base, quiz) { return scoreDestination(base, quiz).score / 10; }

let indexedConnections;
let edgesByPair;
function connectionBetween(from, to, quiz = {}) {
  if(indexedConnections!==catalog.connections) {
    indexedConnections=catalog.connections; edgesByPair=new Map();
    for(const edge of indexedConnections) for(const [a,b] of [[edge.from,edge.to],...(edge.bidirectional?[[edge.to,edge.from]]:[])]) {
      const key=`${a}::${b}`;if(!edgesByPair.has(key))edgesByPair.set(key,[]);edgesByPair.get(key).push(edge);
    }
  }
  const modes = quiz.intercityTransportModes ?? quiz.transportModes;
  return (edgesByPair.get(`${from}::${to}`)||[]).filter(edge=>edge.domesticOnly===true && edge.planningMinutes<=TRIP_POLICY.maxTransferMinutes && edge.status==='reviewed' && (!modes?.length||modes.includes(edge.mode)))
    .sort((a,b)=>a.planningMinutes-b.planningMinutes||a.mode.localeCompare(b.mode))[0];
}

function countryCandidates(quiz = {}, visaFreeCountryCodes = null) {
  const days = resolveDuration(quiz);
  return catalog.countries.flatMap((country) => {
    if (visaFreeCountryCodes && !visaFreeCountryCodes.has(country.countryCode)) return [];
    const bases = supportedBases(country.countryCode, quiz).filter((base) => minimumNights(base, days) <= days - 1);
    if (!bases.length) return [];
    const outline = buildOutline({ countryId: country.id, quiz, startDate: quiz.startDate });
    return [{
      ...country, type: "country", country: country.name,
      suggestedRoute: {
        destinationIds: outline.stops.map((stop) => stop.destinationId),
        bases: outline.stops.map((stop) => stop.name),
        excursions: outline.excursions.map((excursion) => excursion.name),
        nights: outline.stops.map((stop) => stop.nights),
        transferMinutes: outline.transfers.reduce((sum, transfer) => sum + transfer.planningMinutes, 0),
      },
      // Keep regional attributes separate; there is no single national climate/budget.
      supportedBases: bases.map((base) => ({
        destinationId: base.id, name: base.name, region: base.region,
        tags: base.tags, budget: base.budget, bestMonths: base.bestMonths,
        climate: base.climate, safety: base.safety, minNights: base.minNights,
      })),
    }];
  });
}

// Enumerate small domestic paths before choosing a starting city. This also
// exposes route coverage for tests and maintenance without using an LLM.
function enumerateRoutes(bases, quiz, days, connect = connectionBetween) {
  const maxBases = isRelaxed(quiz) ? 1 : maxBasesForDays(days);
  const scores=new Map(bases.map(base=>[base.id,baseScore(base,quiz)]));
  const grades=new WeakMap();
  const grade=route=>{
    if(!grades.has(route)) {
      const quality=route.reduce((sum,base)=>sum+scores.get(base.id),0)/route.length;
      const hours=route.slice(1).reduce((sum,base,index)=>sum+connect(route[index].id,base.id,quiz).planningMinutes/60,0);
      grades.set(route,quality+(route.length-1)*((wantsVariety(quiz)?weights.seeAllVariety:weights.routeVariety)-weights.baseChangePenalty)-hours*weights.transferHoursPenalty);
    }
    return grades.get(route);
  };
  const ranked = [...bases].sort((a,b) => scores.get(b.id)-scores.get(a.id) || a.id.localeCompare(b.id));
  const candidates = ranked.slice(0,TRIP_POLICY.candidateBaseLimit);
  let beam = candidates.map(base=>[base]).filter(path=>minimumNights(path[0],days)<=days-1);
  const routes = [...beam];
  for(let depth=2;depth<=maxBases && beam.length;depth++) {
    const next=[];
    for(const path of beam) for(const base of candidates) {
      if(path.some(item=>item.id===base.id) || !connect(path.at(-1).id,base.id,quiz)) continue;
      if([...path,base].reduce((sum,item)=>sum+minimumNights(item,days),0)>days-1) continue;
      next.push([...path,base]);
    }
    beam=next.sort((a,b)=>grade(b)-grade(a)||a.map(x=>x.id).join(',').localeCompare(b.map(x=>x.id).join(','))).slice(0,TRIP_POLICY.routeBeamWidth);
    routes.push(...beam);
  }
  return routes;
}

function routeScore(route, quiz, connect = connectionBetween) {
  const interest = route.reduce((sum, base) => sum + baseScore(base, quiz), 0) / route.length;
  const varietyWeight = wantsVariety(quiz) ? weights.seeAllVariety : weights.routeVariety;
  const transferHours = route.slice(1).reduce((sum, base, index) => sum + connect(route[index].id, base.id, quiz).planningMinutes / 60, 0);
  // Reward variety but account for time consumed moving bases. Entire routes
  // compete, so an unconnected top-scoring city cannot hide a good regional trip.
  return interest + (route.length - 1) * varietyWeight - transferHours * weights.transferHoursPenalty - (route.length - 1) * weights.baseChangePenalty;
}

function allocateNights(route, nights, quiz) {
  const allocations = route.map((base) => minimumNights(base, nights + 1));
  let remaining = nights - allocations.reduce((sum, value) => sum + value, 0);
  while (remaining-- > 0) {
    const index = route.map((base, index) => ({ index, value: allocations[index] - baseScore(base, quiz) / 10 }))
      .sort((a, b) => a.value - b.value || a.index - b.index)[0].index;
    allocations[index]++;
  }
  return allocations;
}

function chooseExcursions(stops, countryCode, quiz) {
  const modes = quiz.intercityTransportModes ?? quiz.transportModes;
  return stops.flatMap((stop) => {
    if (stop.nights < 4) return [];
    const excursion = (catalog.excursions || []).filter((item) => {
      const destination = destinations.find((destination) => destination.id === item.destinationId);
      return item.fromDestinationId === stop.destinationId && item.domesticOnly === true &&
        item.roundTripPlanningMinutes <= TRIP_POLICY.maxExcursionMinutes && destination?.countryCode === countryCode &&
        (!BUDGET[quiz.budgetLevel] || BUDGET[destination.budget] <= BUDGET[quiz.budgetLevel]) &&
        (quiz.highRiskDestWillingness !== false || (typeof destination.safety==='number' && destination.safety <= 1)) &&
        (!modes?.length || modes.includes(item.mode));
    }).sort((a, b) => a.destinationId.localeCompare(b.destinationId))[0];
    if (!excursion) return [];
    const destination = destinations.find((item) => item.id === excursion.destinationId);
    return [{ ...excursion, name: destination.name, countryCode, stopId: stop.stopId, day: stop.startDay + 2 }];
  });
}

function buildOutline(params) {
  return measuredSync('routeSelection', () => selectOutline(params));
}

function selectOutline({ countryId, quiz = {}, numberOfDays, numberOfNights, startDate }) {
  const country = catalog.countries.find((item) => item.id === countryId);
  if (!country) throw apiError('UNSUPPORTED_COUNTRY', 'Unsupported countryId');
  if (!country.planningAvailable) throw apiError('COUNTRY_NOT_READY', 'This registered country has no reviewed planning bases', 422);
  const arrivalDate = startDate ?? quiz.startDate;
  if (arrivalDate != null) validateStartDate(arrivalDate);
  const effectiveQuiz = arrivalDate
    ? { ...quiz, startDate:arrivalDate, months: [new Date(`${arrivalDate}T12:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" })] }
    : quiz;
  const days = resolveDuration(quiz, numberOfDays, numberOfNights);
  const nights = days - 1;
  const bases = supportedBases(country.countryCode, quiz).filter((base) => minimumNights(base, days) <= nights);
  const routes = enumerateRoutes(bases, effectiveQuiz, days).sort((a, b) =>
    routeScore(b, effectiveQuiz) - routeScore(a, effectiveQuiz) ||
    a.map((base) => base.id).join(",").localeCompare(b.map((base) => base.id).join(",")));
  if (!routes.length) throw apiError('NO_FEASIBLE_ROUTE', "No supported route fits these constraints", 422);
  const selected = routes[0];
  const allocations = allocateNights(selected, nights, effectiveQuiz);
  let startDay = 1;
  const stops = selected.map((base, index) => {
    const stop = {
      stopId: `stop-${index + 1}`, destinationId: base.id, name: base.name,
      countryCode: country.countryCode, region: base.region,
      nights: allocations[index], stopType: nights === 0 ? "visit" : "overnight", startDay, endDay: startDay + allocations[index] - 1,
    };
    startDay += allocations[index];
    return stop;
  });
  stops.at(-1).endDay = days;
  const transfers = selected.slice(1).map((base, index) => {
    const connection = connectionBetween(selected[index].id, base.id, quiz);
    return {
      fromStopId: stops[index].stopId, toStopId: stops[index + 1].stopId,
      day: stops[index + 1].startDay, mode: connection.mode,
      planningMinutes: connection.planningMinutes, sourceUrl: connection.sourceUrl,
      reviewedOn: connection.reviewedOn,
      note: "Planning allowance including local access and changing accommodation; not a timetable or booking.",
    };
  });
  const outline = {
    schemaVersion: 2, catalogVersion: catalog.version, policyVersion: TRIP_POLICY.version, scoringVersion: weights.version,
    countryId, country: country.name, countryCode: country.countryCode,
    numberOfDays: days, numberOfNights: nights, startDate: arrivalDate || null,
    stops, transfers, excursions: chooseExcursions(stops, country.countryCode, quiz),
    arrivalDestinationId: selected[0].id, departureDestinationId: selected.at(-1).id,
    durationBasis: "Calendar days at destination, including arrival and departure; international travel excluded.",
    rationale: selected.length > 1
      ? `${selected.length} bases selected by comparing complete routes for interests, variety, minimum stays, and transfer time. Arrival and departure use different bases.`
      : "One base fits the duration, pace, or supported connections best; nearby excursions can add variety without changing accommodation.",
  };
  validateOutline(outline, quiz);
  return outline;
}

function validateOutline(outline, quiz = {}) {
  const country = catalog.countries.find((item) => item.id === outline.countryId);
  const days = resolveDuration(quiz, outline.numberOfDays, outline.numberOfNights);
  if(outline.startDate != null) validateStartDate(outline.startDate);
  const bases = supportedBases(country?.countryCode, quiz);
  if (!country || outline.countryCode !== country.countryCode ||
      !Array.isArray(outline.stops) || !outline.stops.length || outline.stops.length > maxBasesForDays(days) ||
      (isRelaxed(quiz) && outline.stops.length > 1)) {
    throw planningError("Invalid country trip outline");
  }
  const seen = new Set();
  const stopIds = new Set();
  let totalNights = 0;
  for (const [index, stop] of outline.stops.entries()) {
    const base = bases.find((item) => item.id === stop.destinationId);
    if (!base || seen.has(base.id) || stopIds.has(stop.stopId) || !stop.stopId ||
        stop.countryCode !== country.countryCode ||
        !Number.isInteger(stop.nights) || stop.nights < minimumNights(base, days) || (stop.nights===0 && (days!==1 || outline.stops.length!==1 || stop.stopType!=="visit")) ||
        stop.startDay !== totalNights + 1 ||
        stop.endDay !== totalNights + stop.nights + (index === outline.stops.length - 1 ? 1 : 0)) {
      throw planningError("Unsupported stop, country, stay length, or day allocation");
    }
    seen.add(base.id);
    stopIds.add(stop.stopId);
    totalNights += stop.nights;
  }
  if (totalNights !== days - 1 || outline.numberOfNights !== totalNights ||
      outline.arrivalDestinationId !== outline.stops[0].destinationId ||
      outline.departureDestinationId !== outline.stops.at(-1).destinationId ||
      !Array.isArray(outline.transfers) || outline.transfers.length !== outline.stops.length - 1) {
    throw planningError("Outline duration or connections are inconsistent");
  }
  for (const [index, transfer] of outline.transfers.entries()) {
    const from = outline.stops[index];
    const to = outline.stops[index + 1];
    const connection = connectionBetween(from.destinationId, to.destinationId, quiz);
    if (!connection || transfer.fromStopId !== from.stopId || transfer.toStopId !== to.stopId ||
        transfer.day !== to.startDay || transfer.mode !== connection.mode ||
        transfer.planningMinutes !== connection.planningMinutes || transfer.sourceUrl !== connection.sourceUrl) {
      throw planningError("Unsupported transfer or transport preference");
    }
  }
  const excursionDays = new Set();
  const excursionStops = new Set();
  for (const excursion of outline.excursions || []) {
    const stop = outline.stops.find((stop) => stop.stopId === excursion.stopId);
    const supported = (catalog.excursions || []).find((item) => item.fromDestinationId === stop?.destinationId && item.destinationId === excursion.destinationId);
    const modes = quiz.intercityTransportModes ?? quiz.transportModes;
    const destination = destinations.find((item) => item.id === excursion.destinationId);
    if (!supported || !destination || !supported.domesticOnly || supported.roundTripPlanningMinutes > TRIP_POLICY.maxExcursionMinutes || destination.countryCode !== country.countryCode ||
        excursion.countryCode !== country.countryCode || stop.nights < 4 ||
        !Number.isInteger(excursion.day) || excursion.day <= stop.startDay || excursion.day >= stop.endDay ||
        excursionDays.has(excursion.day) || excursionStops.has(excursion.stopId) || excursion.roundTripPlanningMinutes !== supported.roundTripPlanningMinutes ||
        excursion.mode !== supported.mode || excursion.sourceUrl !== supported.sourceUrl ||
        (modes?.length && !modes.includes(excursion.mode)) ||
        (BUDGET[quiz.budgetLevel] && BUDGET[destination.budget] > BUDGET[quiz.budgetLevel]) ||
        (quiz.highRiskDestWillingness === false && (typeof destination.safety!=='number' || destination.safety > 1))) {
      throw planningError("Unsupported excursion, day allocation, or transport preference");
    }
    excursionDays.add(excursion.day);
    excursionStops.add(excursion.stopId);
  }
  return outline;
}

module.exports = { planningError, isCountryTrip, resolveDuration, supportedBases, countryCandidates, buildOutline, validateOutline, enumerateRoutes, baseScore, routeScore };
