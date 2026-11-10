import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarDays, calendarDate, calendarDays, formatCalendarDate, shiftCalendarMonth } from '../src/services/calendar.js';

test('calendar dates validate actual dates and retain their day regardless of local timezone', () => {
  assert.ok(calendarDate('2028-02-29'));
  for(const value of ['2027-02-29','2027-04-31','2027-13-01','06/05/2027',null]) assert.equal(calendarDate(value),null);
  assert.match(formatCalendarDate('2027-06-05',{weekday:'long',month:'long',day:'numeric',year:'numeric'}),/Saturday, June 5, 2027/);
  assert.equal(addCalendarDays('2027-03-13',1),'2027-03-14');
  assert.equal(addCalendarDays('2027-12-31',1),'2028-01-01');
});

test('month navigation clamps the day at short months and leap years', () => {
  assert.equal(shiftCalendarMonth('2027-01-31',1),'2027-02-28');
  assert.equal(shiftCalendarMonth('2028-01-31',1),'2028-02-29');
  assert.equal(shiftCalendarMonth('2028-02-29',12),'2029-02-28');
  assert.equal(shiftCalendarMonth('2027-01-01',-1),'2026-12-01');
});

test('the calendar renders six complete weeks with correct weekday alignment across year boundaries', () => {
  const november=calendarDays('2026-11-01');
  assert.equal(november.length,42);
  assert.equal(november[0],'2026-11-01');
  assert.equal(november.at(-1),'2026-12-12');
  const january=calendarDays('2027-01-01');
  assert.equal(january[0],'2026-12-27');
  assert.equal(january[5],'2027-01-01');
  assert.equal(january.at(-1),'2027-02-06');
});
