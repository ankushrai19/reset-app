// Serve the repo (python3 -m http.server 8790) then: node tests/plan-sync-check.js
// For every day of the 84 and several made-up result sets, Plan and Today must list the same habits.
const { chromium, devices } = require("playwright");
const URL = process.env.URL || "http://localhost:8790/";
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ ...devices["Pixel 7"] })).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(800);
  const scen = {
    none: null,
    manyProblems: [["Vitamin D", 8, 30, 100], ["B12", 170, 197, 771], ["HbA1c", 6.1, null, 5.7], ["HDL", 33, 40, 60], ["Triglycerides", 170, null, 150], ["SGPT", 60, null, 45], ["Calcium", 8.5, 8.8, 10.6]],
    onlyLowVitD: [["Vitamin D", 12, 30, 100], ["HbA1c", 5.2, null, 5.7], ["HDL", 55, 40, 60], ["LDL", 90, null, 100], ["Triglycerides", 120, null, 150], ["SGPT", 30, null, 45]],
    onlyHighSugar: [["Vitamin D", 45, 30, 100], ["HbA1c", 6.3, null, 5.7]],
    allNormal: [["Vitamin D", 45, 30, 100], ["HbA1c", 5.2, null, 5.7], ["HDL", 55, 40, 60], ["LDL", 90, null, 100], ["Triglycerides", 120, null, 150], ["SGPT", 30, null, 45], ["B12", 400, 197, 771], ["Calcium", 9.5, 8.8, 10.6]],
    anaemia: [["Haemoglobin", 11.2, 13, 17], ["Ferritin", 12, 30, 400]],
    history: "H"
  };
  let fail = 0;
  for (const [name, rows] of Object.entries(scen)) {
    const r = await p.evaluate(rows => {
      const R = ResetRules, mk = (id, date, rr) => ({ id, date, lab: "T", tests: rr.map(([n, v, lo, hi]) => ({ key: R.keyFor(n), name: n, value: v, low: lo, high: hi })) });
      state.reports = rows === "H" ? [mk("a", "2026-08-20", [["Vitamin D", 5, 30, 100], ["B12", 180, 197, 771], ["SGPT", 60, null, 45]]), mk("b", "2026-11-09", [["Vitamin D", 34, 30, 100], ["B12", 420, 197, 771], ["SGPT", 38, null, 45], ["HbA1c", 5.9, null, 5.7]])] : rows ? [mk("t", "2026-11-09", rows)] : [];
      let plan = 0, screen = 0;
      for (let n = 1; n <= 84; n++) {
        const date = add(state.start, n - 1), wd = parse(date).getDay(), today = habits(date).list.map(h => h.id).sort();
        const pp = R.phasePlan(phaseOf(n), state.reports);
        const pl = pp.list.filter(h => (!h.days || h.days.includes(wd)) && (!h.extra || (n >= h.from && (!h.to || n <= h.to)))).map(h => h.id).sort();
        if (today.join() !== pl.join()) plan++;
        view = date; renderToday();
        const shown = [...document.querySelectorAll('#nextCard:not([hidden]) [data-act="done"],#list .item,#doneList .item')].map(e => e.dataset.id).sort();
        if (shown.join() !== today.join()) screen++;
      }
      view = TODAY; render(); return { plan, screen };
    }, rows);
    const ok = !r.plan && !r.screen; if (!ok) fail++;
    console.log((ok ? "PASS " : "FAIL ") + name.padEnd(14), "plan≠today days:", r.plan, "screen≠today days:", r.screen);
  }
  console.log("page errors:", errs.length ? errs : "none"); await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();
