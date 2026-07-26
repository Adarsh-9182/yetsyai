// Pure habit logic: scheduling, streaks, completion stats. No DOM, no storage —
// so it is trivially testable and reusable.

import { addDays, dayKey, daysBetween, weekday } from "./dates.js";

/**
 * @typedef {Object} Habit
 * @property {string} id
 * @property {string} name
 * @property {string} emoji
 * @property {string} color                 CSS color token key (see palette)
 * @property {string} createdAt             day key the habit began
 * @property {"daily"|number[]} schedule    "daily" or array of weekdays 0..6
 * @property {boolean} archived
 */

/** Is the habit meant to be done on this day key? */
export function isScheduled(habit, key) {
  if (key < habit.createdAt) return false;
  if (habit.schedule === "daily") return true;
  return habit.schedule.includes(weekday(key));
}

/** Was the habit completed on this day key? `records` is { [key]: true }. */
export function isDone(records, habitId, key) {
  const r = records[habitId];
  return Boolean(r && r[key]);
}

/**
 * Current streak: consecutive scheduled days completed, counting back from
 * today. Today is allowed to be still pending without breaking the streak.
 */
export function currentStreak(habit, records, today = dayKey()) {
  const done = records[habit.id] || {};
  let cursor = today;

  // Grace: if today is scheduled but not yet done, start counting from
  // yesterday so an in-progress day doesn't read as a broken streak.
  if (isScheduled(habit, cursor) && !done[cursor]) {
    cursor = addDays(cursor, -1);
  }

  let streak = 0;
  while (cursor >= habit.createdAt) {
    if (isScheduled(habit, cursor)) {
      if (done[cursor]) streak += 1;
      else break;
    }
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Longest run of consecutive scheduled days ever completed. */
export function bestStreak(habit, records, today = dayKey()) {
  const done = records[habit.id] || {};
  let best = 0;
  let run = 0;
  for (let cursor = habit.createdAt; cursor <= today; cursor = addDays(cursor, 1)) {
    if (!isScheduled(habit, cursor)) continue;
    if (done[cursor]) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }
  return best;
}

/**
 * Completion stats over the trailing `windowDays` days (inclusive of today).
 * Only scheduled days count toward the denominator.
 */
export function completion(habit, records, windowDays = 30, today = dayKey()) {
  const done = records[habit.id] || {};
  const start = addDays(today, -(windowDays - 1));
  let scheduled = 0;
  let completed = 0;
  for (let cursor = start; cursor <= today; cursor = addDays(cursor, 1)) {
    if (cursor < habit.createdAt || !isScheduled(habit, cursor)) continue;
    scheduled += 1;
    if (done[cursor]) completed += 1;
  }
  return { scheduled, completed, rate: scheduled ? completed / scheduled : 0 };
}

/** Total completions ever recorded for a habit. */
export function totalCompletions(habit, records) {
  return Object.keys(records[habit.id] || {}).length;
}

/**
 * Contribution grid data: the trailing `days` day keys with per-day status,
 * used to render a GitHub-style heatmap.
 */
export function heatmap(habit, records, days = 119, today = dayKey()) {
  const done = records[habit.id] || {};
  const start = addDays(today, -(days - 1));
  const cells = [];
  for (let cursor = start; cursor <= today; cursor = addDays(cursor, 1)) {
    let status = "off"; // not scheduled / before creation
    if (cursor >= habit.createdAt && isScheduled(habit, cursor)) {
      status = done[cursor] ? "done" : cursor === today ? "today" : "miss";
    } else if (cursor === today) {
      status = "off-today";
    }
    cells.push({ key: cursor, status });
  }
  return cells;
}

/** How many of the day's scheduled habits are complete. */
export function dayProgress(habits, records, key) {
  const active = habits.filter((h) => !h.archived && isScheduled(h, key));
  const done = active.filter((h) => isDone(records, h.id, key));
  return { total: active.length, done: done.length };
}

const ADJECTIVES = ["Kept", "Held", "Nailed", "Owned", "Stacked"];

/** A human summary line for the completed week. `days` = 7 week keys. */
export function weeklyReport(habits, records, days) {
  const active = habits.filter((h) => !h.archived);
  let scheduled = 0;
  let completed = 0;
  const perHabit = [];

  for (const habit of active) {
    let s = 0;
    let c = 0;
    for (const key of days) {
      if (!isScheduled(habit, key)) continue;
      s += 1;
      if (isDone(records, habit.id, key)) c += 1;
    }
    if (s > 0) {
      scheduled += s;
      completed += c;
      perHabit.push({ habit, scheduled: s, completed: c, rate: c / s });
    }
  }

  perHabit.sort((a, b) => b.rate - a.rate || b.completed - a.completed);
  const rate = scheduled ? completed / scheduled : 0;
  const verb = ADJECTIVES[Math.min(ADJECTIVES.length - 1, Math.floor(rate * ADJECTIVES.length))];

  return {
    scheduled,
    completed,
    rate,
    perHabit,
    headline:
      scheduled === 0
        ? "No habits were scheduled this week."
        : `${verb} ${completed} of ${scheduled} check-ins — ${Math.round(rate * 100)}%.`,
    strongest: perHabit[0]?.habit ?? null,
    weakest: perHabit.length > 1 ? perHabit[perHabit.length - 1].habit : null,
  };
}
