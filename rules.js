// Results catalog and the fixed rules that turn report results into habits.
// The AI (Stage 2) only extracts numbers; everything here is deterministic.
(function () {
  // Sex from the profile ("f" / "m" / null). Only used where a lab report gives no range of its own.
  // Women: HDL low under 50 mg/dL (MSD Manual, metabolic syndrome), haemoglobin low under 12 g/dL (WHO). Men or not set: 40 and 13.
  let SEX = null;
  const setSex = s => { SEX = s === "f" || s === "m" ? s : null; };

  // dir: which side of the range is a problem. "both" | "low" | "high"
  const CATALOG = {
    vitd:      { name: "Vitamin D", unit: "ng/mL", low: 30, high: 100, dir: "low", aka: ["vitamin d", "25-oh", "25 oh", "25-hydroxy", "cholecalciferol"], about: "Helps you absorb calcium for strong bones, and supports muscles and immunity. Made by your skin in sunlight." },
    b12:       { name: "Vitamin B12", unit: "pg/mL", low: 197, high: 771, dir: "low", aka: ["b12", "b-12", "cobalamin"], about: "Keeps nerves and red blood cells healthy. Found mainly in animal foods: eggs, dairy, fish, meat." },
    hba1c:     { name: "HbA1c", unit: "%", low: 4, high: 5.7, dir: "high", aka: ["hba1c", "hb a1c", "a1c", "glycated", "glycosylated"], about: "Your average blood sugar over the last 3 months. 5.7 to 6.4 is prediabetes; 6.5 and above is diabetes." },
    glucose:   { name: "Fasting glucose", unit: "mg/dL", low: 70, high: 100, dir: "high", aka: ["fasting blood sugar", "fasting glucose", "glucose fasting", "fbs"], about: "Blood sugar after not eating overnight." },
    chol:      { name: "Total cholesterol", unit: "mg/dL", low: 0, high: 200, dir: "high", aka: ["total cholesterol", "cholesterol total", "cholesterol - total"], about: "All the cholesterol in your blood. The balance between HDL and LDL matters more than the total." },
    hdl:       { name: "HDL (good) cholesterol", unit: "mg/dL", get low() { return SEX === "f" ? 50 : 40; }, high: 60, dir: "low", aka: ["hdl"], about: "The clean-up cholesterol that carries fat away from arteries. Higher is better." },
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
    hb:        { name: "Haemoglobin", unit: "g/dL", get low() { return SEX === "f" ? 12 : 13; }, high: 17, dir: "low", aka: ["haemoglobin", "hemoglobin", "hb"], about: "Carries oxygen in red blood cells. Low means anaemia." },
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

  // Lower-case, punctuation to spaces, so "Cholesterol, Total" and "Glucose - Fasting" match too.
  const clean = s => String(s || "").toLowerCase().replace(/[^a-z0-9µ]+/g, " ").trim();
  // Tests that share a word with a tracked marker but are different tests (different ranges).
  const NOT_TRACKED = /\b(ratio|mch|mchc|mean corpuscular|corp|non hdl|vldl|tibc|uibc|binding|saturation|ioni[sz]ed|urine|urinary|clearance|dihydroxy|holo|microalbumin)\b/;
  function match(n) {
    const hit = a => { a = clean(a); return a.length <= 4 ? (" " + n + " ").includes(" " + a + " ") : n.includes(a); };
    for (const [k, c] of Object.entries(CATALOG)) if (c.aka.some(hit)) return k;
    return null;
  }
  function keyFor(name) {
    const raw = String(name || ""), n = clean(raw);
    if (!n || NOT_TRACKED.test(n)) return null;
    // "SGPT/ALT" is one test; "AST/ALT" or "Microalbumin/Creatinine" compares two tests
    if (raw.includes("/")) {
      const ks = [...new Set(raw.split("/").map(x => match(clean(x))).filter(Boolean))];
      if (ks.length > 1) return null;
    }
    return match(n);
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

  // latest value per marker (reports sorted by date), the one before it for trends,
  // and where the marker stands over time:
  //   phase "active"   = out of range now
  //   phase "maintain" = first normal result after being out of range (keep a lighter habit)
  //   phase "resolved" = normal on the last two tests after being out of range (habit can go)
  //   phase "never"    = never out of range in any report
  function latest(reports) {
    const out = {};
    const sorted = [...(reports || [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    for (const r of sorted) { const seen = new Set(); for (const t of r.tests || []) {
      // one value per test per report: if a report lists a test twice, the first one counts
      if (!t.key || seen.has(t.key)) continue;
      seen.add(t.key);
      const prevT = out[t.key];
      const hist = prevT ? prevT.hist : [];
      const cur = { ...t, date: r.date, reportId: r.id, prev: prevT ? { value: prevT.value, date: prevT.date } : null };
      cur.status = status(cur);
      cur.hist = [...hist, { date: r.date, value: cur.value, status: cur.status }];
      out[t.key] = cur;
    } }
    for (const t of Object.values(out)) {
      const h = t.hist, bad = x => x.status === "low" || x.status === "high";
      const lastBad = [...h].reverse().find(bad);
      t.wasStatus = lastBad ? lastBad.status : null;
      if (bad(t)) t.phase = "active";
      else if (!lastBad) t.phase = "never";
      else {
        let okRun = 0; for (let i = h.length - 1; i >= 0 && !bad(h[i]); i--) okRun++;
        t.phase = okRun >= 2 ? "resolved" : "maintain";
      }
    }
    return out;
  }

  const fill = (s, t) => s.replace("{v}", t.value).replace("{lo}", t.low ?? CATALOG[t.key].low).replace("{hi}", t.high ?? CATALOG[t.key].high);

  // Lighter versions used while a result is back in range but not yet confirmed by a second test.
  const MAINT = {
    sun: { t: "Midday sun, 3 days a week", days: [1, 3, 5] },
    meds: { t: "Maintenance dose as prescribed (ask your doctor)" },
    b12food: { t: "B12 food at lunch, 3 days a week", days: [1, 3, 5] }
  };

  // What the current results ask for: personal reasons per habit id, extra habits, notes.
  function plan(reports) {
    const L = latest(reports), tags = {}, adds = {}, notes = [];
    // active results first, so their reasons win over maintenance ones
    const order = Object.entries(L).sort((a, b) => (a[1].phase === "active" ? 0 : 1) - (b[1].phase === "active" ? 0 : 1));
    for (const [k, t] of order) {
      if (t.phase === "active") {
        const r = RULES[k] && RULES[k][t.status];
        if (!r) continue;
        for (const [hid, msg] of Object.entries(r.tags || {})) if (!tags[hid]) tags[hid] = { text: fill(msg, t), key: k };
        for (const id of r.add || []) if (!adds[id]) adds[id] = { ...EXTRA[id], because: k };
        if (r.note) notes.push({ key: k, text: r.note });
      } else if (t.phase === "maintain") {
        const r = RULES[k] && RULES[k][t.wasStatus];
        if (!r) continue;
        const msg = `${CATALOG[k].name} is back in range (${t.value}). Keep a lighter version until one more test confirms it.`;
        for (const hid of Object.keys(r.tags || {})) if (!tags[hid]) tags[hid] = { text: msg, key: k, maint: true };
        for (const id of r.add || []) if (!adds[id]) adds[id] = { ...EXTRA[id], because: k, maint: true };
      }
    }
    return { tags, adds, notes, latest: L };
  }

  const live = t => t && (t.phase === "active" || t.phase === "maintain");
  function isNeeded(id, L) {
    const need = NEED[id];
    if (!need) return true;
    const tested = need.filter(k => L[k]);
    if (!tested.length) return true;
    return tested.some(k => live(L[k]));
  }
  // true when a conditional habit is kept only because of results in maintenance
  function maintOnly(id, L) {
    const need = NEED[id];
    if (!need) return false;
    const tested = need.filter(k => L[k]);
    return tested.length > 0 && !tested.some(k => L[k].phase === "active") && tested.some(k => L[k].phase === "maintain");
  }
  // maint: kept because a result is back in range but not yet confirmed; lite: a lighter version exists
  const lighten = h => MAINT[h.id] ? { ...h, ...MAINT[h.id], maint: true, lite: true, w: "" } : { ...h, maint: true, lite: false };

  function personalise(list, p) {
    return list.filter(h => isNeeded(h.id, p.latest)).map(h => {
      let x = maintOnly(h.id, p.latest) ? lighten(h) : h;
      if (p.tags[h.id]) x = { ...x, pw: p.tags[h.id].text, pk: p.tags[h.id].key };
      return x;
    });
  }
  function extraItem(x, p) {
    const t = p.latest[x.because];
    let item = { ...x, pk: x.because, extra: true, pw: x.maint ? `${CATALOG[x.because].name} is back in range (${t.value}). Keep a lighter version until one more test confirms it.` : `${CATALOG[x.because].name} was ${t.value}${t.unit ? " " + t.unit : ""}.` };
    if (x.maint) item = { ...lighten(item), pw: item.pw };
    return item;
  }

  // With high sugar, week 1 tapers chai sugar to none by day 7 (everyone else: half in week 1, none from day 8).
  const sugarHigh = L => ["hba1c", "glucose"].some(k => L[k] && L[k].phase === "active");
  const TAPER = n => n <= 3 ? "Chai with half the usual sugar" : n <= 6 ? "Chai with a quarter of the usual sugar" : "Chai without sugar";
  const TAPER_PLAN = "Chai sugar: half (days 1–3), a quarter (days 4–6), none from day 7";
  const taperW = "Cutting down over a week is easier to stick with than stopping at once.";

  // Kidney filtering low (eGFR) or creatinine high: protein becomes "as your doctor advises" instead of "more protein".
  const kidneyKey = L => ["egfr", "creatinine"].find(k => L[k] && L[k].phase === "active");
  const KIDNEY = { t: "Protein as your doctor advises", w: "", pw: "Your kidney results need a doctor's review. Don't add protein powders or extra protein without their OK." };
  const kidneySafe = (list, L) => { const k = kidneyKey(L); return k ? list.map(h => h.id === "protein" ? { ...h, ...KIDNEY, pk: k } : h) : list; };

  // Apply the plan to one day's habit list (call before filtering by weekday).
  function apply(list, dayN, wd, reports) {
    if (!reports || !reports.length) return list;
    const p = plan(reports);
    let out = personalise(list, p);
    if (dayN <= 7 && sugarHigh(p.latest)) out = out.map(h => h.id === "chai" ? { ...h, t: TAPER(Math.max(1, dayN)), w: taperW } : h);
    out = kidneySafe(out, p.latest);
    const have = new Set(out.map(h => h.id));
    for (const x of Object.values(p.adds)) {
      if (have.has(x.id) || dayN < x.from || (x.to && dayN > x.to)) continue;
      out.push(extraItem(x, p));
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
    const p = plan(reports), removed = phase.habits.filter(h => !isNeeded(h.id, p.latest));
    let kept = personalise(phase.habits, p);
    if (phase.from === 1 && sugarHigh(p.latest)) kept = kept.map(h => h.id === "chai" ? { ...h, t: TAPER_PLAN, w: taperW } : h);
    kept = kidneySafe(kept, p.latest);
    const have = new Set(kept.map(h => h.id));
    for (const x of Object.values(p.adds)) {
      if (have.has(x.id) || x.from > phase.to || (x.to && x.to < phase.from)) continue;
      kept.push({ ...extraItem(x, p), fromDay: x.from > phase.from ? x.from : null, toDay: x.to && x.to < phase.to ? x.to : null });
    }
    return { list: kept, removed };
  }
  function removedReason(id, L) {
    const tested = (NEED[id] || []).filter(k => L[k]);
    const resolved = tested.filter(k => L[k].phase === "resolved");
    return { names: tested.map(k => CATALOG[k].name).join(", "), resolved: resolved.map(k => CATALOG[k].name) };
  }

  // ---------- When to test again ----------
  // Intervals checked against these sources on 13 Nov 2026. "weeks" drives the due date.
  const SRC = {
    fpin: { name: "American Family Physician (FPIN), 2013", url: "https://www.aafp.org/pubs/afp/issues/2013/0215/od2.html" },
    gpn: { name: "GPnotebook: treatment of B12 deficiency", url: "https://gpnotebook.com/pages/haematology/management/treatment-of-vitamin-b12-deficiency" },
    ahacdc: { name: "AHA/CDC statement on inflammatory markers, 2003 (via Cleveland Clinic J Med)", url: "https://www.ccjm.org/content/ccjom/70/7/634.full.pdf" },
    ada: { name: "American Diabetes Association Standards of Care (via AAFP)", url: "https://www.aafp.org/pubs/afp/issues/2018/0801/p187.html" },
    acc: { name: "ACC/AHA 2018 cholesterol guideline (via AAFP)", url: "https://www.aafp.org/afp/2019/0501/p589.pdf" },
    acg: { name: "ACG guideline: abnormal liver chemistries, 2017", url: "https://pubmed.ncbi.nlm.nih.gov/27995906/" },
    nhsiron: { name: "NHS Highland iron deficiency guideline", url: "https://www.rightdecisions.scot.nhs.uk/tam-treatments-and-medicines-nhs-highland/adult-therapeutic-guidelines/haematology/iron-deficiency-guidelines/" },
    nice: { name: "NICE guideline NG145: thyroid disease", url: "https://www.nice.org.uk/guidance/NG145/chapter/Recommendations" },
    kdigo: { name: "KDIGO 2024 CKD guideline", url: "https://kdigo.org/wp-content/uploads/2026/05/KDIGO-2024-CKD-Guideline-Summary-Recommendations-and-Practice-Points.pdf" }
  };
  const RETEST = {
    vitd: { weeks: 13, text: "Recheck after about 3 months to make sure treatment is working.", src: "fpin" },
    calcium: { weeks: 13, text: "Recheck with vitamin D after about 3 months.", src: "fpin" },
    phosphorus: { weeks: 13, text: "Recheck with vitamin D after about 3 months.", src: "fpin" },
    b12: { weeks: 9, text: "Recheck B12 and a blood count after 2–3 months of treatment.", src: "gpn" },
    crp: { weeks: 2, text: "Repeat in about 2 weeks, when you are well; heart risk is judged on the average of two tests.", src: "ahacdc" },
    esr: { weeks: 2, text: "Repeat with hs-CRP in about 2 weeks.", src: "ahacdc" },
    hba1c: { weeks: 52, text: "In the prediabetes range, test at least once a year.", src: "ada", diabetes: "In the diabetes range, a repeat test is needed to confirm; your doctor will set the schedule." },
    glucose: { weeks: 52, text: "With raised sugar, test at least once a year.", src: "ada" },
    ldl: { weeks: 12, text: "On a statin or after a dose change: 4–12 weeks, then every 3–12 months.", src: "acc" },
    hdl: { weeks: 12, text: "Recheck the lipid profile after about 3 months of changes.", src: "acc" },
    tg: { weeks: 12, text: "Recheck the lipid profile after about 3 months of changes.", src: "acc" },
    chol: { weeks: 12, text: "Recheck the lipid profile after about 3 months of changes.", src: "acc" },
    alt: { weeks: 13, text: "For mild rises, repeat liver tests over 3–6 months.", src: "acg" },
    ast: { weeks: 13, text: "For mild rises, repeat liver tests over 3–6 months.", src: "acg" },
    ggt: { weeks: 13, text: "Repeat with other liver tests over 3–6 months.", src: "acg" },
    hb: { weeks: 4, text: "On iron: a blood count after about 4 weeks to check the response.", src: "nhsiron" },
    iron: { weeks: 4, text: "On iron: a blood count after about 4 weeks to check the response.", src: "nhsiron" },
    ferritin: { weeks: 4, text: "On iron: a blood count after about 4 weeks; treatment usually continues 3 months after anaemia clears.", src: "nhsiron" },
    tsh: { weeks: 13, text: "Repeat after 3 months to confirm; on treatment, every 3 months until stable.", src: "nice" },
    egfr: { weeks: 13, text: "Repeat to confirm; a kidney problem counts as long-term only if it lasts 3 months.", src: "kdigo" },
    creatinine: { weeks: 13, text: "Repeat with eGFR to confirm; long-term only if it lasts 3 months.", src: "kdigo" }
  };
  const addDaysIso = (d, n) => { const [y, m, dd] = d.split("-").map(Number); const x = new Date(y, m - 1, dd + n); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); };

  // Next blood test: items due (each with its own date), the earliest date, and what to repeat together.
  function retest(reports, today) {
    if (!reports || !reports.length) return null;
    const L = latest(reports), items = [], doctor = [];
    for (const [k, t] of Object.entries(L)) {
      if (!live(t) || !RETEST[k]) continue;
      const rt = RETEST[k];
      if (k === "hba1c" && t.value >= 6.5) { doctor.push({ key: k, text: rt.diabetes, src: SRC[rt.src] }); continue; }
      items.push({ key: k, due: addDaysIso(t.date, rt.weeks * 7), from: t.date, text: t.phase === "maintain" ? "Back in range: one more test confirms it. " + rt.text : rt.text, src: SRC[rt.src], phase: t.phase });
    }
    items.sort((a, b) => (a.due < b.due ? -1 : 1));
    if (!items.length) {
      if (doctor.length) return { routine: false, due: null, together: [], later: [], doctor, all: [] };
      const last = [...reports].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
      return { routine: true, due: addDaysIso(last.date, 365), together: [], later: [], doctor, all: [] };
    }
    // repeat everything due within 4 weeks of the first date (or of today, if that date has passed) in one blood draw
    const first = items[0].due, anchor = today && today > first ? today : first, window = addDaysIso(anchor, 28);
    const together = items.filter(i => i.due <= window);
    return { routine: false, due: first, overdue: !!(today && first < today), together, later: items.filter(i => i.due > window), doctor, all: items };
  }

  window.ResetRules = { setSex, CATALOG, EXTRA, RULES, NEED, MAINT, RETEST, SRC, keyFor, status, latest, plan, apply, effects, phasePlan, removedReason, retest, addDaysIso };
})();
