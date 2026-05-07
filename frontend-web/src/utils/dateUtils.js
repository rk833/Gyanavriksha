/**
 * All timestamps from the API are UTC but may be returned as naive ISO strings
 * (no 'Z' or offset suffix).  JavaScript's Date constructor treats naive
 * date-time strings as LOCAL time, which is wrong.  These helpers normalise
 * every string to UTC before constructing a Date, so toLocale* methods then
 * produce correct local-time output on the user's device.
 */

function parseApiDate(str) {
  if (!str) return null;
  const s = String(str);
  const hasOffset = s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s);
  const d = new Date(hasOffset ? s : s + 'Z');
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDate(str, opts = { dateStyle: 'medium' }) {
  const d = parseApiDate(str);
  return d ? d.toLocaleDateString(undefined, opts) : '—';
}

export function fmtDateTime(str, opts = { dateStyle: 'medium', timeStyle: 'short' }) {
  const d = parseApiDate(str);
  return d ? d.toLocaleString(undefined, opts) : '—';
}

export function fmtTime(str, opts = { hour: '2-digit', minute: '2-digit' }) {
  const d = parseApiDate(str);
  return d ? d.toLocaleTimeString(undefined, opts) : '—';
}

export function fmtDateShort(str) {
  return fmtDate(str, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function fmtDateTimeShort(str) {
  return fmtDateTime(str, { dateStyle: 'short', timeStyle: 'short' });
}

export { parseApiDate };
