const {TRIP_POLICY}=require('../config/tripPolicy');
const {mapLimit,count}=require('./telemetryService');
const queries = require("./placesQueryBuilder");
const google = require("./googlePlacesService");
const { normalizePlaces } = require("./placeNormalizer");
const { distanceKm, groupPlacesByGeography } = require("./placeGroupingService");
const { recommendNeighborhoods } = require("./neighborhoodRecommendationService");
const { supportedBases, planningError, validateOutline } = require("./tripOutlineService");
const {apiError}=require('./apiError');
const destinations = require("../data/destinations.json");
const catalog = require("./planningDataService");
const {isVisitCandidate}=require('./venueEligibilityService');

async function discoverStops(outline, quiz) {
  validateOutline(outline,quiz);
  const targets = [
    ...outline.stops.map((stop) => ({ ...stop, locationId: stop.stopId })),
    ...(outline.excursions || []).map((excursion) => ({ ...excursion, locationId: `excursion:${excursion.stopId}:${excursion.destinationId}`, isExcursion: true })),
  ];
  // Locations are sequential; category searches share the two-request bound.
  return await mapLimit(targets, 1, async (stop) => {
    const excursion = stop.isExcursion && catalog.excursions.find((item) => item.destinationId === stop.destinationId && item.fromDestinationId === outline.stops.find((base) => base.stopId === stop.stopId)?.destinationId);
    const base = excursion
      ? { ...destinations.find((item) => item.id === stop.destinationId), ...excursion, id: excursion.destinationId }
      : supportedBases(outline.countryCode, quiz).find((item) => item.id === stop.destinationId);
    if (!base) throw planningError("Unsupported stop");
    const generated = await queries.buildPlacesQueries({ destination: base, quiz });
    const searched = await google.searchPlacesForQueries(generated.queries, base, { pageSize: TRIP_POLICY.placesPageSize });
    const normalized = normalizePlaces(searched.places);
    const filtered = Object.fromEntries(Object.entries(normalized).map(([category, places]) => [category,
      places.filter((place) => isVisitCandidate(place) && place.countryCode === outline.countryCode && distanceKm(base, place) <= base.radiusKm)
        .map((place) => ({ ...place, stopId: stop.stopId, locationId: stop.locationId })),
    ]));
    // Round-robin categories so large attraction pools cannot displace all food.
    const candidatePlaces=[];
    const pools=Object.values(filtered);
    for(let index=0; candidatePlaces.length<TRIP_POLICY.maxCandidatesPerLocation && pools.some(pool=>index<pool.length); index++) {
      for(const pool of pools) if(pool[index] && candidatePlaces.length<TRIP_POLICY.maxCandidatesPerLocation) candidatePlaces.push(pool[index]);
    }
    count("selectedCandidates",candidatePlaces.length);
    if (!candidatePlaces.length) {
      throw apiError('NO_USABLE_PLACES',`No visitable places with verified locations found for ${stop.name}; try again later`,502);
    }
    return {
      stopId: stop.stopId, locationId: stop.locationId, isExcursion: Boolean(stop.isExcursion), destinationId: stop.destinationId, name: stop.name,
      candidatePlaces,
      groupedPlaces: groupPlacesByGeography(filtered),
      recommendedNeighborhoods: recommendNeighborhoods(filtered),
    };
  });
}

module.exports = { discoverStops };
