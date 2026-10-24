// Conservative country-planning eligibility. A nearby business address or a
// 24-hour office listing does not establish a visitor activity or tour duration.
const VISIT_TYPES=new Set([
  'tourist_attraction','museum','art_gallery','cultural_center','cultural_landmark',
  'historical_landmark','historical_place','monument','sculpture','castle',
  'park','national_park','state_park','botanical_garden','garden','city_park',
  'hiking_area','beach','observation_deck','scenic_spot','wildlife_park','zoo','aquarium',
  'amusement_park','amusement_center','water_park','performing_arts_theater',
  'concert_hall','opera_house','planetarium','library','market','farmers_market','flea_market',
  'church','mosque','hindu_temple','buddhist_temple','shinto_shrine','synagogue',
  'spa','wellness_center','hot_spring','public_bath','swimming_pool',
]);
const OPERATORS=new Set(['tour_agency','travel_agency','tourist_information_center']);
function isVisitCandidate(place) {
  const types=[...(place.types||[]),place.primaryType].filter(Boolean);
  if(types.some(type=>OPERATORS.has(type)))return false;
  // Some operators only have generic Google types; explicit agency/tour-company
  // names remain ineligible even if a broad tourist_attraction tag is present.
  if(/\b(?:tour operator|travel agency|safaris?\s*(?:&|and)?\s*tours?|tours?\s*(?:&|and)\s*(?:safaris?|travel))\b/i.test(place.name||''))return false;
  if(place.category==='food')return types.some(type=>/restaurant|cafe|coffee_shop|bakery|bar$|meal_takeaway|ice_cream_shop/.test(type));
  return types.some(type=>VISIT_TYPES.has(type));
}
module.exports={isVisitCandidate};
