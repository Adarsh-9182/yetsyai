// Date helpers. All calendar days are represented as local "YYYY-MM-DD" keys so
// completion state is stable regardless of time zone or DST.

/** @param {Date} d @returns {string} local ISO date key, e.g. "2026-07-26" */
export function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** @param {string} key "YYYY-MM-DD" @returns {Date} local midnight Date */
export function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** @param {string} key @param {number} n @returns {string} key shifted by n days */
export function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

/** Whole-day difference a - b (a and b are day keys). */
export function daysBetween(a, b) {
  const ms = keyToDate(a).getTime() - keyToDate(b).getTime();
  return Math.round(ms / 86_400_000);
}

/** Day of week 0=Sun..6=Sat for a day key. */
export function weekday(key) {
  return keyToDate(key).getDay();
}

/** Monday-based start-of-week key for the week containing `key`. */
export function startOfWeek(key) {
  const dow = weekday(key); // 0=Sun
  const backToMonday = (dow + 6) % 7;
  return addDays(key, -backToMonday);
}

/** The seven day keys of the week containing `key`, Monday first. */
export function weekDays(key) {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function formatLong(key) {
  const d = keyToDate(key);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export function formatShort(key) {
  const d = keyToDate(key);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
}

export { WEEKDAYS_SHORT };
