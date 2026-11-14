// Serve the repo (python3 -m http.server 8790) then: node tests/i18n-check.js
// Hindi coverage: switches to Hindi, visits every screen in many states (Today, Results and its panels,
// report summaries, upload and review, Ask answers, Trends with tooltips, Plan, Progress, Settings)
// and lists any English left. Then switches back and checks no Hindi remains. Made-up sample data only.
const { chromium, devices } = require("playwright");
const path = require("path"), fs = require("fs"), os = require("os");
const URL = process.env.URL || "http://localhost:8790/";
// Words that stay as they are in Hindi too: test codes, units, brands, the sample lab's name, week labels
const KEEP = /^(HbA1c|HDL|LDL|ALT|AST|GGT|TSH|SGPT|SGOT|B12|eGFR|hs-CRP|CRP|ESR|PTH|HOMA|IR|hs|LFT|KFT|CBC|PSA|T3|T4|OH|PDF|JPG|PNG|AI|Google|Samsung|Calendar|Galaxy|Watch|Android|Chrome|Firebase|Thyrocare|kcal|km|cm|kg|ng|pg|mg|µg|mL|dL|µIU|min|U|L|English|am|pm|AM|PM|Sample|Lab|W\d+|report)$/;
// Not checked: source titles on links (citations stay in their original language), the file name, user-typed lab names
const SKIP = "script,style,textarea,[hidden],[translate='no'],a[href^='http'],.steps + p.note,#sheetIn > p.note:first-of-type";
// one English phrase must have one Hindi meaning (a later entry would silently replace an earlier one)
{ const src = fs.readFileSync(path.join(__dirname, "..", "i18n-hi.js"), "utf8"), seen = {};
  for (const m of src.matchAll(/"((?:[^"\\]|\\.)*)":\s*"((?:[^"\\]|\\.)*)"/g)) (seen[m[1]] = seen[m[1]] || new Set()).add(m[2]);
  const clash = Object.entries(seen).filter(([, s]) => s.size > 1);
  console.log(clash.length ? "FAIL same English, different Hindi: " + clash.map(([e, s]) => e + " → " + [...s].join(" | ")).join("; ") : "PASS every English phrase has one Hindi meaning");
  if (clash.length) process.exitCode = 1; }
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ ...devices["Pixel 7"] })).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(400);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  const left = new Map();
  const grab = async where => {
    await p.waitForTimeout(40);
    const xs = await p.evaluate(SKIP => {
      const out = [], skip = el => !el || el.closest(SKIP);
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) {
        if (n.nodeType === 3) { const s = n.nodeValue.trim(); if (/[A-Za-z]{2}/.test(s) && !skip(n.parentElement)) out.push(s); }
        else if (!skip(n)) for (const a of ["placeholder", "aria-label"]) { const v = n.getAttribute(a); if (v && /[A-Za-z]{2}/.test(v)) out.push("[" + a + "] " + v); }
      }
      return out;
    }, SKIP);
    for (const x of xs) {
      const words = x.replace(/^\[[a-z-]+\] /, "").split(/[\s,.:;·()+\/–—\-↑↓"“”'।]+/).filter(w => /[A-Za-z]{2}/.test(w) && !KEEP.test(w));
      if (words.length && !left.has(x)) left.set(x, where);
    }
  };
  await p.evaluate(() => I18N.setLang("hi"));
  const views = async tag => { for (const v of ["today", "health", "progress", "trends", "plan", "settings"]) { await p.evaluate(v => show(v), v); await grab(tag + ":" + v); } };
  const ask = async qs => { for (const q of qs) { await p.evaluate(q => ResetSearch.open(q), q); await grab("ask: " + q); } await p.evaluate(() => ResetSearch.close()); };
  await views("empty");
  await p.evaluate(() => { document.getElementById("addSheet").hidden = false; }); await grab("add"); await p.evaluate(() => { document.getElementById("addSheet").hidden = true; });
  await ask(["vitamin d", "thyroid", "what does my report say", "kidney"]);
  // upload a (made-up) photo: in test mode the app shows sample results to review
  const img = path.join(os.tmpdir(), "i18n-check-photo.png");
  fs.writeFileSync(img, Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
  await p.evaluate(() => show("health"));
  await p.setInputFiles("#hFile", img); await p.waitForTimeout(500); await grab("upload: reading");
  await p.waitForTimeout(1800); await grab("upload: review");
  await p.click('#sheet [data-x="save"]'); await p.waitForTimeout(200); await grab("after save: banner");
  await p.evaluate(() => { document.getElementById("hFile").value = ""; });
  await p.setInputFiles("#hFile", img); await p.waitForTimeout(2300); await p.click('#sheet [data-x="save"]'); await p.waitForTimeout(150); await grab("upload: duplicate");
  await p.evaluate(() => { document.querySelector('#sheet [data-x="close"]').click(); });
  // sample reports, mid-plan, ticks on earlier days so Trends has data
  await p.evaluate(() => { state.reports = []; state.start = add(TODAY, -20); for (let i = 0; i < 20; i++) state.days[add(TODAY, -20 + i)] = i % 3 ? ["water", "walk", "meds", "sun"] : ["water"]; state.water[add(TODAY, -2)] = 6; state.steps[add(TODAY, -1)] = 6400; persist(); render(); show("health"); });
  await p.click("#hSample"); await p.waitForTimeout(150);
  await views("samples");
  for (const pane of ["ov", "all", "tests"]) { await p.evaluate(x => { show("health"); HealthUI.showPane(x); }, pane); await p.evaluate(() => document.querySelectorAll("#hBody details").forEach(d => d.open = true)); await grab("results:" + pane); }
  await p.evaluate(() => { const b = document.querySelector('#hBody [data-x="prio"]'); if (b) b.click(); }); await grab("results: all priorities");
  // the detail panel for every result in the samples
  const keys = await p.evaluate(() => Object.keys(ResetRules.latest(state.reports)));
  for (const k of keys) { await p.evaluate(k => HealthUI.openPanel(k), k); await grab("panel: " + k); }
  await p.evaluate(() => document.querySelector('.panelwrap [data-x="pclose"]').click());
  // report summaries
  for (const i of [0, 1]) { await p.evaluate(i => { show("health"); HealthUI.showPane("tests"); document.querySelectorAll("#hBody [data-sum]")[i].click(); }, i); await grab("summary " + i); await p.evaluate(() => document.querySelector('#sheet [data-x="close"]').click()); }
  // Ask answers, typed in English, Hindi and Hinglish
  await ask(["what is my vitamin results", "do i have thyroid", "heamoglobin range", "do i have anemia", "what does my report say", "which tests haven't I done", "folate", "which vitamin d tablet should i take", "hello there", "cholesterol", "liver", "kidney", "bones",
    "क्या मुझे थायरॉइड की समस्या है?", "मेरे विटामिन के नतीजे?", "हीमोग्लोबिन की सीमा", "मेरी रिपोर्ट क्या कहती है?", "कौन से टेस्ट नहीं हुए?", "vitamin ki kami hai kya", "khoon ki kami", "sugar kitni hai"]);
  // Trends in every range, with tooltips
  for (const r of ["2w", "4w", "all"]) {
    await p.evaluate(r => { show("trends"); const b = document.querySelector(`#charts [data-r="${r}"]`); if (b) b.click(); }, r); await grab("trends " + r);
    const tips = await p.evaluate(() => [...document.querySelectorAll("#charts .hit")].map(h => h.dataset.tip));
    for (const t of tips) { const tr = await p.evaluate(t => I18N.t(t), t); if (/[A-Za-z]{3}/.test(tr.replace(/\b(kcal|km|W\d+|HbA1c)\b/g, "")) && !left.has(tr)) left.set(tr, "trends tooltip"); }
  }
  // safety notes, focus and optional habits, repeat week, weight and waist, reminders
  const scene = o => p.evaluate(o => { state = shape({ ...JSON.parse(JSON.stringify(state)), ...o.set, profile: o.profile || {}, plan: { focusFrom: add(TODAY, -100) }, start: o.start != null ? add(TODAY, o.start) : state.start }); view = TODAY; persist(); render(); }, o);
  await scene({ profile: { diab: "yes", age: 16 } }); await p.evaluate(() => show("today")); await grab("today: diabetes + under 18");
  await p.evaluate(() => show("plan")); await grab("plan: safety notes");
  await scene({ profile: { sex: "f", preg: "yes" } }); for (const v of ["today", "health", "plan"]) { await p.evaluate(v => show(v), v); await grab("pregnancy: " + v); }
  await scene({ profile: {}, set: { reports: [{ id: "k", date: "2026-01-01", added: "2026-01-01", lab: "T", tests: [{ key: "egfr", name: "eGFR", value: 50, unit: "", low: 90, high: null }, { key: "hba1c", name: "HbA1c", value: 7.2, unit: "%", low: null, high: 5.7 }] }] }, start: -12 });
  await p.evaluate(() => show("today")); await grab("today: kidney + sugar note");
  await scene({ profile: {}, set: { reports: [], days: {} }, start: -8 }); await p.evaluate(() => show("today")); await grab("today: repeat offer");
  await p.click('#offer [data-week="repeat"]'); await p.evaluate(() => show("progress")); await grab("progress: repeated week");
  await scene({ profile: { sex: "m" }, set: { body: { [await p.evaluate(() => add(TODAY, -14))]: { w: 84, waist: 96 }, [await p.evaluate(() => TODAY)]: { w: 82.4, waist: 94 } } } });
  await p.evaluate(() => { show("trends"); openBody(TODAY); }); await grab("weight and waist");
  await p.evaluate(() => { document.getElementById("bodySheet").hidden = true; state.body = { [TODAY]: { w: 82.4, waist: null } }; state.profile = {}; render(); show("trends"); }); await grab("trends: weight only");
  await p.evaluate(() => { show("settings"); document.getElementById("calLinks").open = true; }); await grab("settings: reminders");
  // Today in many states
  for (const off of [-20, -3, 0, 3, 12, 30, 50, 63]) { await p.evaluate(o => { show("today"); view = add(TODAY, o); renderToday(); }, off); await grab("today+" + off); }
  const habitLeft = await p.evaluate(() => { const o = []; for (let n = 1; n <= 84; n++) for (const h of habits(add(state.start, n - 1)).list) for (const s of [h.t, h.w, h.pw]) if (s && I18N.t(s) === s) o.push(s); return [...new Set(o)]; });
  habitLeft.forEach(s => left.set(s, "habit text"));
  // every health text the app can show, for all 22 tests (not only those in the samples)
  const content = await p.evaluate(() => { const R = ResetRules, o = []; for (const c of Object.values(R.CATALOG)) o.push(c.name, c.about); for (const r of Object.values(R.RETEST)) { o.push(r.text); if (r.diabetes) o.push(r.diabetes); } for (const r of Object.values(R.RULES)) for (const st of Object.values(r)) if (st.note) o.push(st.note); return o.filter(s => I18N.t(s) === s && /[a-z]{3}/.test(s)); });
  content.forEach(s => left.set(s, "health content"));
  let fail = 0;
  for (const [s, where] of left) { fail++; console.log("FAIL untranslated (" + where + "): " + s); }
  if (!left.size) console.log("PASS no English left on any screen");
  await p.evaluate(() => I18N.setLang("en")); await p.waitForTimeout(100);
  const hiLeft = await p.evaluate(() => { const o = []; for (const v of ["today", "health", "progress", "trends", "plan", "settings"]) { show(v); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (/[ऀ-ॿ]/.test(n.nodeValue) && !n.parentElement.closest("[translate='no'],script")) o.push(n.nodeValue.trim()); } return [...new Set(o)]; });
  if (hiLeft.length) { fail++; console.log("FAIL Hindi left after switching back:", hiLeft.slice(0, 10)); } else console.log("PASS switching back to English restores everything");
  console.log("page errors:", errs.length ? errs : "none");
  await b.close(); process.exit(fail || errs.length || process.exitCode ? 1 : 0);
})();
