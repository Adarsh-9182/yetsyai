// Application shell: owns view state, renders from the store, and re-renders on
// every store change. Rendering is full-redraw-per-change — cheap at this scale
// and it keeps the UI a pure function of state.

import { Store } from "./store.js";
import { el, clear } from "./dom.js";
import { HabitEditor } from "./editor.js";
import {
  dayKey,
  addDays,
  formatLong,
  formatShort,
  weekDays,
  startOfWeek,
  daysBetween,
  WEEKDAYS_SHORT,
} from "./dates.js";
import {
  isScheduled,
  isDone,
  currentStreak,
  bestStreak,
  completion,
  totalCompletions,
  heatmap,
  dayProgress,
  weeklyReport,
} from "./habits.js";

const store = new Store();
const root = document.getElementById("app");
const liveRegion = document.getElementById("live");

const view = {
  tab: "today", // "today" | "insights"
  selectedDay: dayKey(),
  weekOffset: 0, // 0 = current week, -1 = last week …
};

const editor = new HabitEditor((data, id) => {
  if (id) store.updateHabit(id, data);
  else {
    store.addHabit(data);
    announce(`Habit "${data.name}" created.`);
  }
});

/* ── theme ─────────────────────────────────────────────────────────── */

function applyTheme() {
  const t = store.settings.theme;
  const dark = t === "system"
    ? matchMedia("(prefers-color-scheme: dark)").matches
    : t === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

function announce(msg) {
  liveRegion.textContent = "";
  requestAnimationFrame(() => (liveRegion.textContent = msg));
}

/* ── small shared pieces ───────────────────────────────────────────── */

function ring(fraction, label) {
  const size = 44;
  const r = 18;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  return el("div", { class: "ring", role: "img", "aria-label": label }, [
    el("svg", { viewBox: `0 0 ${size} ${size}`, width: size, height: size, "aria-hidden": "true" }, [
      svg("circle", { cx: size / 2, cy: size / 2, r, class: "ring-track" }),
      svg("circle", {
        cx: size / 2,
        cy: size / 2,
        r,
        class: "ring-fill",
        "stroke-dasharray": c,
        "stroke-dashoffset": c * (1 - clamped),
        transform: `rotate(-90 ${size / 2} ${size / 2})`,
      }),
    ]),
    el("span", { class: "ring-label", text: `${Math.round(clamped * 100)}%` }),
  ]);
}

function svg(tag, props) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(props)) node.setAttribute(k, v);
  return node;
}

