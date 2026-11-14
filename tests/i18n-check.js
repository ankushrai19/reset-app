// Serve the repo (python3 -m http.server 8790) then: node tests/i18n-check.js
// Hindi coverage: switches to Hindi, visits every translated screen in many states, and lists any English left.
// Then switches back and checks no Hindi remains. Made-up sample data only.
const { chromium, devices } = require("playwright");
const URL = process.env.URL || "http://localhost:8790/";
// Words that stay as they are in Hindi too (test names, units, brands, the lab's own name)
const KEEP = /^(HbA1c|HDL|LDL|ALT|AST|GGT|TSH|B12|eGFR|hs-CRP|ESR|PDF|Google|Samsung|Chrome|Firebase|kcal|km|cm|kg|ng|pg|mg|mL|dL|µIU|min|English|am|pm|L|Sample|Lab)$/;
// Parts not translated yet (next round): health explanations, Ask answers, graph sentences
const LATER = "#charts,.panelwrap,#askOut,.prio,.bp,.fold,.rlist .rn,.okrow,#sheet,.ntmini p,.nexttest,.ph .note b + *,.retest b";
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ ...devices["Pixel 7"] })).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(500);
  await p.evaluate(() => { localStorage.clear(); });
  await p.reload(); await p.waitForTimeout(500);
  const left = new Map();
  const grab = async where => {
    const xs = await p.evaluate(([LATER]) => {
      const out = [], skip = el => !el || el.closest("script,style,textarea,[hidden],[translate='no']," + LATER);
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT); let n;
      while ((n = w.nextNode())) {
        if (n.nodeType === 3) { const s = n.nodeValue.trim(); if (/[A-Za-z]{2}/.test(s) && !skip(n.parentElement)) out.push(s); }
        else if (!skip(n)) for (const a of ["placeholder", "aria-label"]) { const v = n.getAttribute(a); if (v && /[A-Za-z]{2}/.test(v)) out.push("[" + a + "] " + v); }
      }
      return out;
    }, [LATER]);
    for (const x of xs) {
      // drop words that stay English (names, units); what remains is untranslated text
      const rest = names.reduce((t, nm) => t.split(nm).join(" "), x.replace(/^\[[a-z-]+\] /, "")).split(/[\s,.:;·()+\/–—-]+/).filter(w => /[A-Za-z]{2}/.test(w) && !KEEP.test(w) && !/[ऀ-ॿ]/.test(w));
      if (rest.length && !/^[ऀ-ॿ]/.test(x)) { if (!left.has(x)) left.set(x, where); }
      else if (rest.length && /[A-Za-z]{4}/.test(rest.join(""))) { if (!left.has(x)) left.set(x, where); }
    }
  };
  const names = await p.evaluate(() => Object.values(ResetRules.CATALOG).flatMap(c => [c.name, c.name.replace(/ \(.*\)/, "")]).sort((a, b) => b.length - a.length));
  await p.evaluate(() => I18N.setLang("hi"));
  const views = async tag => { for (const v of ["today", "health", "progress", "plan", "settings"]) { await p.evaluate(v => show(v), v); await p.waitForTimeout(30); await grab(tag + ":" + v); } };
  await views("empty");
  await p.evaluate(() => { document.getElementById("addSheet").hidden = false; }); await grab("add"); await p.evaluate(() => { document.getElementById("addSheet").hidden = true; });
  await p.evaluate(() => ResetSearch.open()); await grab("ask"); await p.evaluate(() => ResetSearch.close());
  await p.evaluate(() => { state.start = add(TODAY, -9); state.days[add(TODAY, -9)] = ["water", "sun"]; persist(); render(); show("health"); });
  await p.click("#hSample"); await p.waitForTimeout(150);
  await views("samples");
  for (const pane of ["ov", "all", "tests"]) { await p.evaluate(x => { show("health"); HealthUI.showPane(x); }, pane); await grab("results:" + pane); }
  for (const off of [-9, -3, 0, 3, 12, 30, 50, 83]) { await p.evaluate(o => { show("today"); view = add(TODAY, o); renderToday(); }, off); await p.waitForTimeout(20); await grab("today+" + off); }
  await p.evaluate(() => { view = TODAY; state.days[TODAY] = habits(TODAY).list.map(h => h.id); persist(); render(); showDone = true; renderToday(); }); await grab("today:all-done");
  // every habit line, tip and report reason over the 84 days, as the screen would show them
  const habitLeft = await p.evaluate(() => { const o = []; for (let n = 1; n <= 84; n++) for (const h of habits(add(state.start, n - 1)).list) for (const s of [h.t, h.w, h.pw]) if (s && I18N.t(s) === s) o.push(s); return [...new Set(o)]; });
  habitLeft.forEach(s => left.set(s, "habit text"));
  let fail = 0;
  for (const [s, where] of left) { fail++; console.log("FAIL untranslated (" + where + "): " + s); }
  if (!left.size) console.log("PASS no English left on translated screens");
  // back to English: no Hindi anywhere
  await p.evaluate(() => I18N.setLang("en")); await p.waitForTimeout(100);
  const hiLeft = await p.evaluate(() => { const o = []; for (const v of ["today", "health", "progress", "plan", "settings"]) { show(v); const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (/[ऀ-ॿ]/.test(n.nodeValue) && !n.parentElement.closest("[translate='no'],script")) o.push(n.nodeValue.trim()); } return [...new Set(o)]; });
  if (hiLeft.length) { fail++; console.log("FAIL Hindi left after switching back:", hiLeft.slice(0, 10)); } else console.log("PASS switching back to English restores everything");
  console.log("page errors:", errs.length ? errs : "none");
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();
