// Node-runnable checks for the pure logic. Run: node js/logic.test.mjs
import assert from "node:assert/strict";
import { dayKey, addDays, weekDays, startOfWeek, daysBetween } from "./dates.js";
import {
  isScheduled, isDone, currentStreak, bestStreak, completion, heatmap, weeklyReport,
} from "./habits.js";

let pass = 0;
const t = (name, fn) => { fn(); pass++; console.log("✓", name); };

const today = dayKey();
const daily = (createdAt) => ({ id: "h", name: "H", emoji: "🔥", color: "ember", createdAt, schedule: "daily", archived: false });
const recFrom = (keys) => ({ h: Object.fromEntries(keys.map((k) => [k, true])) });

t("addDays / daysBetween round-trip", () => {
  assert.equal(daysBetween(addDays(today, 5), today), 5);
  assert.equal(daysBetween(addDays(today, -3), today), -3);
});

t("weekDays returns Monday-first 7 days containing the anchor", () => {
  const wk = weekDays("2026-07-26"); // Sunday
  assert.equal(wk.length, 7);
  assert.equal(wk[0], "2026-07-20"); // Monday
  assert.equal(wk[6], "2026-07-26"); // Sunday
  assert.equal(startOfWeek("2026-07-26"), "2026-07-20");
});

t("isScheduled respects createdAt and weekday sets", () => {
  const h = { ...daily("2026-01-01"), schedule: [1, 3, 5] }; // Mon/Wed/Fri
  assert.equal(isScheduled(h, "2026-07-20"), true);  // Monday
  assert.equal(isScheduled(h, "2026-07-21"), false); // Tuesday
  assert.equal(isScheduled({ ...h }, "2025-12-31"), false); // before creation
});

t("currentStreak counts consecutive completed days, today pending is graceful", () => {
  const h = daily(addDays(today, -30));
  const keys = [addDays(today, -3), addDays(today, -2), addDays(today, -1)];
  // Today not done yet, but 3 prior days done → streak 3 (grace for today).
  assert.equal(currentStreak(h, recFrom(keys), today), 3);
  // Completing today extends to 4.
  assert.equal(currentStreak(h, recFrom([...keys, today]), today), 4);
});

t("currentStreak breaks on a missed scheduled day", () => {
  const h = daily(addDays(today, -30));
  const keys = [addDays(today, -1), addDays(today, -3)]; // gap at -2
  assert.equal(currentStreak(h, recFrom(keys), today), 1);
});

t("currentStreak skips non-scheduled days without breaking", () => {
  // Weekdays only (Mon-Fri). A weekend gap must not break the streak.
  const h = { ...daily("2026-01-01"), schedule: [1, 2, 3, 4, 5] };
  const ref = "2026-07-27"; // Monday
  const done = ["2026-07-23", "2026-07-24", "2026-07-27"]; // Thu, Fri, Mon (skip weekend)
  assert.equal(currentStreak(h, recFrom(done), ref), 3);
});

t("bestStreak finds the longest historical run", () => {
  const h = daily(addDays(today, -30));
  const done = [
    addDays(today, -10), addDays(today, -9), addDays(today, -8), // run of 3
    addDays(today, -5), addDays(today, -4), addDays(today, -3), addDays(today, -2), // run of 4
  ];
  assert.equal(bestStreak(h, recFrom(done), today), 4);
});

t("completion rate is scheduled-aware", () => {
  const h = daily(addDays(today, -6));
  const done = [addDays(today, -6), addDays(today, -5), addDays(today, -4)]; // 3 of 7
  const c = completion(h, recFrom(done), 7, today);
  assert.equal(c.scheduled, 7);
  assert.equal(c.completed, 3);
  assert.ok(Math.abs(c.rate - 3 / 7) < 1e-9);
});

t("heatmap marks done/miss/today and length", () => {
  const h = daily(addDays(today, -10));
  const cells = heatmap(h, recFrom([addDays(today, -1)]), 5, today);
  assert.equal(cells.length, 5);
  assert.equal(cells.at(-1).status, "today");
  assert.equal(cells.find((c) => c.key === addDays(today, -1)).status, "done");
});

t("weeklyReport aggregates and ranks habits", () => {
  const days = weekDays(today);
  const a = { id: "a", name: "A", emoji: "🏃", color: "sky", createdAt: days[0], schedule: "daily", archived: false };
  const b = { id: "b", name: "B", emoji: "📚", color: "gold", createdAt: days[0], schedule: "daily", archived: false };
  const records = {
    a: Object.fromEntries(days.slice(0, 6).map((k) => [k, true])), // strong
    b: Object.fromEntries(days.slice(0, 1).map((k) => [k, true])), // weak
  };
  const r = weeklyReport([a, b], records, days);
  assert.equal(r.strongest.id, "a");
  assert.equal(r.weakest.id, "b");
  assert.ok(r.headline.includes("%"));
});

t("isDone reads nested records safely", () => {
  assert.equal(isDone({}, "x", today), false);
  assert.equal(isDone({ x: { [today]: true } }, "x", today), true);
});

console.log(`\n${pass} checks passed.`);