function popupMenu(anchor, items) {
  document.querySelector(".menu")?.remove();
  const menu = el(
    "div",
    { class: "menu", role: "menu" },
    items.map((it) =>
      el("button", {
        class: "menu-item" + (it.danger ? " danger" : ""),
        role: "menuitem",
        text: it.label,
        onclick: () => {
          menu.remove();
          it.action();
        },
      }),
    ),
  );
  document.body.append(menu);
  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + window.scrollY + 6}px`;
  menu.style.left = `${Math.min(rect.left + window.scrollX, window.innerWidth - menu.offsetWidth - 12)}px`;
  const close = (e) => {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener("click", close, true);
    }
  };
  setTimeout(() => document.addEventListener("click", close, true), 0);
}

function confirmDialog({ title, body, confirmLabel = "Confirm", danger = false }) {
  return new Promise((resolve) => {
    const dlg = el("dialog", { class: "confirm" });
    let ok = false;
    dlg.append(
      el("div", { class: "confirm-body" }, [
        el("h2", { text: title }),
        el("p", { text: body }),
        el("div", { class: "editor-actions" }, [
          el("button", {
            class: "btn btn-ghost",
            text: "Cancel",
            onclick: () => dlg.close(),
          }),
          el("button", {
            class: "btn " + (danger ? "btn-danger" : "btn-primary"),
            text: confirmLabel,
            onclick: () => {
              ok = true;
              dlg.close();
            },
          }),
        ]),
      ]),
    );
    dlg.addEventListener("close", () => {
      dlg.remove();
      resolve(ok);
    });
    document.body.append(dlg);
    dlg.showModal();
  });
}

/* ── header ────────────────────────────────────────────────────────── */

function renderHeader() {
  const active = store.activeHabits();
  const prog = dayProgress(active, store.records, dayKey());
  const frac = prog.total ? prog.done / prog.total : 0;

  const themeIcon = { system: "🖥️", light: "☀️", dark: "🌙" }[store.settings.theme];

  return el("header", { class: "app-head" }, [
    el("div", { class: "brand" }, [
      el("span", { class: "brand-mark" }),
      el("div", {}, [
        el("strong", { text: "Habit Tracker" }),
        el("span", { class: "brand-sub", text: "by YetsyAI" }),
      ]),
    ]),
    el("div", { class: "head-actions" }, [
      ring(frac, `Today ${prog.done} of ${prog.total} done`),
      el("button", {
        class: "icon-btn",
        title: `Theme: ${store.settings.theme}`,
        "aria-label": `Theme: ${store.settings.theme}. Click to change.`,
        text: themeIcon,
        onclick: () => {
          const order = ["system", "light", "dark"];
          const next = order[(order.indexOf(store.settings.theme) + 1) % order.length];
          store.setTheme(next);
        },
      }),
      el("button", {
        class: "icon-btn",
        "aria-label": "More options",
        html: "&#8942;",
        onclick: (e) => openMainMenu(e.currentTarget),
      }),
      el("button", {
        class: "btn btn-primary btn-new",
        onclick: () => editor.open(),
      }, [el("span", { "aria-hidden": "true", text: "＋" }), el("span", { class: "btn-new-label", text: "New" })]),
    ]),
  ]);
}

function openMainMenu(anchor) {
  popupMenu(anchor, [
    { label: "Export backup", action: exportBackup },
    { label: "Import backup", action: importBackup },
    { label: "Reset all data", danger: true, action: resetAll },
  ]);
}

/* ── tabs ──────────────────────────────────────────────────────────── */

function renderTabs() {
  const mk = (id, label) =>
    el("button", {
      class: "tab" + (view.tab === id ? " active" : ""),
      role: "tab",
      "aria-selected": String(view.tab === id),
      text: label,
      onclick: () => {
        view.tab = id;
        render();
      },
    });
  return el("nav", { class: "tabs", role: "tablist", "aria-label": "Views" }, [
    mk("today", "Today"),
    mk("insights", "Insights"),
  ]);
}

/* ── today view ────────────────────────────────────────────────────── */

function renderDateRail() {
  const today = dayKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const active = store.activeHabits();

  return el(
    "div",
    { class: "rail", role: "group", "aria-label": "Choose a day" },
    days.map((key) => {
      const prog = dayProgress(active, store.records, key);
      const frac = prog.total ? prog.done / prog.total : 0;
      const d = new Date(key.replaceAll("-", "/"));
      const selected = key === view.selectedDay;
      return el("button", {
        class: "rail-day" + (selected ? " selected" : "") + (key === today ? " is-today" : ""),
        "aria-pressed": String(selected),
        "aria-label": `${formatLong(key)}, ${prog.done} of ${prog.total} done`,
        onclick: () => {
          view.selectedDay = key;
          render();
        },
      }, [
        el("span", { class: "rail-dow", text: WEEKDAYS_SHORT[d.getDay()][0] }),
        el("span", { class: "rail-num", text: String(d.getDate()) }),
        el("span", {
          class: "rail-dot" + (prog.total && frac === 1 ? " full" : prog.done ? " partial" : ""),
        }),
      ]);
    }),
  );
}

function renderHabitCard(habit) {
  const key = view.selectedDay;
  const scheduled = isScheduled(habit, key);
  const done = isDone(store.records, habit.id, key);
  const streak = currentStreak(habit, store.records);

  const check = el("button", {
    class: "check" + (done ? " done" : "") + (scheduled ? "" : " off"),
    role: "checkbox",
    "aria-checked": String(done),
    "aria-label": `${done ? "Mark incomplete" : "Mark complete"}: ${habit.name}`,
    disabled: !scheduled,
    onclick: () => {
      const v = store.toggle(habit.id, key);
      if (v) announce(`${habit.name} completed.`);
    },
  }, [el("span", { class: "check-tick", html: "&#10003;", "aria-hidden": "true" })]);

  return el("li", { class: `habit-card color-${habit.color}` + (done ? " is-done" : "") + (scheduled ? "" : " is-rest") }, [
    el("span", { class: "habit-emoji", "aria-hidden": "true", text: habit.emoji }),
    el("div", { class: "habit-main" }, [
      el("span", { class: "habit-name", text: habit.name }),
      el("span", { class: "habit-meta" }, [
        scheduled
          ? el("span", { class: "streak" + (streak > 0 ? " hot" : "") }, [
              el("span", { "aria-hidden": "true", text: "🔥" }),
              el("span", { text: `${streak} day${streak === 1 ? "" : "s"}` }),
            ])
          : el("span", { class: "rest-tag", text: "Rest day" }),
      ]),
    ]),
    el("button", {
      class: "icon-btn kebab",
      "aria-label": `Options for ${habit.name}`,
      html: "&#8942;",
      onclick: (e) => openHabitMenu(e.currentTarget, habit),
    }),
    check,
  ]);
}

function openHabitMenu(anchor, habit) {
  popupMenu(anchor, [
    { label: "Edit", action: () => editor.open(habit) },
    { label: "Archive", action: () => store.setArchived(habit.id, true) },
    {
      label: "Delete",
      danger: true,
      action: async () => {
        const ok = await confirmDialog({
          title: `Delete "${habit.name}"?`,
          body: "This removes the habit and its entire history. This can't be undone.",
          confirmLabel: "Delete",
          danger: true,
        });
        if (ok) store.deleteHabit(habit.id);
      },
    },
  ]);
}

function renderTodayView() {
  const active = store.activeHabits();
  const key = view.selectedDay;

  const heading = el("div", { class: "day-head" }, [
    el("h2", { text: key === dayKey() ? "Today" : formatLong(key) }),
    el("p", { class: "day-sub", text: key === dayKey() ? formatLong(key) : formatShort(key) }),
  ]);

  if (active.length === 0) return el("section", {}, [heading, emptyState()]);

  const scheduledToday = active.filter((h) => isScheduled(h, key));
  const restToday = active.filter((h) => !isScheduled(h, key));

  const list = el("ul", { class: "habit-list" }, [
    ...scheduledToday.map(renderHabitCard),
    ...restToday.map(renderHabitCard),
  ]);

  return el("section", {}, [renderDateRail(), heading, list]);
}

function emptyState() {
  return el("div", { class: "empty" }, [
    el("div", { class: "empty-art", "aria-hidden": "true", text: "🌱" }),
    el("h3", { text: "Plant your first habit" }),
    el("p", { text: "Small, daily, repeatable. Streaks grow from here." }),
    el("button", { class: "btn btn-primary", text: "Create a habit", onclick: () => editor.open() }),
  ]);
}

/* ── insights view ─────────────────────────────────────────────────── */

function statCard(value, label, sub) {
  return el("div", { class: "stat" }, [
    el("span", { class: "stat-value", text: value }),
    el("span", { class: "stat-label", text: label }),
    sub ? el("span", { class: "stat-sub", text: sub }) : null,
  ]);
}

function renderOverall() {
  const active = store.activeHabits();
  const best = active.reduce((m, h) => Math.max(m, currentStreak(h, store.records)), 0);
  const totalChecks = active.reduce((s, h) => s + totalCompletions(h, store.records), 0);
  const rates = active.map((h) => completion(h, store.records, 30).rate);
  const avg = rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;

  return el("div", { class: "stat-grid" }, [
    statCard(String(active.length), "Active habits"),
    statCard(String(best), "Best current streak", "days"),
    statCard(`${Math.round(avg * 100)}%`, "30-day completion"),
    statCard(String(totalChecks), "Total check-ins"),
  ]);
}

function renderWeeklyReport() {
  const anchor = addDays(dayKey(), view.weekOffset * 7);
  const days = weekDays(anchor);
  const report = weeklyReport(store.activeHabits(), store.records, days);
  const start = startOfWeek(anchor);
  const label =
    view.weekOffset === 0 ? "This week" : view.weekOffset === -1 ? "Last week" : `Week of ${formatShort(start)}`;

  const bars = el(
    "div",
    { class: "week-bars", role: "img", "aria-label": `${label}: ${report.headline}` },
    days.map((key) => {
      const active = store.activeHabits();
      const prog = dayProgress(active, store.records, key);
      const frac = prog.total ? prog.done / prog.total : 0;
      const isFuture = daysBetween(key, dayKey()) > 0;
      const d = new Date(key.replaceAll("-", "/"));
      return el("div", { class: "week-bar" + (isFuture ? " future" : "") }, [
        el("div", { class: "week-bar-track" }, [
          el("div", { class: "week-bar-fill", style: `height:${Math.round(frac * 100)}%` }),
        ]),
        el("span", { class: "week-bar-label", text: WEEKDAYS_SHORT[d.getDay()][0] }),
      ]);
    }),
  );

  return el("div", { class: "card report" }, [
    el("div", { class: "report-head" }, [
      el("button", {
        class: "icon-btn",
        "aria-label": "Previous week",
        html: "&#8249;",
        onclick: () => {
          view.weekOffset -= 1;
          render();
        },
      }),
      el("div", { class: "report-title" }, [
        el("strong", { text: label }),
        el("span", { class: "report-headline", text: report.headline }),
      ]),
      el("button", {
        class: "icon-btn",
        "aria-label": "Next week",
        disabled: view.weekOffset >= 0,
        html: "&#8250;",
        onclick: () => {
          if (view.weekOffset < 0) {
            view.weekOffset += 1;
            render();
          }
        },
      }),
    ]),
    bars,
    report.strongest
      ? el("div", { class: "report-notes" }, [
          el("span", { class: "note" }, [
            el("b", { text: "Strongest: " }),
            `${report.strongest.emoji} ${report.strongest.name}`,
          ]),
          report.weakest
            ? el("span", { class: "note" }, [
                el("b", { text: "Needs love: " }),
                `${report.weakest.emoji} ${report.weakest.name}`,
              ])
            : null,
        ])
      : null,
  ]);
}

function renderHeatmap(habit) {
  const cells = heatmap(habit, store.records, 119);
  return el(
    "div",
    { class: "heat", role: "img", "aria-label": `Recent activity for ${habit.name}` },
    cells.map((c) =>
      el("span", {
        class: `heat-cell heat-${c.status}`,
        title: `${formatLong(c.key)} — ${{ done: "done", miss: "missed", today: "today", "off-today": "today (rest)", off: "rest" }[c.status]}`,
      }),
    ),
  );
}

function renderHabitAnalytics(habit) {
  const streak = currentStreak(habit, store.records);
  const best = bestStreak(habit, store.records);
  const comp = completion(habit, store.records, 30);

  return el("div", { class: `card habit-analytics color-${habit.color}` }, [
    el("div", { class: "ha-head" }, [
      el("span", { class: "habit-emoji", "aria-hidden": "true", text: habit.emoji }),
      el("div", { class: "ha-title" }, [
        el("strong", { text: habit.name }),
        el("span", {
          class: "ha-sched",
          text: habit.schedule === "daily"
            ? "Every day"
            : habit.schedule.map((d) => WEEKDAYS_SHORT[d]).join(" · "),
        }),
      ]),
      el("button", {
        class: "icon-btn kebab",
        "aria-label": `Options for ${habit.name}`,
        html: "&#8942;",
        onclick: (e) => openHabitMenu(e.currentTarget, habit),
      }),
    ]),
    el("div", { class: "ha-stats" }, [
      statCard(`${streak}`, "Current", "days"),
      statCard(`${best}`, "Best", "days"),
      statCard(`${Math.round(comp.rate * 100)}%`, "30-day", `${comp.completed}/${comp.scheduled}`),
    ]),
    renderHeatmap(habit),
  ]);
}

function renderArchived() {
  const archived = store.archivedHabits();
  if (archived.length === 0) return null;
  return el("details", { class: "archived" }, [
    el("summary", { text: `Archived (${archived.length})` }),
    el(
      "ul",
      { class: "archived-list" },
      archived.map((h) =>
        el("li", { class: "archived-item" }, [
          el("span", { class: "habit-emoji", "aria-hidden": "true", text: h.emoji }),
          el("span", { class: "archived-name", text: h.name }),
          el("button", {
            class: "btn btn-ghost btn-sm",
            text: "Restore",
            onclick: () => store.setArchived(h.id, false),
          }),
          el("button", {
            class: "btn btn-ghost btn-sm danger",
            text: "Delete",
            onclick: async () => {
              const ok = await confirmDialog({
                title: `Delete "${h.name}"?`,
                body: "This permanently removes the habit and its history.",
                confirmLabel: "Delete",
                danger: true,
              });
              if (ok) store.deleteHabit(h.id);
            },
          }),
        ]),
      ),
    ),
  ]);
}

function renderInsightsView() {
  const active = store.activeHabits();
  if (active.length === 0 && store.archivedHabits().length === 0) {
    return el("section", {}, [emptyState()]);
  }
  return el("section", { class: "insights" }, [
    renderOverall(),
    renderWeeklyReport(),
    active.length
      ? el("div", { class: "analytics-grid" }, active.map(renderHabitAnalytics))
      : el("p", { class: "muted", text: "No active habits — restore one below to see analytics." }),
    renderArchived(),
  ]);
}

/* ── data ops ──────────────────────────────────────────────────────── */

function exportBackup() {
  const blob = new Blob([store.export()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = el("a", { href: url, download: `habit-tracker-${dayKey()}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  announce("Backup exported.");
}

