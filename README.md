# YetsyAI

An open-source suite of focused, production-quality apps — built one at a time,
each self-contained and deployable on its own.

The repository root hosts the **YetsyAI** cinematic-video landing page. Individual
products live under [`apps/`](./apps) as independent, zero-build static apps that
run on any static host (including GitHub Pages) with no server and no API keys.

## Apps

| App | Status | Description |
| --- | --- | --- |
| [Habit Tracker](./apps/habit-tracker) | ✅ Shipped | Streaks, analytics, weekly reports. 100% offline, no account. |

More apps from the roadmap are added iteratively. Each app is a real, working
product — no placeholder logic, no fake implementations.

## Roadmap

Apps that work fully client-side (no backend, no keys) are prioritised first so
every shipped app is genuinely functional:

- **Habit Tracker** — shipped
- **Water Reminder** — hydration tracking, goals, statistics
- **Financial Coach** — expense tracking, budgets, spending analysis, reports
- **Second Brain** — notes, search, mind maps
- **Deep Work Timer** (Dopamine Detox) — focus sessions, daily reports

Apps that require an AI backend and secrets (Study Buddy PDF→quiz, Nutrition
photo-scanning, Code Reviewer, Resume Builder, etc.) are built once a backend
service and configuration story are in place, so they ship as real products
rather than mockups.

## Local development

Every app is plain HTML/CSS/JS with ES modules — no build step. Because ES
modules require an HTTP origin, serve the folder rather than opening the file
directly:

```bash
# from the repo root
npx serve apps/habit-tracker
# or
python3 -m http.server --directory apps/habit-tracker 8080
```

Then open the printed URL.

## Deploying an app to GitHub Pages

Point Pages at the repo and browse to `/apps/habit-tracker/`, or deploy any
single app folder as its own Pages site — each app is fully self-contained.

## License

MIT — see [LICENSE](./LICENSE).
