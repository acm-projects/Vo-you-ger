import { useEffect, useId, useRef, useState } from 'react';
import { addCalendarDays, calendarDate, calendarDays, formatCalendarDate, shiftCalendarMonth } from '../services/calendar';
import './arrival-date-picker.css';

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ArrivalDatePicker({ id, value, min, onChange }) {
  const uid = useId();
  const initial = calendarDate(value) && value >= min ? value : min;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(initial.slice(0, 7));
  const [focused, setFocused] = useState(initial);
  const [error, setError] = useState('');
  const wrapper = useRef(null);
  const trigger = useRef(null);
  const buttons = useRef(new Map());
  const focusPending = useRef(false);
  const days = calendarDays(month + '-01');
  const title = formatCalendarDate(month + '-01', { month: 'long', year: 'numeric' });

  useEffect(() => {
    if (open && focusPending.current) {
      buttons.current.get(focused)?.focus();
      focusPending.current = false;
    }
  }, [open, focused, month]);

  useEffect(() => {
    if (!open) return;
    function outside(event) { if (!wrapper.current?.contains(event.target)) setOpen(false); }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  function show() {
    const date = calendarDate(value) && value >= min ? value : min;
    setMonth(date.slice(0, 7)); setFocused(date);
    focusPending.current = true;
    setOpen(true);
  }

  function close() { setOpen(false); trigger.current?.focus(); }

  function choose(date) {
    onChange(date); setError(''); close();
  }

  function changeMonth(delta) {
    const next = shiftCalendarMonth(month + '-01', delta);
    const date = next < min ? min : next;
    setMonth(date.slice(0, 7)); setFocused(date);
  }

  function move(event, date) {
    let next;
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (event.key in offsets) next = addCalendarDays(date, offsets[event.key]);
    else if (event.key === 'Home') next = addCalendarDays(date, -calendarDate(date).getUTCDay());
    else if (event.key === 'End') next = addCalendarDays(date, 6 - calendarDate(date).getUTCDay());
    else if (event.key === 'PageUp') next = shiftCalendarMonth(date, event.shiftKey ? -12 : -1);
    else if (event.key === 'PageDown') next = shiftCalendarMonth(date, event.shiftKey ? 12 : 1);
    else return;
    event.preventDefault();
    next = next < min ? min : next;
    focusPending.current = true;
    setMonth(next.slice(0, 7)); setFocused(next);
  }

  return <div className="arrival-date-picker" ref={wrapper} onKeyDown={event => {
    if (open && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
  }}>
    <label id={`${uid}-label`} htmlFor={`${id}-trigger`}>Arrival date</label>
    <input className="arrival-date-picker__input" id={id} name="startDate" type="date" min={min} required
      tabIndex={-1} aria-hidden="true" value={value}
      onChange={event => { onChange(event.target.value); setError(''); }}
      onInvalid={event => { event.preventDefault(); setError('Choose an arrival date on or after today.'); show(); }} />
    <button className="arrival-date-picker__trigger" id={`${id}-trigger`} ref={trigger} type="button"
      aria-labelledby={`${uid}-label ${uid}-value`} aria-haspopup="dialog" aria-expanded={open}
      aria-controls={`${uid}-calendar`} aria-describedby={error ? `${uid}-error` : undefined}
      onClick={() => open ? close() : show()}>
      <span id={`${uid}-value`} className={!value ? 'arrival-date-picker__empty' : undefined}>
        {formatCalendarDate(value, { month: 'short', day: 'numeric', year: 'numeric' }) || 'Choose a date'}
      </span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 11h18M7 15h2M12 15h2M7 18h2" />
      </svg>
    </button>
    {error && <span id={`${uid}-error`} className="arrival-date-picker__error" role="alert">{error}</span>}
    {open && <div className="arrival-date-picker__calendar" id={`${uid}-calendar`} role="dialog" aria-label="Choose your arrival date">
      <div className="arrival-date-picker__heading">
        <button type="button" aria-label="Previous month" disabled={month <= min.slice(0, 7)} onClick={() => changeMonth(-1)}>‹</button>
        <h2 id={`${uid}-month`} aria-live="polite">{title}</h2>
        <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}>›</button>
      </div>
      <div className="arrival-date-picker__grid" role="grid" aria-labelledby={`${uid}-month`}>
        <div className="arrival-date-picker__week" role="row">
          {weekdays.map(day => <span role="columnheader" aria-label={day} key={day}>{day.slice(0, 2)}</span>)}
        </div>
        {Array.from({ length: 6 }, (_, week) => <div className="arrival-date-picker__week" role="row" key={week}>
          {days.slice(week * 7, week * 7 + 7).map(date => <div role="gridcell" aria-selected={date === value} key={date}>
            <button type="button" disabled={date < min} tabIndex={date === focused ? 0 : -1}
              ref={node => { if (node) buttons.current.set(date, node); else buttons.current.delete(date); }}
              data-date={date} data-outside={date.slice(0, 7) !== month} data-selected={date === value}
              aria-current={date === min ? 'date' : undefined}
              aria-label={formatCalendarDate(date, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              onKeyDown={event => move(event, date)} onClick={() => choose(date)}>
              {Number(date.slice(-2))}
            </button>
          </div>)}
        </div>)}
      </div>
      <div className="arrival-date-picker__footer">
        <button type="button" onClick={() => choose(min)}>Today</button>
        <button type="button" onClick={close}>Close</button>
      </div>
    </div>}
  </div>;
}
