function narrativeFor(payload) {
  return {tripTitle:'A personalized journey',summary:'A route shaped around your interests and preferred pace.',
    dayThemes:payload.days.map(day=>({day:day.day,theme:`Discover ${day.location}`})),
    activityDescriptions:payload.places.map(place=>({placeId:place.placeId,description:'Take time to explore this suggested stop at your preferred pace.'})),
  };
}
module.exports = {narrativeFor};
