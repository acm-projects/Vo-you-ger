const {validateOutline}=require('./tripOutlineService');
const {buildSchedule}=require('./countryItineraryService');
const {apiError}=require('./apiError');

function storedItinerary(itinerary) {
  if(itinerary.schemaVersion!==2) return itinerary; // Non-destructive legacy support.
  validateOutline(itinerary.outline);
  const schedule=buildSchedule(itinerary.outline,itinerary.outline.startDate);
  if(itinerary.days.length!==schedule.length||itinerary.days.some((day,index)=>day.day!==schedule[index].day||day.date!==schedule[index].date||day.stopId!==schedule[index].stopId)) throw apiError('INVALID_ITINERARY','Itinerary dates or bases disagree with its outline');
  const seen = new Set();
  for (const [index, day] of itinerary.days.entries()) {
    const expected = schedule[index];
    let activities = 0;
    for (const slot of ['morning', 'afternoon', 'evening']) {
      if (!Array.isArray(day[slot]) || (!expected.allowedSlots.includes(slot) && day[slot].length)) throw apiError('INVALID_ITINERARY', 'Activities conflict with reserved travel time');
      for (const activity of day[slot]) {
        if (typeof activity.placeId !== 'string' || !activity.placeId.trim() || seen.has(activity.placeId) || !['food','attractions','experiences'].includes(activity.category)) throw apiError('INVALID_ITINERARY', 'Activities require distinct place IDs and supported categories');
        seen.add(activity.placeId);
        activities++;
      }
    }
    if (activities > expected.maxActivities || (['full','visit','excursion'].includes(expected.type) && activities === 0)) throw apiError('INVALID_ITINERARY', 'Activity counts violate the trip policy');
  }
  const result={};
  for(const field of ['schemaVersion','tripTitle','summary','destination','countryCode','outline','tripSummary','planningNotes','promptVersion','catalogAttribution','schedulerVersion','narrativeSource','narrativeFallbackReason','practicalInfo']) result[field]=itinerary[field] ?? null;
  result.placesStoredAs='ids_only';
  result.stays=(itinerary.stays||[]).map(stay=>({stopId:stay.stopId,destinationId:stay.destinationId,name:stay.name,nights:stay.nights,recommendedStayArea:null,stayAreaRationale:'Open a day at this base to see a suggested accommodation area near its activities.',alternatives:[]}));
  result.days=itinerary.days.map(day=>{
    const saved={};
    for(const field of ['day','date','dayOfWeek','theme','stopId','locationId','locationName','type','transfer','excursion']) saved[field]=day[field] ?? null;
    for(const slot of ['morning','afternoon','evening']) saved[slot]=(day[slot]||[]).map(activity=>({placeId:activity.placeId,category:activity.category,activityDescription:activity.activityDescription,travelTip:activity.travelTip ?? null,travelTipSource:activity.travelTipSource ?? null}));
    return saved;
  });
  if(Buffer.byteLength(JSON.stringify(result))>300000) throw apiError('ITINERARY_TOO_LARGE','Itinerary exceeds the persistence size limit',413);
  return result;
}
module.exports={storedItinerary};
