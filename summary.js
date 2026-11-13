// Report summary: a plain-language walkthrough of one report, built from fixed content (no AI).
(function () {
  const R = window.ResetRules;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmtDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); };

  // Per result: common causes, what it can lead to, one action, foods, things to cut, tests to ask about.
  const INFO = {
    vitd: { why: "Too little direct sun (indoor work, travel by car, winter smog) and few vitamin D foods.", risk: "Tiredness, low mood, back and leg aches, cramps, frequent infections, and weaker bones over time.", act: "Daily midday sun and a vitamin D course from your doctor.", eat: ["Egg yolks", "Fatty fish (salmon, mackerel, sardines, rohu)", "Sun-dried mushrooms", "Fortified milk"], tests: ["PTH and phosphorus", "Repeat vitamin D after 3 months"] },
    b12: { why: "B12 comes only from animal foods, so a mostly vegetarian diet, acidity medicines or poor absorption lower it.", risk: "Tiredness, poor memory and focus, tingling or numbness in hands and feet; long-term nerve damage.", act: "B12 foods daily; ask your doctor about tablets or injections.", eat: ["Eggs", "Curd, milk, paneer", "Fish and chicken"], tests: ["Homocysteine or methylmalonic acid if borderline"] },
    hba1c: { why: "Insulin resistance: cells respond poorly to insulin, usually from belly fat, refined carbs, sugar and sitting a lot.", risk: "Prediabetes can become type 2 diabetes within a few years. It is very reversible at this stage.", act: "Walk after meals, cut sugar and refined carbs, lose some belly fat.", eat: ["Millets: jowar, bajra, ragi", "Dal, rajma, chana, sprouts", "Half a plate of vegetables"], avoid: ["Sugar in tea, sweets, cold drinks, juice", "Maida, white bread, big portions of white rice"], tests: ["Fasting insulin (HOMA-IR)", "Repeat HbA1c after 3 months"] },
    glucose: { why: "Insulin resistance, a carb-heavy dinner the night before, poor sleep or stress.", risk: "Repeated high readings point toward diabetes.", act: "Walk after dinner and keep dinner light and early.", eat: ["High-fibre foods", "Protein at every meal"], avoid: ["Late heavy dinners", "Sugary drinks"], tests: ["HbA1c"] },
    chol: { why: "Diet high in saturated and trans fats, genetics, low activity.", risk: "Builds up in arteries over the years.", act: "Cut fried food; walk daily.", eat: ["Oats", "Nuts", "Fish"], avoid: ["Fried and bakery food", "Vanaspati and reused oil"], tests: ["Repeat lipid profile after 3 months"] },
    hdl: { why: "Little exercise, belly fat, refined carbs, smoking and genetics.", risk: "Less cholesterol is cleared from artery walls, which raises heart risk.", act: "Regular brisk walking and some strength training.", eat: ["Walnuts and almonds", "Flaxseed or chia", "Fish twice a week", "Mustard or olive oil in moderation"], avoid: ["Smoking"], tests: [] },
    ldl: { why: "Saturated and trans fats, fried food, genetics.", risk: "Plaque in arteries over years.", act: "Cut fried and bakery food.", eat: ["Oats", "Dal and beans", "Nuts"], avoid: ["Fried snacks", "Bakery items", "Ghee and butter in large amounts"], tests: ["Repeat lipid profile after 3 months"] },
    tg: { why: "Extra sugar, refined carbs, alcohol and late meals; a hallmark of insulin resistance.", risk: "Raises heart risk and fatty liver risk. Responds to diet within weeks.", act: "Cut sugar and alcohol; eat dinner early.", eat: ["Fish", "Vegetables", "Whole grains"], avoid: ["Sugar", "Alcohol", "Late heavy dinners"], tests: [] },
    alt: { why: "Most often fatty liver, linked to sugar, belly fat and triglycerides. Alcohol, some medicines and supplements also raise it.", risk: "Long-standing fatty liver can scar the liver. It reverses with 5–10% weight loss.", act: "No alcohol, less sugar, early dinner, lose some weight.", eat: ["Vegetables", "Coffee without sugar in moderation"], avoid: ["Alcohol", "Herbal or detox supplements", "Unneeded painkillers"], tests: ["Ultrasound of the abdomen (fatty liver)"] },
    ast: { why: "Liver stress, or muscle strain after heavy exercise.", risk: "Read together with ALT.", act: "Avoid alcohol; recheck with ALT.", avoid: ["Alcohol"], tests: [] },
    ggt: { why: "Alcohol, fatty liver, some medicines.", risk: "Points to liver stress, especially from alcohol.", act: "Stop alcohol for at least 3 months.", avoid: ["Alcohol"], tests: [] },
    crp: { why: "A recent cold, fever, injury or tooth problem; also belly fat, fatty liver and low vitamin D.", risk: "Long-term inflammation damages blood vessels. One reading can be temporary.", act: "Repeat in 2–4 weeks when you are well.", eat: ["Fish, walnuts, flaxseed", "Vegetables and fruit"], avoid: ["Smoking", "Fried food"], tests: ["Repeat hs-CRP and ESR in 2–4 weeks"] },
    esr: { why: "Any inflammation or infection; it is a non-specific test.", risk: "Meaningful only with other results.", act: "Repeat with hs-CRP.", tests: ["Repeat ESR with hs-CRP"] },
    calcium: { why: "Usually low vitamin D, which you need to absorb calcium.", risk: "Muscle cramps, tingling, and bone loss over time.", act: "Calcium foods daily; fix vitamin D.", eat: ["Curd, milk, paneer", "Ragi", "Til (sesame)", "Green leafy vegetables"], avoid: ["Tea or coffee with meals (blocks absorption)"], tests: ["Albumin, PTH"] },
    phosphorus: { why: "Low vitamin D or raised PTH; also varies with meals and time of day.", risk: "Weak bones and muscles if it stays low.", act: "Fix vitamin D; repeat fasting.", eat: ["Dairy", "Eggs", "Dal and nuts"], tests: ["Repeat fasting phosphorus", "PTH"] },
    tsh: { why: "An under- or over-active thyroid.", risk: "Affects weight, energy, cholesterol and mood.", act: "See your doctor; don't start thyroid medicine on your own.", tests: ["Free T3 and T4", "Thyroid antibodies"] },
    creatinine: { why: "Reduced kidney filtering, dehydration, high muscle mass or protein supplements.", risk: "Needs a doctor's review if it stays high.", act: "Drink enough water; see your doctor.", avoid: ["Unneeded painkillers"], tests: ["Repeat with eGFR", "Urine protein"] },
    egfr: { why: "Reduced kidney filtering.", risk: "Needs a doctor's review before supplements or new medicines.", act: "See your doctor.", avoid: ["Unneeded painkillers"], tests: ["Urine albumin"] },
    uric: { why: "Purine-rich food, alcohol (especially beer), sugary drinks, dehydration.", risk: "Gout and kidney stones.", act: "More water; less alcohol and sugary drinks.", eat: ["Plenty of water", "Low-fat dairy"], avoid: ["Beer and alcohol", "Sugary drinks", "Red meat and organ meat"], tests: [] },
    hb: { why: "Low iron, B12 or folate, or blood loss.", risk: "Tiredness, breathlessness and paleness (anaemia).", act: "Iron foods with vitamin C; see your doctor.", eat: ["Dal, rajma, greens", "Eggs and meat", "Lemon or amla with meals"], avoid: ["Tea or coffee with meals"], tests: ["Ferritin", "B12 and folate"] },
    iron: { why: "Low iron intake or absorption, or blood loss.", risk: "Can lead to anaemia.", act: "Iron foods with vitamin C.", eat: ["Dal, rajma, greens", "Eggs and meat", "Lemon or amla with meals"], avoid: ["Tea or coffee with meals"], tests: ["Ferritin"] },
    ferritin: { why: "Low iron stores.", risk: "Tiredness and hair fall even before anaemia shows.", act: "Iron foods with vitamin C; ask your doctor about iron.", eat: ["Dal, greens", "Eggs and meat", "Vitamin C with meals"], avoid: ["Tea or coffee with meals"], tests: ["Haemoglobin"] }
  };

  const HABITS = [
    { keys: ["vitd", "calcium", "phosphorus"], habit: "Sunlight on bare arms and legs", target: "20–30 min, 11 am–1 pm, 4–5 days a week" },
    { keys: ["hba1c", "glucose", "hdl", "tg", "alt", "crp"], habit: "Brisk walking", target: "30–45 min, 5 days a week" },
    { keys: ["hba1c", "hdl"], habit: "Strength training", target: "2–3 days a week" },
    { keys: ["hba1c", "tg", "alt", "crp"], habit: "Waist size", target: "Under 90 cm for men, 80 cm for women" },
    { keys: ["hba1c", "glucose", "crp"], habit: "Sleep", target: "7+ hours" },
    { keys: ["uric", "creatinine"], habit: "Water", target: "2.5–3 litres a day" }
  ];

  // close to the edge of the healthy range (inside it)
  function near(t) {
    const c = R.CATALOG[t.key], lo = t.low ?? c.low, hi = t.high ?? c.high, v = t.value;
    if (t.status !== "ok") return false;
    const span = (hi ?? lo * 2) - (lo || 0);
    if (c.dir !== "low" && hi != null && v >= hi - span * 0.1) return true;
    if (c.dir !== "high" && lo && v <= lo + span * 0.1) return true;
    return false;
  }
  // how far outside the range, as a fraction of the limit (for ordering)
  // weights: small changes matter more for some results (HbA1c), less for one-off ones (hs-CRP)
  const WEIGHT = { vitd: 1.5, b12: 1.5, hba1c: 6, glucose: 3, crp: 0.3, esr: 0.3, tsh: 2, egfr: 3, creatinine: 2, hb: 3 };
  function severity(t) {
    const c = R.CATALOG[t.key], lo = t.low ?? c.low, hi = t.high ?? c.high, v = t.value, w = WEIGHT[t.key] || 1;
    if (t.status === "low") return w * (lo - v) / lo;
    if (t.status === "high") return w * (v - hi) / hi;
    return 0;
  }
  function label(t) {
    const v = t.value;
    if (t.key === "vitd" && t.status === "low") return v < 10 ? "Severe deficiency" : v < 20 ? "Deficient" : "Insufficient";
    if (t.key === "hba1c" && t.status === "high") return v >= 6.5 ? "Diabetes range" : "Prediabetes";
    if (t.key === "crp" && t.status === "high") return v > 10 ? "Very high" : "High heart-risk band";
    return t.status === "low" ? "Below range" : t.status === "high" ? "Above range" : "Close to the limit";
  }
  const uniq = a => [...new Set(a)];

  // ---------- The big picture: group out-of-range results by root cause ----------
  const ROOTS = [
    { id: "a", cls: "ra", title: "Low sunlight and nutrient gaps", sub: "Little direct sun, few animal foods, poor absorption",
      keys: ["vitd", "calcium", "phosphorus", "b12", "hb", "iron", "ferritin"],
      leads: [{ keys: ["vitd", "calcium", "phosphorus"], text: "Weak bones, aches, fatigue" }, { keys: ["b12"], text: "Tingling, low energy, poor focus" }, { keys: ["hb", "iron", "ferritin"], text: "Tiredness, breathlessness" }] },
    { id: "b", cls: "rb", title: "Insulin resistance", sub: "Belly fat, refined carbs and sugar, sitting a lot, poor sleep",
      keys: ["hba1c", "glucose", "tg", "hdl", "ldl", "chol", "alt", "ggt", "ast", "crp", "esr", "uric"],
      leads: [{ keys: ["hba1c", "glucose"], text: "Type 2 diabetes later" }, { keys: ["tg", "hdl", "ldl", "chol", "crp", "esr"], text: "Higher heart risk" }, { keys: ["alt", "ggt", "ast"], text: "Fatty liver" }, { keys: ["uric"], text: "Gout, kidney stones" }] },
    { id: "c", cls: "rc", title: "Needs a doctor's check", sub: "These have causes the app can't work on by itself",
      keys: ["tsh", "egfr", "creatinine"], leads: [{ keys: ["tsh", "egfr", "creatinine"], text: "Discuss with your doctor" }] }
  ];
  const SHORTN = { vitd: "Vitamin D", b12: "B12", hba1c: "HbA1c", glucose: "Fasting sugar", chol: "Cholesterol", hdl: "HDL", ldl: "LDL", tg: "Triglycerides", alt: "ALT", ast: "AST", ggt: "GGT", crp: "hs-CRP", esr: "ESR", calcium: "Calcium", phosphorus: "Phosphorus", tsh: "TSH", creatinine: "Creatinine", egfr: "eGFR", uric: "Uric acid", hb: "Haemoglobin", iron: "Iron", ferritin: "Ferritin" };
  function bigPicture(bad) {
    if (bad.length < 2) return "";
    const has = k => bad.find(t => t.key === k);
    const groups = ROOTS.map(r => ({ r, items: bad.filter(t => r.keys.includes(t.key)) })).filter(g => g.items.length);
    if (!groups.length) return "";
    const n = groups.filter(g => g.r.id !== "c").length;
    const link = has("vitd") && (has("crp") || has("esr")) ? `<p class="bp-link"><span aria-hidden="true">↔</span> Low vitamin D can also add to inflammation, so fixing it may help your ${has("crp") ? "hs-CRP" : "ESR"} too.</p>` : "";
    return `<div class="card bp"><span class="eyebrow">The big picture</span>
      <h3 style="margin:4px 0 6px">${n > 1 ? `${n} root causes explain almost everything` : n === 1 ? "One root cause explains most of this" : "What to take to your doctor"}</h3>
      <p class="note">Your ${bad.length} out-of-range results aren't ${bad.length} separate problems. ${n ? "They trace back to " + (n > 1 ? "a few roots" : "one root") + ". Fix the root and most numbers move together." : ""}</p>
      ${groups.map(({ r, items }) => {
        const leads = r.leads.filter(l => l.keys.some(k => items.some(t => t.key === k)));
        return `<div class="bp-g ${r.cls}">
          <div class="bp-root"><b>${esc(r.title)}</b><span>${esc(r.sub)}</span></div>
          <div class="bp-arrow" aria-hidden="true"></div>
          <div class="bp-items">${items.map(t => `<span class="bp-chip">${esc(SHORTN[t.key] || R.CATALOG[t.key].name)} <b>${t.value}</b> ${t.status === "low" ? "↓" : "↑"}</span>`).join("")}</div>
          <div class="bp-arrow" aria-hidden="true"></div>
          <div class="bp-leads"><span class="eyebrow">Can lead to</span>${leads.map(l => `<span class="bp-lead">${esc(l.text)}</span>`).join("")}</div>
        </div>`;
      }).join("")}
      ${link}
    </div>`;
  }

  function build(report, all) {
    const upto = all.filter(r => r.date <= report.date && (r.date < report.date || r.id === report.id));
    const L = R.latest(upto);
    const own = new Set((report.tests || []).map(t => t.key));
    const rows = Object.entries(L).filter(([k]) => own.has(k)).map(([k, t]) => ({ ...t, key: k }));
    const bad = rows.filter(t => t.status === "low" || t.status === "high").sort((a, b) => severity(b) - severity(a));
    const close = rows.filter(t => near(t));
    const ok = rows.filter(t => t.status === "ok" && !near(t));
    return { L, rows, bad, close, ok };
  }

  function rangeText(t) {
    const c = R.CATALOG[t.key], lo = t.low ?? c.low, hi = t.high ?? c.high;
    if (c.dir === "high" || !lo) return `under ${hi}`;
    if (c.dir === "low" || hi == null) return `${lo}+`;
    return `${lo}–${hi}`;
  }
  function trendText(t) {
    if (!t.prev) return "";
    const c = R.CATALOG[t.key], d = t.value - t.prev.value;
    if (Math.abs(d) < 1e-9) return `Same as ${fmtDate(t.prev.date)}.`;
    const good = c.dir === "low" ? d > 0 : c.dir === "high" ? d < 0 : null;
    return `${d > 0 ? "Up" : "Down"} from ${t.prev.value} on ${fmtDate(t.prev.date)}${good == null ? "" : good ? ", improving" : ", getting worse"}.`;
  }

  function html(report, all, barFn) {
    const { bad, close, ok } = build(report, all);
    const above = bad.filter(t => t.status === "high").length, below = bad.filter(t => t.status === "low").length;
    const plan = R.plan(all.filter(r => r.date <= report.date));
    const eat = uniq(bad.flatMap(t => (INFO[t.key] || {}).eat || [])).slice(0, 10);
    const avoid = uniq(bad.flatMap(t => (INFO[t.key] || {}).avoid || [])).slice(0, 8);
    const tests = uniq(bad.flatMap(t => (INFO[t.key] || {}).tests || []));
    const habits = HABITS.filter(h => h.keys.some(k => bad.some(t => t.key === k)));
    const card = (t, short) => {
      const c = R.CATALOG[t.key], info = INFO[t.key] || {};
      return `<div class="mcard st-${t.status === "ok" ? "near" : t.status}">
        <div class="mtop"><span class="nm">${esc(c.name)}<span class="pill2">${t.status === "ok" ? "near" : t.status}</span></span><span class="mval"><b>${t.value}</b> ${esc(t.unit || c.unit)}</span></div>
        ${barFn(t)}
        <span class="note"><b>${esc(label(t))}</b>${t.prev ? " · " + esc(trendText(t)) : ""}</span>
        ${short ? `<p class="note">${esc(c.about)}</p>` : `<div class="sx">
          <div><b>What it means</b><p>${esc(c.about)}</p></div>
          <div><b>Why it happens</b><p>${esc(info.why || "")}</p></div>
          <div><b>What it can lead to</b><p>${esc(info.risk || "")}</p></div>
          <div><b>What helps</b><p>${esc(info.act || "")}</p></div></div>`}
      </div>`;
    };
    return `
      <div class="shead"><div><span class="eyebrow">Report summary</span><h2 id="sheetTitle">${esc(fmtDate(report.date))}${report.lab ? " · " + esc(report.lab) : ""}</h2></div><button class="btn" type="button" data-x="close">Done</button></div>
      ${report.sample ? `<p class="testmode">This summary is built from sample results.</p>` : ""}
      <div class="hsum" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <div class="stat"><b style="color:#c4352b">${above}</b><span>above range</span></div>
        <div class="stat"><b style="color:var(--sky)">${below}</b><span>below range</span></div>
        <div class="stat"><b style="color:var(--sun)">${close.length}</b><span>near the limit</span></div>
        <div class="stat"><b style="color:var(--done)">${ok.length}</b><span>normal</span></div>
      </div>
      ${bad.length ? `<div class="card"><span class="eyebrow">If you read only one thing</span><h3 style="margin:4px 0 8px">What to fix, in order</h3>
        <ol class="prio">${bad.slice(0, 5).map(t => `<li><b>${esc(R.CATALOG[t.key].name)} is ${t.status} (${t.value}, healthy ${esc(rangeText(t))}).</b> ${esc((INFO[t.key] || {}).act || "")}</li>`).join("")}</ol></div>`
        : `<div class="cheer">Everything the app tracks in this report is in range.</div>`}
      ${bigPicture(bad)}
      ${plan.notes.map(n => `<div class="notice"><span><b>${esc(R.CATALOG[n.key].name)}:</b> ${esc(n.text)}</span></div>`).join("")}
      ${bad.length ? `<div class="sect"><span class="eyebrow">Out of range</span>${bad.map(t => card(t, false)).join("")}</div>` : ""}
      ${close.length ? `<div class="sect"><span class="eyebrow">In range but close to the limit</span>${close.map(t => card(t, true)).join("")}</div>` : ""}
      ${eat.length || avoid.length ? `<div class="cols2">
        ${eat.length ? `<div class="card"><h3 style="color:var(--done);margin-bottom:6px">Eat more</h3><ul class="clean">${eat.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
        ${avoid.length ? `<div class="card"><h3 style="color:#c4352b;margin-bottom:6px">Cut down</h3><ul class="clean">${avoid.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}</div>` : ""}
      ${habits.length ? `<div class="card"><h3 style="margin-bottom:6px">Daily habits that help</h3><table><thead><tr><th>Habit</th><th>Target</th></tr></thead><tbody>${habits.map(h => `<tr><td style="color:var(--ink)">${esc(h.habit)}</td><td>${esc(h.target)}</td></tr>`).join("")}</tbody></table>
        <p class="note" style="margin-top:8px">Your Today list already builds these up gradually.</p></div>` : ""}
      ${retestHTML(R.retest(all.filter(r => r.date <= report.date), report.date), report.date)}
      ${tests.length ? `<div class="card"><h3 style="margin-bottom:6px">Tests to ask your doctor about</h3><ul class="clean">${tests.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>` : ""}
      ${ok.length ? `<div class="card"><h3 style="margin-bottom:8px">Comfortably normal</h3><div class="chips">${ok.map(t => `<span>${esc(R.CATALOG[t.key].name)} ${t.value}</span>`).join("")}</div></div>` : ""}
      <p class="note">Medicines and doses are your doctor's decision. This summary explains your numbers in plain language and doesn't diagnose anything.</p>
      <div class="sfoot"><button class="btn primary" type="button" data-x="close">Done</button></div>`;
  }

  // "When to test again" block, used by the Health tab and the summary.
  function retestHTML(rt, today, id) {
    if (!rt) return "";
    const nm = k => R.CATALOG[k].name;
    const row = i => `<div class="ntrow"><div class="top"><span>${esc(nm(i.key))}</span><span>${i.due < today ? "overdue since " : "around "}${esc(fmtDate(i.due))}</span></div>
      <span>${esc(i.text)}</span><a href="${esc(i.src.url)}" target="_blank" rel="noopener">Source: ${esc(i.src.name)}</a></div>`;
    const head = rt.routine ? `<div class="big">Around ${esc(fmtDate(rt.due))}</div><p class="note">Everything the app tracks is in range or has stayed normal on repeat tests. A yearly check-up is common practice.</p>`
      : rt.due ? `<div class="big">${rt.overdue ? "Overdue since " : "Around "}${esc(fmtDate(rt.due))}</div><p class="note">${rt.together.length > 1 ? "Repeat these together in one blood draw." : "The next test due."}</p>` : "";
    return `<div class="card nexttest"${id ? ` id="${id}"` : ""}><span class="eyebrow">When to test again</span>${head}
      ${rt.together.length ? `<div>${rt.together.map(row).join("")}</div>` : ""}
      ${rt.later.length ? `<span class="eyebrow">Later</span><div>${rt.later.map(row).join("")}</div>` : ""}
      ${rt.doctor.map(d => `<div class="ntrow"><div class="top"><span>${esc(nm(d.key))}</span><span>doctor's schedule</span></div><span>${esc(d.text)}</span><a href="${esc(d.src.url)}" target="_blank" rel="noopener">Source: ${esc(d.src.name)}</a></div>`).join("")}
      <p class="note">Or as your doctor advises: their instructions come first. Intervals were checked against the linked sources in November 2026.</p></div>`;
  }

  window.ReportSummary = { html, build, retestHTML };
})();
