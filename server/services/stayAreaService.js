const catalog = require('../data/stayAreas.json');
const {recommendNeighborhoods} = require('./neighborhoodRecommendationService');

function catalogAreas(destinationId) {
  return (catalog.areas[destinationId] || []).map(area=>({...area,
    source:'reviewed_catalog',reviewedOn:catalog.reviewedOn,reviewScope:catalog.reviewScope,
    rationale:`Consider ${area.name} as a starting area for your accommodation search. This is a sourced editorial option; compare its location with your itinerary and confirm prices, access and transport before booking.`,
  }));
}

function recommendStayAreas(destinationId, grouped) {
  const live = recommendNeighborhoods(grouped).map(area=>({...area,source:'google_places',
    rationale:'This area ranks well for straight-line proximity to the supplied activities. Actual travel times and accommodation availability are unverified.'}));
  return live.length ? live : catalogAreas(destinationId);
}

function stayForStop(stop, grouped) {
  const areas = recommendStayAreas(stop.destinationId,grouped);
  return {stopId:stop.stopId,destinationId:stop.destinationId,name:stop.name,nights:stop.nights,
    recommendedStayArea:areas[0]?.name || null,
    stayAreaRationale:areas[0]?.rationale || 'No sourced accommodation area is available for this base.',
    stayAreaSource:areas[0]?.source || null,
    stayAreaProvenance:areas[0]?.source === 'reviewed_catalog' ? {
      sourceUrl:areas[0].sourceUrl,sourceType:areas[0].sourceType,reviewedOn:areas[0].reviewedOn,reviewScope:areas[0].reviewScope,
    } : null,
    alternatives:areas.slice(1),
  };
}

// Google-derived neighborhood names/centroids are refreshed for display only.
// Sourced editorial catalog suggestions can be retained with the saved trip.
function storedStay(stay) {
  if (stay.stayAreaSource === 'reviewed_catalog') return {
    stopId:stay.stopId,destinationId:stay.destinationId,name:stay.name,nights:stay.nights,
    recommendedStayArea:stay.recommendedStayArea,stayAreaRationale:stay.stayAreaRationale,
    stayAreaSource:stay.stayAreaSource,stayAreaProvenance:stay.stayAreaProvenance,alternatives:[],
  };
  return stayForStop(stay,{});
}

module.exports = {catalogAreas,recommendStayAreas,stayForStop,storedStay};
