const { planningError } = require('./tripOutlineService');
const WEEKDAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const WEEK=7*1440;

function structuredRanges(periods) {
  if (!Array.isArray(periods) || !periods.length) return null;
  const point=value=>value && Number.isInteger(value.day) && value.day>=0 && value.day<=6 &&
    Number.isInteger(value.hour ?? 0) && (value.hour ?? 0)>=0 && (value.hour ?? 0)<=23 &&
    Number.isInteger(value.minute ?? 0) && (value.minute ?? 0)>=0 && (value.minute ?? 0)<=59
      ? value.day*1440+(value.hour ?? 0)*60+(value.minute ?? 0) : null;
  const ranges=periods.map(period=>{
    const start=point(period.open),end=point(period.close);
    if(start===0 && !period.close) return [0,WEEK]; // Documented always-open representation.
    if(start===null || end===null) return null;
    return [start,end<=start ? end+WEEK : end];
  });
  return ranges.some(range=>range===null)?null:ranges;
}

function parseMinutes(value) {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i.exec(value.trim().replace(/[\u202f\u00a0]/g, " "));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return hour % 12 * 60 + minute + (match[3].toUpperCase() === "PM" ? 720 : 0);
}

function textRange(value) {
  const parts=value.trim().split(/\s*[–—−-]\s*/);
  if(parts.length!==2)return null;
  // Google elides a shared AM/PM marker: "1:30 – 11:30 PM".
  const shared=/\b(AM|PM)\s*$/i.exec(parts[1]);
  const abbreviated=!/\b(AM|PM)\s*$/i.test(parts[0])&&shared;
  const start=parseMinutes(abbreviated?`${parts[0]} ${shared[1]}`:parts[0]),end=parseMinutes(parts[1]);
  if(start===null||end===null)return null;
  // A descending abbreviated range is ambiguous; don't guess its missing marker.
  if(abbreviated&&end<=start)return null;
  return [start,end<=start?end+1440:end];
}

// Only parse recognizable regular English hours. Unknown/holiday hours are not
// treated as verified. This checks slot overlap, not reservations or visit length.
function checkHours(place, dayOfWeek, slot) {
  if (place.daysOpen?.length && !place.daysOpen.some((day) => day.slice(0, 3).toLowerCase() === dayOfWeek.slice(0, 3).toLowerCase())) {
    throw planningError(`Venue ${place.placeId} is closed on ${dayOfWeek}`, 502);
  }
  const line = place.openingHours?.find((text) => text.toLowerCase().startsWith(`${dayOfWeek.toLowerCase()}:`));
  const hoursToday = line ? line.slice(line.indexOf(":") + 1).trim() : null;
  const [slotStart, slotEnd] = { morning: [540, 750], afternoon: [780, 1050], evening: [1080, 1320] }[slot];
  const periods=structuredRanges(place.openingPeriods),weekday=WEEKDAYS.indexOf(dayOfWeek);
  if(periods && weekday>=0) {
    const start=weekday*1440+slotStart,end=weekday*1440+slotEnd;
    const overlaps=periods.some(([open,close])=>[-WEEK,0,WEEK].some(offset=>Math.max(open+offset,start)<Math.min(close+offset,end)));
    if(!overlaps)throw planningError(`Venue ${place.placeId} has no regular-hours overlap with ${slot}`,502);
    return {hoursToday,hoursCheck:'regular_hours_overlap'};
  }
  if (!hoursToday) return { hoursToday: null, hoursCheck: "unknown" };
  if (/\bclosed\b/i.test(hoursToday)) throw planningError(`Venue ${place.placeId} is closed on ${dayOfWeek}`, 502);
  if (/open 24 hours/i.test(hoursToday)) return { hoursToday, hoursCheck: "regular_hours_overlap" };
  const ranges = hoursToday.split(/,\s*/).map(textRange);
  if (ranges.some((range) => range == null)) return { hoursToday, hoursCheck: "unknown" };
  const overlaps = ranges.some(([start, end]) =>
    Math.max(start, slotStart) < Math.min(end, slotEnd) ||
    Math.max(start - 1440, slotStart) < Math.min(end - 1440, slotEnd));
  if (!overlaps) throw planningError(`Venue ${place.placeId} has no regular-hours overlap with ${slot}`, 502);
  return { hoursToday, hoursCheck: "regular_hours_overlap" };
}


module.exports = { checkHours };
