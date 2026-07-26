// Single source of truth. Owns state, persists to localStorage, and notifies
// subscribers on change. All mutations go through these methods so persistence
// and re-render stay in lockstep.

import { dayKey } from "./dates.js";

const STORAGE_KEY = "yetsy.habit-tracker.v1";
const SCHEMA_VERSION = 1;

export const COLORS = ["ember", "gold", "mint", "sky", "violet", "rose"];
export const EMOJIS = [
  "🔥", "💧", "🏃", "📚", "🧘", "💪", "🥗", "😴", "🎯", "✍️",
  "🎸", "🧠", "🌱", "☀️", "💻", "🚭", "🙏", "🎨", "⏰", "💊",
];

/** @returns {string} */
function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    habits: /** @type {import('./habits.js').Habit[]} */ ([]),
    records: /** @type {Record<string, Record<string, true>>} */ ({}),
    settings: { theme: "system" },
  };
}

function isValidState(s) {
  return (
    s &&
    typeof s === "object" &&
    Array.isArray(s.habits) &&
    s.records &&
    typeof s.records === "object"
  );
}

export class Store extends EventTarget {
  constructor() {
    super();
    this.state = this.#load();
  }

  #load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!isValidState(parsed)) return defaultState();
      return { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...parsed.settings } };
    } catch {
      return defaultState();
    }
  }

  #persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (err) {
      // Quota or private-mode failures shouldn't crash the app.
      this.dispatchEvent(new CustomEvent("error", { detail: err }));
    }
    this.dispatchEvent(new CustomEvent("change"));
  }

  get habits() {
    return this.state.habits;
  }

  get records() {
    return this.state.records;
  }

  get settings() {
    return this.state.settings;
  }

  activeHabits() {
    return this.state.habits.filter((h) => !h.archived);
  }

  archivedHabits() {
    return this.state.habits.filter((h) => h.archived);
  }

  getHabit(id) {
    return this.state.habits.find((h) => h.id === id) ?? null;
  }

  addHabit({ name, emoji, color, schedule }) {
    const habit = {
      id: uid(),
      name: name.trim(),
      emoji: emoji || EMOJIS[0],
      color: COLORS.includes(color) ? color : COLORS[0],
      createdAt: dayKey(),
      schedule: schedule === "daily" || Array.isArray(schedule) ? schedule : "daily",
      archived: false,
    };
    this.state.habits.push(habit);
    this.#persist();
    return habit;
  }

  updateHabit(id, patch) {
    const habit = this.getHabit(id);
    if (!habit) return;
    if (typeof patch.name === "string") habit.name = patch.name.trim();
    if (patch.emoji) habit.emoji = patch.emoji;
    if (patch.color && COLORS.includes(patch.color)) habit.color = patch.color;
    if (patch.schedule === "daily" || Array.isArray(patch.schedule)) {
      habit.schedule = patch.schedule;
    }
    this.#persist();
  }

  setArchived(id, archived) {
    const habit = this.getHabit(id);
    if (!habit) return;
    habit.archived = archived;
    this.#persist();
  }

  deleteHabit(id) {
    this.state.habits = this.state.habits.filter((h) => h.id !== id);
    delete this.state.records[id];
    this.#persist();
  }

  /** Toggle completion for a habit on a given day key. Returns new value. */
  toggle(id, key = dayKey()) {
    const rec = (this.state.records[id] ??= {});
    let value;
    if (rec[key]) {
      delete rec[key];
      value = false;
    } else {
      rec[key] = true;
      value = true;
    }
    this.#persist();
    return value;
  }

  setTheme(theme) {
    this.state.settings.theme = theme;
    this.#persist();
  }

  /** Serialise everything for backup/export. */
  export() {
    return JSON.stringify(this.state, null, 2);
  }

  /** Replace all state from a previously exported JSON string. */
  import(json) {
    const parsed = JSON.parse(json);
    if (!isValidState(parsed)) throw new Error("Not a valid Habit Tracker backup.");
    this.state = { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...parsed.settings } };
    this.#persist();
  }

  reset() {
    this.state = defaultState();
    this.#persist();
  }
}
