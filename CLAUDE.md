# 12-Week Reset

A habit app that turns a blood report into a 12-week daily routine that starts easy and builds up. Installable web app (PWA) for Android, hosted on GitHub Pages. Owner: Anki (GitHub `ankushrai19`).

- Live: https://ankushrai19.github.io/reset-app/
- Current version: 2.3 (14 Nov 2026), offline cache `reset-v16`
- Owner's phone: Android, Samsung Galaxy Watch

## How to work on this repo

- Plain HTML/CSS/JS, no framework, no build step (except `firebase.js`, see below). Keep it that way unless asked.
- Test every change on an emulated phone with Playwright (`devices['Pixel 7']`, plus `'Galaxy S8'` for narrow screens), in light **and** dark mode. Check: no page errors, no horizontal overflow (`scrollWidth > innerWidth`), and look at screenshots.
- Never put the owner's real health results in the repo. The repo is public. Use made-up sample values in code and tests.
- Explain changes to the owner in plain language, step by step. He prefers brief questions and thorough answers, and wants to approve direction before big changes.

## Checks to run before every release

```
node tests/rules-check.js                         # report name matching, chai taper
node tests/search-check.js                        # Health tab search: everyday questions, misspellings, missing tests
node tests/steps-check.js                         # step detection on simulated movement
python3 -m http.server 8790 &                     # then:
node tests/plan-sync-check.js                     # Plan and Today match, past days keep their plan, 8 result sets
```
All use made-up data and must print only PASS. Also take light and dark screenshots of anything you changed.

## Releasing (do all of these every time)

1. Bump `APP_VERSION` in `index.html` (Plan → Settings shows it).
2. Bump `CACHE` in `sw.js` (`reset-vNN`), and add any new file to its `FILES` list.
3. Commit and push to `main`. Commit trailer:
   ```
   Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
   ```
4. Confirm GitHub Pages published **this** commit:
   `gh api "repos/ankushrai19/reset-app/actions/runs?per_page=3"`, then find the run whose `head_sha` matches HEAD with `conclusion: success`.
   **Known quirk:** Pages sometimes skips a push (the newest run shows the previous sha). If so, push an empty commit (`git commit --allow-empty -m "Trigger Pages rebuild for version X"`) and check again.
5. The service worker fetches app files with `cache: "no-cache"` and reloads once when a new version takes over, so users get updates on next open.

The GitHub API through this environment can't create repos or change Pages settings; the owner does those in the browser.

## Files

| File | What it does |
|---|---|
| `index.html` | All markup, CSS (tokens at the top, light + dark), and the main script: `PHASES` (habits per phase, step goals), state, Today, Progress grid, Plan, Settings, timers, water, steps tile, tab navigation. |
| `rules.js` | `ResetRules`: results catalog (22 markers, ranges, aliases), name matching, status, history phases, rules that turn results into habits, maintenance versions, retest intervals with sources. |
| `health.js` | Health tab (live summary of latest results), upload flow, review screen, duplicate check, slide-up result panel, after-upload "What changed" banner. `READER_MODE = "test"`. |
| `search.js` | `ResetSearch`: "Ask about your results" box on the Health tab. Fixed answers (no AI): everyday words and misspellings → tests (`MARKER`, `TOPICS`), untracked tests (`OTHER`), test to ask for when missing (`TEST_NAME`), overview, "which tests haven't I done" (`BASIC`). `answer()` returns plain data; the screen part is separate. |
| `summary.js` | `ReportSummary`: per-report summary sheet, big-picture cause map, "What to fix" list, eat/avoid, result detail panel content, "When to test again" block. |
| `charts.js` | `ResetCharts`: Trends tab graphs, hand-drawn SVG, range switch, tooltips, table views. |
| `steps.js` | `ResetSteps`: motion-sensor step counting during walk timers, screen wake lock, stride/distance/calorie estimates. |
| `sync.js` | Firebase Google sign-in and Firestore sync (ES module). |
| `pdftext.js` | Reads PDF text on the device with pdf.js and keeps only pages with results (cuts AI tokens). |
| `firebase.js` | Bundled Firebase SDK (app, auth, firestore) built with esbuild from `firebase@11`. Rebuild only if needed. |
| `vendor/` | pdf.js 4.10.38 (`pdf.min.mjs`, `pdf.worker.min.mjs`). |
| `sw.js` | Service worker: offline cache, network-first for app files. |

