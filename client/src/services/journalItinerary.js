const slots = [['morning', 'Morning'], ['afternoon', 'Afternoon'],
  ['evening', 'Evening'], ['lateNight', 'Late night']];

export function venueRefreshIssue(error) {
  const status=error.response?.status,code=error.response?.data?.code;
  const retryAfter=Number(error.response?.headers?.['retry-after']);
  const retrySeconds=Number.isInteger(retryAfter)&&retryAfter>0?Math.min(300,retryAfter):60;
  if(status===401||status===403) return {message:'Your session could not be verified. Sign in again to load venue details.',retryable:false};
  if(code==='GENERATION_RATE_LIMIT'||code==='VENUE_REFRESH_RATE_LIMIT') return {
    message:`Too many trip days were refreshed recently. Please wait ${retrySeconds} seconds before trying again. Your saved plan is still shown.`,retryable:true,retrySeconds};
  if(code==='PLACES_RATE_LIMIT') return {message:'Google Places has reached its request limit. Venue details are temporarily unavailable; your saved plan is still shown.',retryable:true,retrySeconds};
  if(code==='PLACES_TIMEOUT') return {message:'Google Places timed out while loading venue details. Your saved plan is still shown.',retryable:true};
  if(code==='PLACES_NOT_CONFIGURED') return {message:'Venue details are unavailable because Google Places is not configured on the server. Your saved plan is still shown.',retryable:false};
  if(['VENUE_NO_LONGER_ELIGIBLE','VENUE_LOCATION_UNAVAILABLE','TOO_MANY_VENUES'].includes(code)) return {
    message:`${error.response.data.message} Your saved plan is still shown.`,retryable:false};
  if(status===404) return {message:'This trip day could not be found. Reload your trip from the globe.',retryable:false};
  return {message:"Current venue details couldn't be loaded. Your saved plan is still shown.",retryable:true};
}

export function journalDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) return '';
  return new Intl.DateTimeFormat('en', {weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC'})
    .format(new Date(`${value}T12:00:00Z`));
}

export function detailText(value) {
  if (Array.isArray(value)) return value.map(detailText).filter(Boolean).join('\n');
  return ['string', 'number'].includes(typeof value) ? String(value) : '';
}

function priceText(value) {
  const levels = {PRICE_LEVEL_FREE: 'Free', PRICE_LEVEL_INEXPENSIVE: 'Inexpensive',
    PRICE_LEVEL_MODERATE: 'Moderate price level', PRICE_LEVEL_EXPENSIVE: 'Expensive',
    PRICE_LEVEL_VERY_EXPENSIVE: 'Very expensive'};
  return levels[value] || (value === 'PRICE_LEVEL_UNSPECIFIED' ? '' : detailText(value));
}

export function journalDay(day, index, venues = [], needsRefresh = false) {
  const byId = new Map(venues.map(venue => [venue.placeId, venue]));
  const slotted = slots.flatMap(([slot, label]) => (Array.isArray(day[slot]) ? day[slot] : []).map(activity => ({activity, label})));
  const activities = slotted.length ? slotted : (day.activities || day.places || []).map(activity => ({activity, label: ''}));
  return {
    ...day, day: day.day ?? index + 1, date: journalDate(day.date) || day.date || '',
    city: day.locationName || day.city || '', theme: day.theme || day.summary || '',
    places: activities.map(({activity, label}) => {
      const venue = byId.get(activity.placeId) || {};
      const photo = venue.photo || activity.photo || null;
      return {...activity, ...venue,
        photo,
        fallbackPhoto: venue.fallbackPhoto || (activity.photo?.provider === 'unsplash' ? activity.photo : null),
        placeName: venue.placeName || venue.name || activity.placeName || activity.name ||
          (needsRefresh ? 'Loading venue details…' : 'Venue details unavailable'),
        time: activity.time || activity.timeSlot || label,
        activityDescription: activity.activityDescription || activity.description || '',
        travelTip: activity.travelTip || activity.tip || '',
        estimatedCost: priceText(venue.priceLevel || activity.estimatedCost || activity.cost || activity.priceLevel),
        openingHours: detailText(venue.hoursToday || venue.openingHours || activity.openingHours),
        address: venue.address || venue.formattedAddress || activity.address || activity.formattedAddress || '',
        image: photo?.url || venue.imageUrl || venue.photoUrl || activity.imageUrl || activity.photoUrl || activity.image || '',
        category: activity.category || venue.category,
      };
    }),
  };
}

export function journalTrip(trip) {
  const plan = trip?.itinerary;
  if (!Array.isArray(plan?.days) || !plan.days.length) throw new Error('This trip has no itinerary yet.');
  const outline = plan.outline || {};
  const country = outline.country || plan.practicalInfo?.country || plan.tripSummary?.country || plan.destination || '';
  const bases = (outline.stops || []).map(stop => stop.name).filter(Boolean);
  const numberOfDays = plan.days.length;
  const numberOfNights = outline.numberOfNights ?? Math.max(0, numberOfDays - 1);
  return {
    title: plan.tripTitle || trip.title || 'Your travel journal', country, bases,
    summary: plan.summary || '', numberOfDays, numberOfNights,
    days: plan.days.map((day, index) => journalDay(day, index, [], plan.placesStoredAs === 'ids_only')),
    dates: [journalDate(plan.days[0].date), journalDate(plan.days.at(-1).date)].filter(Boolean),
  };
}

export function dayNotes(day, plan) {
  const notes = [];
  if (day.type === 'arrival') notes.push('Morning and afternoon are reserved for arrival and settling in.');
  if (day.type === 'departure') notes.push('Keep the rest of the day free for departure.');
  if (day.type === 'transfer') notes.push('Morning and afternoon are reserved for travel between bases.');
  const transfer = day.transfer || plan.outline?.transfers?.find(item => item.day === day.day);
  if (transfer) {
    const stops = plan.outline?.stops || [];
    const from = stops.find(stop => stop.stopId === transfer.fromStopId)?.name;
    const to = stops.find(stop => stop.stopId === transfer.toStopId)?.name;
    notes.push([from && to ? `${from} → ${to}` : '', transfer.mode,
      transfer.planningMinutes != null ? `Allow about ${transfer.planningMinutes} minutes for travel and changing accommodation`
        : transfer.estimatedHours != null ? `About ${transfer.estimatedHours} hours (estimate)` : ''].filter(Boolean).join(' · '));
    if (transfer.note) notes.push(transfer.note);
  }
  const excursion = day.excursion || plan.outline?.excursions?.find(item => item.day === day.day);
  if (excursion) notes.push(`Day trip: ${excursion.name || day.city}. Return to your overnight base.`);
  return notes.filter(Boolean);
}
