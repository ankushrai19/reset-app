// Serve the repo (python3 -m http.server 8790) then: node tests/safety-check.js
// Safety notes, focus habits, repeat week, weight and waist, calendar reminders. Made-up data only.
const { chromium, devices } = require("playwright");
const URL = process.env.URL || "http://localhost:8790/";
(async () => {
  const b = await chromium.launch(), p = await (await b.newContext({ ...devices["Pixel 7"] })).newPage(), errs = [];
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(URL); await p.waitForTimeout(400);
  await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(400);
  let fail = 0;
  const check = (label, ok, info) => { if (!ok) fail++; console.log((ok ? "PASS " : "FAIL ") + label.padEnd(60), ok ? "" : JSON.stringify(info)); };
  // fresh start each scenario: day 1 = start, no reports, no profile
  const reset = (o = {}) => p.evaluate(o => {
    state = shape({ start: o.start ? add(TODAY, o.start) : TODAY, reports: o.reports || [], profile: o.profile || {}, plan: { focusFrom: o.focusFrom ? add(TODAY, o.focusFrom) : add(TODAY, -100) } });
    view = TODAY; persist(); render(); show("today");
  }, o);
  const rep = (rows) => [{ id: "r", date: "2026-01-01", added: "2026-01-01", lab: "T", tests: rows.map(([k, v, lo, hi]) => ({ key: k, name: k, value: v, unit: "", low: lo ?? null, high: hi ?? null })) }];

  // ---- focus habits ----
  await reset();
  let r = await p.evaluate(() => ({ focus: [...habits(TODAY).focus].sort().join(), ring: document.getElementById("ringTxt").textContent, opt: document.querySelectorAll("#optList .item").length }));
  check("no report, day 1: focus is walk, water, sleep", r.focus === "sleep,walk,water", r);
  check("ring counts focus habits (0/3)", r.ring === "0/3", r);
  check("other habits are listed as optional", r.opt >= 2, r);
  r = await p.evaluate(() => { state.days[TODAY] = ["walk", "water"]; return Math.round(score(TODAY) * 100); });
  check("2 of 3 focus habits = 67% (optional ones don't count)", r === 67, r);
  r = await p.evaluate(() => { state.days[TODAY] = ["walk", "water", "sleep"]; return Math.round(score(TODAY) * 100); });
  check("all 3 focus habits = 100%", r === 100, r);
  await reset({ focusFrom: 5 });
  r = await p.evaluate(() => { state.days[TODAY] = ["walk", "water", "sleep"]; return { s: Math.round(score(TODAY) * 100), n: habits(TODAY).list.length }; });
  check("days before focus scoring keep the old rule (all habits)", r.s === Math.round(3 / r.n * 100), r);
  await reset({ reports: rep([["vitd", 12, 30, 100], ["hba1c", 6.1, null, 5.7], ["hdl", 35, 40, 60], ["tg", 190, null, 150]]), start: -30 });
  r = await p.evaluate(() => { const h = habits(TODAY); return { n: h.focus.size, ids: [...h.focus] }; });
  check("with report problems: 3 to 5 focus habits, report-linked first", r.n >= 3 && r.n <= 5 && r.ids.includes("walk"), r);

  // ---- pregnancy pause ----
  await reset({ reports: rep([["vitd", 12, 30, 100]]), profile: { sex: "f", preg: "yes" }, start: -30 });
  r = await p.evaluate(() => ({ ids: habits(TODAY).list.map(h => h.id), today: document.getElementById("safety").textContent, results: document.getElementById("hSafety").textContent, plan: document.getElementById("phases").textContent }));
  check("pregnancy: only gentle basics (water, walk, sleep)", r.ids.every(i => ["water", "walk", "sleep"].includes(i)) && r.ids.length > 0, r.ids);
  check("pregnancy: note on Today, Results and Plan", /pregnancy/i.test(r.today) && /pregnancy/i.test(r.results) && /pregnancy/i.test(r.plan));
  await reset({ profile: { sex: "m", preg: "yes" } });
  r = await p.evaluate(() => habits(TODAY).list.length);
  check("pregnancy answer is ignored unless sex is female", r > 3, r);

  // ---- diabetes ----
  await reset({ profile: { diab: "yes" } });
  r = await p.evaluate(() => document.getElementById("safety").textContent);
  check("diabetes medicines: doctor note with low-sugar signs", /medicines for diabetes/.test(r) && /shaking/.test(r), r);
  await p.click('#safety [data-ack="diab"]'); await p.waitForTimeout(80);
  r = await p.evaluate(() => ({ t: document.getElementById("safety").textContent, ack: state.plan.ack }));
  check("'I've talked to my doctor' hides the note", !/medicines for diabetes/.test(r.t) && r.ack && r.ack.diab, r);
  await reset({ reports: rep([["hba1c", 7.1, null, 5.7]]) });
  r = await p.evaluate(() => document.getElementById("safety").textContent);
  check("HbA1c 7.1 without medicines: 'see your doctor' note", /diabetes range/.test(r), r);
  await reset({ reports: rep([["hba1c", 6.0, null, 5.7]]) });
  r = await p.evaluate(() => document.getElementById("safety").textContent);
  check("HbA1c 6.0 (prediabetes): no diabetes note", !/diabetes range/.test(r), r);

  // ---- adults only ----
  await reset({ profile: { age: 16 } });
  r = await p.evaluate(() => document.getElementById("safety").textContent);
  check("age 16: 'made for adults' note", /adults/.test(r), r);

  // ---- kidney: protein as the doctor advises ----
  await reset({ reports: rep([["egfr", 52, 90, null]]), start: -12 });
  r = await p.evaluate(() => ({ t: (habits(TODAY).list.find(h => h.id === "protein") || {}).t, plan: document.getElementById("phases").textContent }));
  check("low eGFR: protein habit becomes 'as your doctor advises'", r.t === "Protein as your doctor advises", r.t);
  check("low eGFR: Plan shows the same", /Protein as your doctor advises/.test(r.plan));
  await reset({ reports: rep([["egfr", 104, 90, null]]), start: -12 });
  r = await p.evaluate(() => (habits(TODAY).list.find(h => h.id === "protein") || {}).t);
  check("normal eGFR: protein habit unchanged", r === "Protein at breakfast", r);

  // ---- repeat a week ----
  await reset({ start: -8 });
  r = await p.evaluate(() => ({ offer: document.getElementById("offer").textContent, n: dayN(TODAY) }));
  check("week 1 under 60%: offer to repeat it on day 2 of week 2", /Repeat last week/.test(r.offer) && r.n === 9, r);
  await p.click('#offer [data-week="repeat"]'); await p.waitForTimeout(80);
  r = await p.evaluate(() => ({ n: dayN(TODAY), past: [0, 3, 6].map(i => dayN(add(state.start, i))), len: calLen(), offer: document.getElementById("offer").textContent, cells: document.querySelectorAll("#grid .cell").length }));
  check("after repeat: today is plan day 2 again", r.n === 2, r);
  check("after repeat: past days keep their numbers (1, 4, 7)", r.past.join() === "1,4,7", r.past);
  check("after repeat: plan is one week longer (91 days)", r.len === 91 && r.cells === 91, r);
  check("after repeat: offer is gone", !r.offer, r.offer);
  await reset({ start: -8 });
  await p.evaluate(() => { for (let i = 0; i < 7; i++) state.days[add(state.start, i)] = habits(add(state.start, i)).list.map(h => h.id); persist(); render(); });
  r = await p.evaluate(() => document.getElementById("offer").textContent);
  check("good week: no offer", !r, r);
  await reset({ start: -12 });
  r = await p.evaluate(() => document.getElementById("offer").textContent);
  check("no offer after the first 3 days of a week", !r, r);

  // ---- weight and waist ----
  await reset();
  await p.evaluate(() => openBody(TODAY)); await p.fill("#bodyW", "82.4"); await p.fill("#bodyWaist", "94"); await p.click('#bodyForm [type="submit"]'); await p.waitForTimeout(80);
  r = await p.evaluate(() => ({ b: state.body[TODAY], w: state.profile.weight, open: !document.getElementById("bodySheet").hidden }));
  check("weight and waist saved, profile weight updated", r.b && r.b.w === 82.4 && r.b.waist === 94 && r.w === 82.4 && !r.open, r);
  await p.evaluate(() => { state.body[add(TODAY, -14)] = { w: 84, waist: 96 }; state.profile.sex = "m"; persist(); render(); show("trends"); });
  r = await p.evaluate(() => document.getElementById("charts").textContent);
  check("Trends: weight and waist graph with change and target", /Weight 82.4 kg \(-1.6 kg since/.test(r) && /Target under 90 cm/.test(r), r.slice(0, 200));
  await p.evaluate(() => openBody(TODAY)); await p.fill("#bodyW", "500"); await p.click('#bodyForm [type="submit"]'); await p.waitForTimeout(50);
  r = await p.evaluate(() => ({ b: state.body[TODAY], open: !document.getElementById("bodySheet").hidden }));
  check("impossible weight is rejected", r.b.w === 82.4 && r.open, r);
  await p.evaluate(() => { document.getElementById("bodySheet").hidden = true; });
  await reset({ start: -50 });
  await p.evaluate(() => { const sun = [...Array(7)].map((_, i) => add(TODAY, -i)).find(d => parse(d).getDay() === 0); view = sun; renderToday(); });
  await p.evaluate(() => document.querySelector('#list .item[data-id="weigh"], #optList .item[data-id="weigh"]').click()); await p.waitForTimeout(80);
  r = await p.evaluate(() => !document.getElementById("bodySheet").hidden);
  check("ticking the weekly weigh-in asks for the numbers", r);
  await p.evaluate(() => { document.getElementById("bodySheet").hidden = true; });

  // ---- calendar reminders ----
  await reset({ start: -50 });
  r = await p.evaluate(() => { const f = icsFile(), n = habits(TODAY).list.length; return { ev: (f.match(/BEGIN:VEVENT/g) || []).length, alarm: (f.match(/TRIGGER:PT0M/g) || []).length, weekly: /RRULE:FREQ=WEEKLY;BYDAY=/.test(f), until: /UNTIL=\d{8}T235900/.test(f), crlf: f.includes("\r\n"), all: calHabits().length }; });
  check("calendar file: one event with a reminder per habit", r.ev === r.all && r.alarm === r.all && r.ev >= 8, r);
  check("calendar file: weekday habits weekly, ends with the phase", r.weekly && r.until && r.crlf, r);

  console.log("page errors:", errs.length ? errs : "none");
  await b.close(); process.exit(fail || errs.length ? 1 : 0);
})();