Script order in `index.html`: `sync.js` (module), `rules.js`, `steps.js`, main inline script, `charts.js`, `summary.js`, `health.js`, `search.js` (uses `HealthUI.openPanel/bar/fmtDate`). Top-level `const`s in the main script (`state`, `habits`, `add`, `diff`, `parse`, `TODAY`, `PHASES`, `mins`, `esc`...) are used by the later scripts.

## Data model

One object in `localStorage` (`reset84`) and, when signed in, one Firestore doc `users/{uid}`:

```
{ start: "YYYY-MM-DD",
  days:   { "YYYY-MM-DD": [habitIds ticked] },
  water:  { date: glasses },
  reports:[{ id, date, added?, lab, sample?, tests:[{ key, name, value, unit, low, high }] }],
  steps:  { date: total from watch },          // a watch total wins over counted walks
  walks:  [{ id, date, start, end, steps, km, kcal }],
  profile:{ weight, height, age, sex } }
```

Firestore rules the owner must keep in sync with these keys (Firestore → Rules):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid} {
      allow read, delete: if request.auth != null && request.auth.uid == uid;
      allow create, update: if request.auth != null && request.auth.uid == uid
        && request.resource.data.keys().hasOnly(['start', 'days', 'water', 'reports', 'steps', 'walks', 'profile', 'updatedAt'])
        && request.resource.data.start is string
        && request.resource.data.days is map;
    }
  }
}
```

Adding a new top-level key means: update load/applyRemote/restore in `index.html`, merge + write in `sync.js`, and tell the owner to update these rules.

Sync: a phone with no unsent changes (`reset84insync` in localStorage = account id) takes the cloud copy as it is on start, so deletions and un-ticks made on another device stick; a phone with unsent changes merges both (union).

Firebase project: `reset-app-17bdb`, Blaze plan, Firestore in asia-south1, Google sign-in, authorized domain `ankushrai19.github.io`. The web config in `sync.js` is public by design.

## Product rules (decided with the owner)

**Phases:** days 1–7 Easy start, 8–21 Build, 22–42 Strengthen, 43–84 Lifestyle. Step goals 5,000 / 6,500 / 8,000 / 9,000. A good day is 70%+ of that day's habits.

**Plan follows results (rules.js):**
- Core habits always stay: water, walk, sleep, protein, plate, strength, screens, weigh-in.
- Conditional habits (`NEED`) stay only if a matching result is out of range, or untested: sun, meds, chai, millet, nuts, nofried, dinner.
- Extras added for problems: B12 food, No alcohol (days 1–21), Calcium at dinner (from day 8), Iron food (from day 8).
- History per marker: `active` (out of range), `maintain` (first normal after out of range → lighter version: sun 3 days a week, "maintenance dose as prescribed", B12 food 3 days a week), `resolved` (normal on two tests in a row → removed), `never`.
- Newest result per test wins; a later report that skips a test keeps the earlier value.
- Past days keep the plan they had: a day uses only reports whose `added` date (save day; falls back to test `date` for older reports) is on or before it, so a new report never re-scores history or breaks a streak.
- Plan and Today must show the same habits for today and every later day. There is a test for this (compare `habits(date)` with `ResetRules.phasePlan` filtered by weekday and extra day ranges, over all 84 days and several result sets, plus a report added mid-programme). Run it after any rules change.
- After a new report the 12 weeks continue (no restart); the plan updates from that day on.
- Chai with high sugar (HbA1c or fasting glucose out of range): half sugar days 1–3, a quarter days 4–6, none from day 7. Otherwise half in week 1, none from day 8.
- Report name matching (`keyFor`) ignores look-alike tests (MCH/MCHC, non-HDL, VLDL, TIBC, ionised calcium, urine creatinine, 1,25-dihydroxy vitamin D, ratios such as AST/ALT). If a report lists a test twice, the first value counts. Add new names to `tests/rules-check.js`.

**Retest intervals (checked against sources, Nov 2026)** are in `rules.js` → `RETEST` and `SRC`, shown with links in the app. Vitamin D ~3 months (AAFP/FPIN 2013), B12 2–3 months (GPnotebook), hs-CRP ~2 weeks (AHA/CDC), HbA1c prediabetes yearly (ADA), lipids ~3 months (ACC/AHA 2018), ALT 3–6 months (ACG 2017), Hb/iron ~4 weeks on iron (NHS), TSH 3 months to confirm (NICE NG145), kidney 3 months (KDIGO 2024). Diabetes-range HbA1c → "doctor sets the schedule". Always "or as your doctor advises".

**Report reading:** AI only extracts numbers; fixed rules decide everything else. Only extracted numbers are kept, never the file. The user reviews and can correct every value before saving. Duplicate check on save.

**Health tab** is a live summary of the latest results: glance counts + next test chip → What to fix (top 3) → big picture cause map → results grouped (Needs attention / Back in range / Normal) with a slide-up detail panel → eat/avoid/tests (folded) → link to Plan → When to test again → reports history. After an upload, return to Health with a "What changed" banner.

**Health search (decided: fixed answers now, AI later):** answers come from the user's latest results plus fixed text. "Do I have…" questions always show a note that one test can't confirm or rule out a condition; never yes/no on a condition. Medicine or dose questions → "ask your doctor". A test not in the reports → its healthy range and the test to ask for, "Ask your doctor whether you need it". After Stage 2, AI may answer only the questions the fixed answers can't match (`kind: "unknown"`).

**Safety and tone:** general wellness, not diagnosis. Never suggest medicines or doses. Plain language, no emoji, keep "not medical advice" notes.

**Design:** Today = "Next up" card (option A). Tabs: Today, Health, Progress, Trends, Plan. Chart colours validated for colour-blind readers: light `#3a5a9c` / `#c8740f` / `#2f8a5b`, dark `#5a82e0` / `#d07a22` / `#36a56b` (tokens `--ch1 --ch2 --chg`). Every chart has a tooltip, a key for orange, and a table view.

