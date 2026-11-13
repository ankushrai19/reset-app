// Results catalog and the fixed rules that turn report results into habits.
// The AI (Stage 2) only extracts numbers; everything here is deterministic.
(function () {
  // dir: which side of the range is a problem. "both" | "low" | "high"
  const CATALOG = {
    vitd:      { name: "Vitamin D", unit: "ng/mL", low: 30, high: 100, dir: "low", aka: ["vitamin d", "25-oh", "25 oh", "25-hydroxy", "cholecalciferol"], about: "Helps you absorb calcium for strong bones, and supports muscles and immunity. Made by your skin in sunlight." },
    b12:       { name: "Vitamin B12", unit: "pg/mL", low: 197, high: 771, dir: "low", aka: ["b12", "b-12", "cobalamin"], about: "Keeps nerves and red blood cells healthy. Found only in animal foods: eggs, dairy, fish, meat." },
    hba1c:     { name: "HbA1c", unit: "%", low: 4, high: 5.7, dir: "high", aka: ["hba1c", "glycated", "glycosylated"], about: "Your average blood sugar over the last 3 months. 5.7 to 6.4 is prediabetes; 6.5 and above is diabetes." },
    glucose:   { name: "Fasting glucose", unit: "mg/dL", low: 70, high: 100, dir: "high", aka: ["fasting blood sugar", "fasting glucose", "glucose fasting", "fbs"], about: "Blood sugar after not eating overnight." },
    chol:      { name: "Total cholesterol", unit: "mg/dL", low: 0, high: 200, dir: "high", aka: ["total cholesterol", "cholesterol total", "cholesterol - total"], about: "All the cholesterol in your blood. The balance between HDL and LDL matters more than the total." },
    hdl:       { name: "HDL (good) cholesterol", unit: "mg/dL", low: 40, high: 60, dir: "low", aka: ["hdl"], about: "The clean-up cholesterol that carries fat away from arteries. Higher is better." },
    ldl:       { name: "LDL (bad) cholesterol", unit: "mg/dL", low: 0, high: 100, dir: "high", aka: ["ldl"], about: "The cholesterol that builds up in artery walls. Lower is better." },
    tg:        { name: "Triglycerides", unit: "mg/dL", low: 0, high: 150, dir: "high", aka: ["triglyceride"], about: "Fat your body makes from extra sugar, refined carbs and alcohol." },
    alt:       { name: "ALT / SGPT (liver)", unit: "U/L", low: 0, high: 45, dir: "high", aka: ["alt", "sgpt", "alanine"], about: "A liver enzyme. When high, the liver is under stress, most often from fatty liver or alcohol." },
    ast:       { name: "AST / SGOT (liver)", unit: "U/L", low: 0, high: 35, dir: "high", aka: ["ast", "sgot", "aspartate"], about: "Another liver enzyme; also rises after hard exercise." },
    ggt:       { name: "GGT (liver)", unit: "U/L", low: 0, high: 55, dir: "high", aka: ["ggt", "gamma"], about: "A liver enzyme that is especially sensitive to alcohol." },
    crp:       { name: "hs-CRP (inflammation)", unit: "mg/L", low: 0, high: 3, dir: "high", aka: ["crp", "c-reactive", "c reactive"], about: "Rises with inflammation anywhere in the body, including a recent cold or infection." },
    esr:       { name: "ESR (inflammation)", unit: "mm/hr", low: 0, high: 15, dir: "high", aka: ["esr", "sedimentation"], about: "A general inflammation test." },
    calcium:   { name: "Calcium", unit: "mg/dL", low: 8.8, high: 10.6, dir: "both", aka: ["calcium"], about: "For bones, muscles and nerves. Low calcium often follows low vitamin D." },
    phosphorus:{ name: "Phosphorus", unit: "mg/dL", low: 2.5, high: 4.5, dir: "both", aka: ["phosphorus", "phosphate"], about: "Works with calcium to build bone." },
    tsh:       { name: "TSH (thyroid)", unit: "µIU/mL", low: 0.54, high: 5.3, dir: "both", aka: ["tsh", "thyroid stimulating"], about: "Shows how hard the body is pushing the thyroid. Out of range needs a doctor's review." },
    creatinine:{ name: "Creatinine (kidney)", unit: "mg/dL", low: 0.7, high: 1.2, dir: "high", aka: ["creatinine"], about: "A waste product filtered by the kidneys." },
    egfr:      { name: "eGFR (kidney filtering)", unit: "mL/min", low: 90, high: 200, dir: "low", aka: ["egfr", "glomerular"], about: "How well your kidneys filter blood. 90 and above is normal." },
    uric:      { name: "Uric acid", unit: "mg/dL", low: 3.5, high: 7.2, dir: "high", aka: ["uric"], about: "High levels can cause gout and kidney stones." },
    hb:        { name: "Haemoglobin", unit: "g/dL", low: 13, high: 17, dir: "low", aka: ["haemoglobin", "hemoglobin", "hb"], about: "Carries oxygen in red blood cells. Low means anaemia." },
    iron:      { name: "Iron", unit: "µg/dL", low: 65, high: 175, dir: "low", aka: ["iron", "serum iron"], about: "Needed to make haemoglobin." },
    ferritin:  { name: "Ferritin (iron stores)", unit: "ng/mL", low: 30, high: 400, dir: "low", aka: ["ferritin"], about: "Your body's iron reserve." }
  };

  // Habits a result can add (beyond the base 12-week plan). from/to are day numbers.
  const EXTRA = {
    b12food:  { id: "b12food", at: "13:00", t: "B12 food at lunch: eggs, curd, paneer or fish", w: "", from: 1 },
    noalcohol:{ id: "noalcohol", at: "20:00", t: "No alcohol today", w: "", from: 1, to: 21 },
    calcium:  { id: "calcium", at: "20:15", t: "Calcium at dinner: curd, milk, ragi or paneer", w: "", from: 8 },
    ironfood: { id: "ironfood", at: "13:00", t: "Iron food with vitamin C: dal or greens with lemon or amla", w: "", from: 8 }
  };

  // What each problem result changes. tags: personal reason added to existing habits (by habit id).
  // add: extra habits switched on. note: shown on the Health tab only.
  const RULES = {
    vitd: { low: { tags: { sun: "Vitamin D was {v} (healthy {lo}+). Midday sun helps your skin make it.", meds: "Vitamin D was {v}. Take it with a meal that has some fat." } } },
    b12: { low: { tags: { meds: "B12 was {v} (healthy {lo}+)." }, add: ["b12food"] } },
    hba1c: { high: { tags: { walk: "HbA1c was {v}% (healthy under {hi}). Walking after meals lowers it.", chai: "HbA1c was {v}%. Less sugar is the quickest win.", plate: "HbA1c was {v}%. Vegetables first slows the sugar rise.", millet: "HbA1c was {v}%. Millets raise sugar more slowly than maida or rice.", nofried: "HbA1c was {v}%." } } },
    glucose: { high: { tags: { walk: "Fasting sugar was {v} (healthy under {hi}).", chai: "Fasting sugar was {v}." } } },
    hdl: { low: { tags: { walk: "HDL was {v} (healthy {lo}+). Regular walking raises it.", nuts: "HDL was {v}. Nuts and good fats raise it.", strength: "HDL was {v}. Exercise raises it." } } },
    tg: { high: { tags: { nofried: "Triglycerides were {v} (healthy under {hi}).", chai: "Triglycerides were {v}. Sugar turns into this fat.", dinner: "Triglycerides were {v}. Late meals and alcohol raise them." } } },
    ldl: { high: { tags: { nofried: "LDL was {v} (healthy under {hi}). Fried food raises it." } } },
    chol: { high: { tags: { nofried: "Total cholesterol was {v}." } } },
    alt: { high: { tags: { dinner: "ALT (liver) was {v} (healthy under {hi}). An early dinner and no alcohol rest the liver." }, add: ["noalcohol"] } },
    ggt: { high: { tags: { dinner: "GGT (liver) was {v}." }, add: ["noalcohol"] } },
    ast: { high: { add: ["noalcohol"] } },
    calcium: { low: { tags: { sun: "Calcium was {v} (healthy {lo}+). Vitamin D from sun helps you absorb it." }, add: ["calcium"] } },
    phosphorus: { low: { add: ["calcium"] } },
    hb: { low: { add: ["ironfood"] } },
    iron: { low: { add: ["ironfood"] } },
    ferritin: { low: { add: ["ironfood"] } },
    uric: { high: { tags: { water: "Uric acid was {v}. Plenty of water helps clear it." } } },
    crp: { high: { note: "Repeat this test in 2 to 4 weeks, when you have no cold or infection. One high reading can be temporary." } },
    esr: { high: { note: "Repeat with hs-CRP in 2 to 4 weeks." } },
    tsh: { low: { note: "Thyroid out of range: please see your doctor." }, high: { note: "Thyroid out of range: please see your doctor." } },
    egfr: { low: { note: "Kidney filtering is reduced: please see your doctor before starting supplements." } },
    creatinine: { high: { note: "Please see your doctor about kidney function." } }
  };

  // Habits that only make sense when a matching result is out of range.
  // A habit is removed only if at least one of its markers was tested and none is out of range.
  // Habits not listed here (water, walk, sleep, protein, plate, strength, screens, weigh-in) are core: always kept.
  const NEED = {
    sun: ["vitd", "calcium", "phosphorus"],
    meds: ["vitd", "b12", "calcium", "phosphorus", "iron", "hb", "ferritin"],
    chai: ["hba1c", "glucose", "tg"],
    millet: ["hba1c", "glucose", "tg"],
    nuts: ["hdl", "ldl", "chol", "tg"],
    nofried: ["ldl", "chol", "tg", "hdl", "alt", "hba1c", "crp"],
    dinner: ["alt", "ggt", "tg", "hba1c", "glucose"]
  };

  const norm = s => String(s || "").toLowerCase();
  function keyFor(name) {
    const n = norm(name);
    // exact-ish matches first, so "hdl / ldl ratio" doesn't count as HDL
    if (/\bratio\b/.test(n)) return null;
    const hit = a => a.length <= 4 ? new RegExp("(^|[^a-z0-9])" + a.replace(/[-]/g, "\\-") + "([^a-z0-9]|$)").test(n) : n.includes(a);
    for (const [k, c] of Object.entries(CATALOG)) if (c.aka.some(hit)) return k;
    return null;
  }

  // status of one test row: uses the lab's own range when present, else the catalog's
  function status(t) {
    const c = CATALOG[t.key] || {};
    const lo = t.low ?? c.low, hi = t.high ?? c.high, v = Number(t.value);
    if (!isFinite(v)) return "unknown";
    const dir = c.dir || "both";
    if (lo != null && v < lo && dir !== "high") return "low";
    if (hi != null && v > hi && dir !== "low") return "high";
    if (t.key === "hba1c" && v >= (hi ?? 5.7)) return "high";
    return "ok";
  }

  // latest value per marker (reports sorted by date), plus the one before it for trends
  function latest(reports) {
    const out = {};
    const sorted = [...(reports || [])].sort((a, b) => (a.date < b.date ? -1 : 1));
    for (const r of sorted) for (const t of r.tests || []) {
      if (!t.key) continue;
      out[t.key] = { ...t, date: r.date, prev: out[t.key] ? { value: out[t.key].value, date: out[t.key].date } : null };
    }
    for (const t of Object.values(out)) t.status = status(t);
    return out;
  }

  const fill = (s, t) => s.replace("{v}", t.value).replace("{lo}", t.low ?? CATALOG[t.key].low).replace("{hi}", t.high ?? CATALOG[t.key].high);

  // What the current results ask for: personal reasons per habit id, extra habits, notes.
  function plan(reports) {
    const L = latest(reports), tags = {}, adds = {}, notes = [];
    for (const [k, t] of Object.entries(L)) {
      const r = RULES[k] && RULES[k][t.status];
      if (!r) continue;
      for (const [hid, msg] of Object.entries(r.tags || {})) if (!tags[hid]) tags[hid] = { text: fill(msg, t), key: k };
      for (const id of r.add || []) if (!adds[id]) adds[id] = { ...EXTRA[id], because: k };
      if (r.note) notes.push({ key: k, text: r.note });
    }
    return { tags, adds, notes, latest: L };
  }

  function isNeeded(id, L) {
    const need = NEED[id];
    if (!need) return true;
    const tested = need.filter(k => L[k]);
    if (!tested.length) return true;
    return tested.some(k => L[k].status === "low" || L[k].status === "high");
  }

  // Apply the plan to one day's habit list.
  function apply(list, dayN, wd, reports) {
    if (!reports || !reports.length) return list;
    const p = plan(reports);
    list = list.filter(h => isNeeded(h.id, p.latest));
    const out = list.map(h => p.tags[h.id] ? { ...h, pw: p.tags[h.id].text, pk: p.tags[h.id].key } : h);
    const have = new Set(out.map(h => h.id));
    for (const x of Object.values(p.adds)) {
      if (have.has(x.id) || dayN < x.from || (x.to && dayN > x.to)) continue;
      const t = p.latest[x.because];
      out.push({ ...x, pw: `${CATALOG[x.because].name} was ${t.value}${t.unit ? " " + t.unit : ""}.`, pk: x.because, extra: true });
    }
    return out;
  }

  // Which habits a marker affects (for the Health tab)
  function effects(key, st) {
    const r = RULES[key] && RULES[key][st];
    if (!r) return { habits: [], adds: [], note: null };
    return { habits: Object.keys(r.tags || {}), adds: (r.add || []).map(id => EXTRA[id]), note: r.note || null };
  }

  // A whole phase, personalised (all weekdays), plus what was removed and why.
  function phasePlan(phase, reports) {
    if (!reports || !reports.length) return { list: phase.habits, removed: [] };
    const p = plan(reports), removed = [];
    const kept = phase.habits.filter(h => { const ok = isNeeded(h.id, p.latest); if (!ok) removed.push(h); return ok; })
      .map(h => p.tags[h.id] ? { ...h, pw: p.tags[h.id].text, pk: p.tags[h.id].key } : h);
    const have = new Set(kept.map(h => h.id));
    for (const x of Object.values(p.adds)) {
      if (have.has(x.id) || x.from > phase.to || (x.to && x.to < phase.from)) continue;
      kept.push({ ...x, pk: x.because, extra: true, fromDay: x.from > phase.from ? x.from : null, toDay: x.to && x.to < phase.to ? x.to : null });
    }
    return { list: kept, removed };
  }
  function removedReason(id, L) {
    const tested = (NEED[id] || []).filter(k => L[k]);
    return tested.map(k => CATALOG[k].name).join(", ");
  }

  window.ResetRules = { CATALOG, EXTRA, RULES, NEED, keyFor, status, latest, plan, apply, effects, phasePlan, removedReason };
})();
