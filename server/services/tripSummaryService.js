const catalog = require("./planningDataService");
const destinations = require("../data/destinations.json");

function tripSummary(itinerary, { partial = false } = {}) {
  const outline = itinerary.outline;
  const countryCode = outline?.countryCode || itinerary.countryCode || itinerary.practicalInfo?.countryCode;
  const legacyDestination = typeof itinerary.destination === "string"
    ? destinations.find((item) => item.name.toLowerCase() === itinerary.destination.split(",")[0].trim().toLowerCase()) : null;
  const resolvedCode = countryCode || legacyDestination?.countryCode || null;
  const country = catalog.countries.find((item) => item.countryCode === resolvedCode);
  const resolvedCountry = country?.name || outline?.country || legacyDestination?.country || null;
  const proposedStart = itinerary.days?.[0]?.date || outline?.startDate;
  const startDate = typeof proposedStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(proposedStart) && !Number.isNaN(Date.parse(proposedStart)) ? proposedStart : null;
  const label = startDate
    ? new Date(`${startDate}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : null;
  return {
    countryId: country?.id || null, countryCode: resolvedCode, country: resolvedCountry,
    displayTitle: resolvedCountry ? `${resolvedCountry}${label ? ` — ${label}` : ""}` : itinerary.tripTitle || "Saved trip",
    startDate, endDate: !partial ? itinerary.days?.at(-1)?.date || null : null,
    numberOfDays: outline?.numberOfDays || (!partial ? itinerary.days?.length || null : null),
    numberOfNights: outline?.numberOfNights ?? (!partial && itinerary.days?.length ? itinerary.days.length - 1 : null),
    baseNames: outline?.stops?.map((stop) => stop.name) || [],
  };
}

function globeResponse(trips) {
  const grouped = new Map();
  const unmappedTrips = [];
  for (const trip of trips) {
    const summary = trip.itinerary?.tripSummary || tripSummary(trip.itinerary || {}, { partial: true });
    const item = {
      tripId: trip.tripId, ...summary,
      title: trip.itinerary?.tripTitle || trip.title, savedAt: trip.savedAt || null,
    };
    if (!summary.countryCode) { unmappedTrips.push(item); continue; }
    const country = catalog.countries.find((country) => country.countryCode === summary.countryCode);
    if (!grouped.has(summary.countryCode)) grouped.set(summary.countryCode, {
      countryCode: summary.countryCode, country: summary.country || country?.name || summary.countryCode,
      pin: country?.pin || require('../data/countryInfo.json').countries[summary.countryCode]?.displayPin || null, trips: [],
    });
    grouped.get(summary.countryCode).trips.push(item);
  }
  return {
    countries: [...grouped.values()].sort((a, b) => a.countryCode.localeCompare(b.countryCode)),
    unmappedTrips, tripCount: trips.length,
  };
}

module.exports = { tripSummary, globeResponse };
