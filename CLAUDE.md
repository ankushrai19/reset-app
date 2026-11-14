# 12-Week Reset

A habit app that turns a blood report into a 12-week daily routine that starts easy and builds up. Installable web app (PWA) for Android, hosted on GitHub Pages. Owner: Anki (GitHub `ankushrai19`).

- Live: https://ankushrai19.github.io/reset-app/
- Current version: 3.2 (14 Nov 2026), offline cache `reset-v19`
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
node tests/i18n-check.js                          # Hindi: no English left on any screen (incl. panels, summary, upload, Ask, Trends); switching back is clean
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
| `index.html` | All markup, CSS (tokens at the top: light, then `:root[data-theme="dark"]`), a tiny head script that sets the theme before first paint, and the main script: `PHASES`, state, Today (week strip, Next up, rings), Progress grid, Plan, Settings screen, theme, + quick-add sheet, timers, water, steps, `show()` navigation. |
| `i18n.js` | `I18N`: language (`reset84lang` in localStorage, per device; default from the phone's language), English → Hindi swap of on-screen text with a MutationObserver, `{placeholder}` templates, `I18N.t()`, `I18N.loc` for dates, `setLang()` fires `langchange`. |
| `i18n-hi.js` | The Hindi dictionary, keyed by the app's exact English text. |
| `rules.js` | `ResetRules`: results catalog (22 markers, ranges, aliases), name matching, status, history phases, rules that turn results into habits, maintenance versions, retest intervals with sources. |
| `health.js` | Results tab (was Health): three sections `ov` / `all` / `tests` switched by `HealthUI.showPane()` without re-rendering, upload flow, review screen, duplicate check, slide-up result panel, after-upload "What changed" banner. `READER_MODE = "test"`. |
| `search.js` | `ResetSearch`: the full-screen Ask screen (`#askScreen`, opened from the Results search bar or the + sheet; `ResetSearch.open(q)`). Fixed answers (no AI): everyday words and misspellings → tests (`MARKER`, `TOPICS`), untracked tests (`OTHER`), test to ask for when missing (`TEST_NAME`), overview, "which tests haven't I done" (`BASIC`). `answer()` returns plain data; the screen part is separate. |
| `summary.js` | `ReportSummary`: per-report summary sheet, big-picture cause map, "What to fix" list, eat/avoid, result detail panel content, "When to test again" block. |
| `charts.js` | `ResetCharts`: Trends tab graphs, hand-drawn SVG, range switch, tooltips, table views. |
| `steps.js` | `ResetSteps`: motion-sensor step counting during walk timers, screen wake lock, stride/distance/calorie estimates. |
| `sync.js` | Firebase Google sign-in and Firestore sync (ES module). |
| `pdftext.js` | Reads PDF text on the device with pdf.js and keeps only pages with results (cuts AI tokens). |
| `firebase.js` | Bundled Firebase SDK (app, auth, firestore) built with esbuild from `firebase@11`. Rebuild only if needed. |
| `vendor/` | pdf.js 4.10.38 (`pdf.min.mjs`, `pdf.worker.min.mjs`); `fonts/` Inter and Space Grotesk (Latin) and Noto Sans Devanagari (Hindi), variable, OFL, self-hosted so the app works offline and makes no Google font requests. |
| `sw.js` | Service worker: offline cache, network-first for app files. |

Script order in `index.html`: in `<head>` the theme script, `i18n.js`, `i18n-hi.js`; then `sync.js` (module), `rules.js`, `steps.js`, main inline script, `charts.js`, `summary.js`, `health.js`, `search.js` (uses `HealthUI.openPanel/bar/fmtDate`). Top-level `const`s in the main script (`state`, `habits`, `add`, `diff`, `parse`, `TODAY`, `PHASES`, `mins`, `esc`...) are used by the later scripts.

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
- Ranges: the lab's own range on the report always wins. Without one, the catalog default is used; for women (profile sex "f") HDL is low under 50 mg/dL (MSD Manual) and haemoglobin under 12 g/dL (WHO); for men or sex not set, 40 and 13. `ResetRules.setSex()` is called at the start of every `render()`.
- Newest result per test wins; a later report that skips a test keeps the earlier value.
- Past days keep the plan they had: a day uses only reports whose `added` date (save day; falls back to test `date` for older reports) is on or before it, so a new report never re-scores history or breaks a streak.
- Plan and Today must show the same habits for today and every later day. There is a test for this (compare `habits(date)` with `ResetRules.phasePlan` filtered by weekday and extra day ranges, over all 84 days and several result sets, plus a report added mid-programme). Run it after any rules change.
- After a new report the 12 weeks continue (no restart); the plan updates from that day on.
- Chai with high sugar (HbA1c or fasting glucose out of range): half sugar days 1–3, a quarter days 4–6, none from day 7. Otherwise half in week 1, none from day 8.
- Report name matching (`keyFor`) ignores look-alike tests (MCH/MCHC, non-HDL, VLDL, TIBC, ionised calcium, urine creatinine, 1,25-dihydroxy vitamin D, ratios such as AST/ALT). If a report lists a test twice, the first value counts. Add new names to `tests/rules-check.js`.

**Retest intervals (checked against sources, Nov 2026)** are in `rules.js` → `RETEST` and `SRC`, shown with links in the app. Vitamin D ~3 months (AAFP/FPIN 2013), B12 2–3 months (GPnotebook), hs-CRP ~2 weeks (AHA/CDC), HbA1c prediabetes yearly (ADA), lipids ~3 months (ACC/AHA 2018), ALT 3–6 months (ACG 2017), Hb/iron ~4 weeks on iron (NHS), TSH 3 months to confirm (NICE NG145), kidney 3 months (KDIGO 2024). Diabetes-range HbA1c → "doctor sets the schedule". Always "or as your doctor advises".

**Report reading:** AI only extracts numbers; fixed rules decide everything else. Only extracted numbers are kept, never the file. The user reviews and can correct every value before saving. Duplicate check on save.

**Results tab** (was Health; element ids still `v-health`, `t-health`, `hBody`) is a live summary of the latest results in three sections: **Overview** (What changed banner after an upload, glance counts + next test chip, What to fix top 3, notes, big picture cause map, eat/avoid/tests folded, link to Plan), **All results** (grouped Needs attention / Back in range / Normal, tap for the slide-up detail panel), **Tests** (When to test again, reports history with Summary and delete, upload card). The search bar at the top opens the Ask screen. After an upload, Results opens on Overview.

**Health search (decided: fixed answers now, AI later):** answers come from the user's latest results plus fixed text. "Do I have…" questions always show a note that one test can't confirm or rule out a condition; never yes/no on a condition. Medicine or dose questions → "ask your doctor". A test not in the reports → its healthy range and the test to ask for, "Ask your doctor whether you need it". After Stage 2, AI may answer only the questions the fixed answers can't match (`kind: "unknown"`).

**Languages (3.2: English and Hindi, whole app):** the app is written in English. When Hindi is on, `i18n.js` swaps every on-screen phrase that has an entry in `i18n-hi.js`; anything without one stays English. So **any new or changed English text on screen needs a matching Hindi entry** (same exact English, `{name}` for numbers, dates and names), then run `tests/i18n-check.js`. Text the app builds can also go through `T()` / `I18N.t()`. Dates use `toLocaleDateString(I18N.loc, …)`. Everything on screen is translated: navigation, Today, Plan, habits and report reasons, Results (test names, what each result means, causes, what can follow, what helps, eat/avoid, big picture, when to test again), result panel, report summary, upload and review, Ask answers, Trends sentences and tooltips, Settings, messages. Lists of known phrases ("A, B, C.") are translated part by part; general templates like `{a} to {b}` can catch more than intended, so prefer exact entries. Ask understands Hindi and Hinglish words (`MARKER`/`TOPICS` in `search.js`, Hindi letters kept, nukta ignored) and Hindi/Hinglish "do I have", medicine and "which tests" questions; add new words with a case in `tests/search-check.js`. Owner-chosen wording: "{n} मुख्य कारण लगभग हर बात को स्पष्ट कर देते हैं". Hindi medical terms follow the MSD Manual Consumer Version in Hindi (msdmanuals.com/hi, checked Nov 2026): धमनी for arteries (not नस), तंत्रिका for nerves, गठिया (गाउट) for gout, किडनी की पथरी, सांस लेने में तकलीफ़, अवशोषण, एनीमिया (खून की कमी), सूजन, इंसुलिन रेज़िस्टेंस, फ़ाइब्रोसिस / सिरोसिस, डिहाइड्रेशन, स्टेटिन, प्रतिरक्षा. English explanations for all 22 tests were checked (Nov 2026) against MedlinePlus Lab Tests (medlineplus.gov/lab-tests) and the MSD Manual Consumer Version in English: B12 "mainly" (not only) from animal foods, plus metformin and antacids as causes; prediabetes "lifestyle changes can delay or prevent it" (not "very reversible"); ferritin: removed "hair fall"; vitamin D effects; fatty liver; calcium. Not confirmed from a source that could be opened: "tea or coffee with meals" lowers iron absorption (widely accepted; the NIH fact sheet blocks automated access). New health text should be checked the same way. Source titles on citation links stay in English. Hindi is a draft: a native speaker should review it, especially health text, before a public release. Simple everyday Hindi; keep common words (वॉक, प्रोटीन, विटामिन D, HbA1c).

**Safety and tone:** general wellness, not diagnosis. Never suggest medicines or doses. Plain language, no emoji, keep "not medical advice" notes.

**Design (3.0, "Night" look chosen on the design canvas https://claude.ai/artifact/6FgSUqBEddMLxt3VSKKqfN):** dark graphite with a lime accent (`--acc #c6f24e`, text on it `--acc-ink`; accent as text uses `--acc-fg`: lime in dark, olive `#4a6600` in light), Space Grotesk headings, Inter body. A matching light version exists. Theme setting in Settings, kept per device in `localStorage` `reset84theme` (not synced): `auto` (match phone, default), `time` (light 6:30 am to 6:30 pm), `dark`, `light`; re-checked every minute and on return to the app. Navigation: floating bar Today · Results · **+** · Progress · Plan. **+** opens quick add (upload report, start walk, watch steps, add water, ask). Progress has Days / Trends switch (Trends is `v-trends`). Settings opens from the profile button on Today (and the sync chip), with a back button. Today: week strip of the current plan week (tap a day to open it), "Next up" card, rings for habits / steps / water (water has −/+), still to do as cards, streak card. Status colours: low blue `--sky`, high `--bad`, back in range / OK green `--done`, caution amber `--sun`. Chart colours validated for colour-blind readers: light `#3a5a9c` / `#c8740f` / `#2f8a5b`, dark `#5a82e0` / `#d07a22` / `#36a56b` (tokens `--ch1 --ch2 --chg`). Every chart has a tooltip, a key for orange, and a table view.

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