function importBackup() {
  const input = el("input", { type: "file", accept: "application/json", style: "display:none" });
  input.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const ok = await confirmDialog({
        title: "Import backup?",
        body: "This replaces all current habits and history with the backup's contents.",
        confirmLabel: "Import",
      });
      if (!ok) return;
      try {
        store.import(String(reader.result));
        view.selectedDay = dayKey();
        announce("Backup imported.");
      } catch (err) {
        await confirmDialog({ title: "Import failed", body: String(err.message || err), confirmLabel: "OK" });
      }
    };
    reader.readAsText(file);
  });
  document.body.append(input);
  input.click();
  input.remove();
}

async function resetAll() {
  const ok = await confirmDialog({
    title: "Reset everything?",
    body: "All habits and history will be permanently deleted.",
    confirmLabel: "Reset",
    danger: true,
  });
  if (ok) {
    store.reset();
    view.selectedDay = dayKey();
    announce("All data reset.");
  }
}

/* ── render loop ───────────────────────────────────────────────────── */

function render() {
  applyTheme();
  clear(root);
  root.append(
    renderHeader(),
    renderTabs(),
    view.tab === "today" ? renderTodayView() : renderInsightsView(),
  );
}

store.addEventListener("change", render);
store.addEventListener("error", () => announce("Couldn't save — storage may be full or blocked."));

// Keep "today" honest across midnight / returning to a stale tab.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && view.selectedDay !== dayKey()) {
    // Only snap forward if the user was sitting on the old "today".
    render();
  }
});

render();
