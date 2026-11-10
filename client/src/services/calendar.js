export function calendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function addCalendarDays(value, count) {
  const date = calendarDate(value);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

export function shiftCalendarMonth(value, count) {
  const date = calendarDate(value), day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + count);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.toISOString().slice(0, 10);
}

export function calendarDays(value) {
  const first = value.slice(0, 7) + '-01';
  const start = addCalendarDays(first, -calendarDate(first).getUTCDay());
  return Array.from({ length: 42 }, (_, index) => addCalendarDays(start, index));
}

export function formatCalendarDate(value, options) {
  const date = calendarDate(value);
  return date ? new Intl.DateTimeFormat('en', { timeZone: 'UTC', ...options }).format(date) : '';
}
