# Habit Tracker

A minimal, offline-first habit tracker. Build streaks, see your progress in a
GitHub-style heatmap, and get an honest weekly report. No account, no server —
everything lives in your browser's `localStorage`.

## Features

- **Daily & custom schedules** — every day, or specific weekdays (rest days are
  respected in streaks and completion rates).
- **Streaks** — current and best streaks, with a grace period so an
  in-progress today never reads as a broken streak.
- **Backfill** — scroll the date rail to check off habits for earlier days.
- **Insights** — active-habit count, best streak, 30-day completion, and total
  check-ins, plus a per-habit heatmap of the last ~17 weeks.
- **Weekly reports** — a plain-language summary of each week with your
  strongest and weakest habits; navigate back through previous weeks.
- **Light / dark / system theme**, fully responsive, keyboard accessible, with
  reduced-motion support.
- **Backup & restore** — export/import your data as JSON. Nothing leaves your
  device unless you export it.

## Architecture

Zero build step. Plain ES modules with a clean separation of concerns:

```
js/
  dates.js    Pure date helpers (local "YYYY-MM-DD" day keys, week math)
  habits.js   Pure logic: scheduling, streaks, completion, heatmap, reports
  store.js    Single source of truth; localStorage persistence; change events
  dom.js      Tiny declarative element helper
  editor.js   Create/edit habit dialog (native <dialog>)
  app.js      View state + render loop; re-renders on every store change
```

`dates.js` and `habits.js` are pure and framework-free, which is why the logic
is fully unit-testable without a browser.

## Running locally

ES modules need an HTTP origin, so serve the folder rather than opening
`index.html` directly:

```bash
npm start            # serves on http://localhost:5173
# or
python3 -m http.server 5173
```

## Tests

```bash
npm test             # pure-logic unit tests (no dependencies)
npm run test:e2e     # browser smoke test (requires: npm i, and Chromium)
```

`test:e2e` uses `playwright-core`. Set `CHROMIUM_PATH` if you want to reuse an
already-installed Chromium/Chrome binary.

## Data & privacy

All data is stored under the `yetsy.habit-tracker.v1` key in `localStorage`.
Clearing site data or using the in-app **Reset** removes it permanently. Use
**Export backup** first if you want to keep it.

## License

MIT
