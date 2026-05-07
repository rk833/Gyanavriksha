/**
 * All timestamps from the API are UTC but may be returned as naive ISO strings
 * (no 'Z' or offset suffix).  JavaScript's Date constructor treats naive
 * date-time strings as LOCAL time, which is wrong.  These helpers normalise
 * every string to UTC before constructing a Date, so toLocale* methods then
 * produce correct local-time output on the user's device.
 */

export function parseApiDate(str: string | null | undefined): Date | null {
  if (!str) return null;
  const hasOffset = str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str);
  const d = new Date(hasOffset ? str : str + 'Z');
  return isNaN(d.getTime()) ? null : d;
}

export function fmtDate(str: string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
  const d = parseApiDate(str);
  return d ? d.toLocaleDateString(undefined, opts) : '—';
}

export function fmtDateTime(str: string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' }): string {
  const d = parseApiDate(str);
  return d ? d.toLocaleString(undefined, opts) : '—';
}

export function fmtTime(str: string | null | undefined, opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }): string {
  const d = parseApiDate(str);
  return d ? d.toLocaleTimeString(undefined, opts) : '—';
}

export function fmtDateShort(str: string | null | undefined): string {
  return fmtDate(str, { month: 'short', day: 'numeric' });
}
