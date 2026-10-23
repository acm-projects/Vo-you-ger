const google=require('./googlePlacesService');
const data=require('./planningDataService');
const {normalizePlace}=require('./placeNormalizer');
const {distanceKm}=require('./placeGroupingService');
const {recommendNeighborhoods}=require('./neighborhoodRecommendationService');
const {mapLimit}=require('./telemetryService');
const {TRIP_POLICY}=require('../config/tripPolicy');
const {apiError}=require('./apiError');
const {checkHours}=require('./countryItineraryService');
async function refreshDay(trip,dayNumber) {
  if(!Number.isInteger(dayNumber)||dayNumber<1||dayNumber>TRIP_POLICY.maxSupportedDays) throw apiError('INVALID_DAY','day must be an integer from 1 to 21');
  const itinerary=trip.itinerary,day=itinerary?.days?.find(day=>day.day===dayNumber);
  if(!day) throw apiError('DAY_NOT_FOUND','Day not found',404);
  const activities=['morning','afternoon','evening'].flatMap(slot=>day[slot]||[]);
  if(activities.length>TRIP_POLICY.maxActivitiesPerFullDay) throw apiError('TOO_MANY_VENUES','This legacy day requires a smaller venue refresh request',422);
  const excursion=itinerary.outline?.excursions?.find(item=>item.day===dayNumber)||day.excursion;
  const locationId=excursion?.destinationId||itinerary.outline?.stops?.find(stop=>stop.stopId===day.stopId)?.destinationId;
  const location=data.destinationById.get(locationId);
  const anchor=excursion ? data.excursions.find(item=>item.destinationId===locationId && item.fromDestinationId===itinerary.outline?.stops?.find(stop=>stop.stopId===day.stopId)?.destinationId) : location?.planning||location?.coordinates;
  const countryCode=itinerary.outline?.countryCode||itinerary.countryCode||itinerary.practicalInfo?.countryCode;
  if(itinerary.schemaVersion===2 && (!anchor||!countryCode)) throw apiError('VENUE_LOCATION_UNAVAILABLE','This saved location needs a new itinerary before its venues can be verified',422);
  const unique=[...new Map(activities.map(activity=>[activity.placeId,activity])).values()];
  const places=await mapLimit(unique,TRIP_POLICY.placesConcurrency,async activity=>{
    const raw=await google.getPlaceDetails(activity.placeId);
    const place=normalizePlace(raw,activity.category||'attractions');
    if(!place || place.placeId!==activity.placeId || (countryCode && place.countryCode!==countryCode) || (anchor && distanceKm(anchor,place)>(anchor.radiusKm||15))) throw apiError('VENUE_NO_LONGER_ELIGIBLE','A saved venue is closed, relocated, or outside the supported location. Generate a new itinerary to replace it.',502);
    const slot=['morning','afternoon','evening'].find(slot=>day[slot]?.some(item=>item.placeId===activity.placeId));
    if(day.dayOfWeek && slot) {
      try {checkHours(place,day.dayOfWeek,slot);}
      catch {throw apiError('VENUE_NO_LONGER_ELIGIBLE','A venue no longer has compatible regular hours. Generate a new itinerary to replace it.',502);}
    }
    const line=place.openingHours?.find(text=>text.toLowerCase().startsWith(`${day.dayOfWeek?.toLowerCase()}:`));
    return {...place,placeName:place.name,hoursToday:line?line.slice(line.indexOf(':')+1).trim():null,attributions:raw.attributions||[]};
  });
  if(places.some(a=>places.some(b=>distanceKm(a,b)>TRIP_POLICY.maxDailyActivitySpreadKm))) throw apiError('VENUE_NO_LONGER_ELIGIBLE','The refreshed venues are too far apart for this day. Generate a new itinerary.',502);
  const grouped=Object.fromEntries(['attractions','food','experiences'].map(category=>[category,places.filter(place=>place.category===category)]));
  return {day:dayNumber,places,recommendedNeighborhoods:day.excursion?[]:recommendNeighborhoods(grouped),attribution:{provider:'Google Maps',requiresDisplay:true},persisted:false};
}
module.exports={refreshDay};