## Related documents (owner's private Claude artifacts; ask the owner if you can't open them)

- Roadmap and open items (Claude Doc): https://claude.ai/artifact/9boCjr8UVbqqUaQkzCMwiq
- Today screen design options; option A was chosen (design canvas): https://claude.ai/artifact/FWssz4vkqHy6usY2nmChyu
- History: the app was built in one long claude.ai chat (13 Nov 2026) in the owner's "Personal" project. This file replaces that chat as the source of truth.

## Status and next steps

Done: Health tab search (2.3), Stage 1 report upload in test mode, summaries, personalised plan, maintenance step, retest schedule, Trends graphs, step counting during walks, daily steps from watch, profile, sync.

Open (owner decides order):
1. **Stage 2, real report reading:** a Firebase Cloud Function (Blaze plan is on) that sends the trimmed PDF text or photo to Claude and returns `{date, lab, tests:[{name, value, unit, low, high}]}`; the Anthropic API key goes in Firebase Secret Manager, never in the repo or chat. Then set `READER_MODE = "live"` in `health.js`. Owner still needs to add API credit.
2. **Option B, Android app with Health Connect:** wrap the app with Capacitor + `@capgo/capacitor-health` to read steps, distance, active calories and heart rate (Galaxy Watch via Samsung Health). Exact steps for Start walk even with the screen off. Build the APK with GitHub Actions (this environment can't download the Android SDK). This replaces the PWABuilder route for the Play Store.
3. (Decided in 2.2, see Product rules: chai taper, continue after a new report, past days keep their plan.) Idea for later: when day 84 has passed, offer "Start a new 12 weeks".
4. Public readiness: first-launch disclaimer, privacy policy page, Play Console health/data-safety declarations, 12 testers for 14 days.
5. Roadmap (after the base app is final): doctor's prescriptions in the plan; repeat-test comparison report.
