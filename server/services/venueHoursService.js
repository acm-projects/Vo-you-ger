const { planningError } = require('./tripOutlineService');

function parseMinutes(value) {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(value.trim().replace(/[\u202f\u00a0]/g, " "));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return hour % 12 * 60 + minute + (match[3].toUpperCase() === "PM" ? 720 : 0);
}

// Only parse recognizable regular English hours. Unknown/holiday hours are not
// treated as verified. This checks slot overlap, not reservations or visit length.
function checkHours(place, dayOfWeek, slot) {
  if (place.daysOpen?.length && !place.daysOpen.some((day) => day.slice(0, 3).toLowerCase() === dayOfWeek.slice(0, 3).toLowerCase())) {
    throw planningError(`Venue ${place.placeId} is closed on ${dayOfWeek}`, 502);
  }
  const line = place.openingHours?.find((text) => text.toLowerCase().startsWith(`${dayOfWeek.toLowerCase()}:`));
  if (!line) return { hoursToday: null, hoursCheck: "unknown" };
  const hoursToday = line.slice(line.indexOf(":") + 1).trim();
  if (/\bclosed\b/i.test(hoursToday)) throw planningError(`Venue ${place.placeId} is closed on ${dayOfWeek}`, 502);
  if (/open 24 hours/i.test(hoursToday)) return { hoursToday, hoursCheck: "regular_hours_overlap" };
  const ranges = hoursToday.split(/,\s*/).map((range) => {
    const parts = range.split(/\s*[–—−-]\s*/);
    if (parts.length !== 2) return null;
    const start = parseMinutes(parts[0]);
    const end = parseMinutes(parts[1]);
    if (start == null || end == null) return null;
    return [start, end <= start ? end + 1440 : end];
  });
  if (ranges.some((range) => range == null)) return { hoursToday, hoursCheck: "unknown" };
  const [slotStart, slotEnd] = { morning: [540, 750], afternoon: [780, 1050], evening: [1080, 1320] }[slot];
  const overlaps = ranges.some(([start, end]) =>
    Math.max(start, slotStart) < Math.min(end, slotEnd) ||
    Math.max(start - 1440, slotStart) < Math.min(end - 1440, slotEnd));
  if (!overlaps) throw planningError(`Venue ${place.placeId} has no regular-hours overlap with ${slot}`, 502);
  return { hoursToday, hoursCheck: "regular_hours_overlap" };
}


module.exports = { checkHours };
