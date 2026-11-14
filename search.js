// Health tab search: "Ask about your results" in everyday words.
// Fixed answers only (no AI): everyday words and common misspellings are matched to tests,
// then filled in with the user's own latest results. Stage 2 may add AI for questions this can't match.
(function () {
  const R = window.ResetRules;
  // keeps Hindi letters; drops the nukta dot so "फ़" and "फ" match
  const clean = s => String(s || "").toLowerCase().replace(/\u093C/g, "").replace(/[^a-z0-9µ\u0900-\u097F]+/g, " ").trim();
  const T = s => (window.I18N ? I18N.t(s) : s);

  // Specific tests, by the words people use. Longer phrases are matched first.
  const MARKER = {
    vitd: ["विटामिन डी", "विटामिन d", "vitamin d", "vitamin d3", "vit d", "d3", "25 oh", "25 hydroxy", "cholecalciferol"],
    b12: ["बी12", "बी 12", "विटामिन बी12", "विटामिन b12", "vitamin b12", "vit b12", "b12", "b 12", "cobalamin"],
    hba1c: ["hba1c", "hb a1c", "a1c", "glycated", "glycosylated", "average sugar"],
    glucose: ["फास्टिंग शुगर", "खाली पेट शुगर", "fasting sugar", "fasting glucose", "fasting blood sugar", "glucose", "fbs"],
    chol: ["total cholesterol", "कुल कोलेस्ट्रॉल"],
    hdl: ["अच्छा कोलेस्ट्रॉल", "hdl", "hdl cholesterol", "good cholesterol"],
    ldl: ["बुरा कोलेस्ट्रॉल", "खराब कोलेस्ट्रॉल", "ldl", "ldl cholesterol", "bad cholesterol"],
    tg: ["ट्राइग्लिसराइड", "ट्राइग्लिसराइड्स", "triglyceride", "triglycerides", "tgs"],
    alt: ["alt", "sgpt"],
    ast: ["ast", "sgot"],
    ggt: ["ggt", "gamma gt"],
    crp: ["crp", "hs crp", "c reactive"],
    esr: ["esr"],
    calcium: ["calcium", "कैल्शियम"],
    phosphorus: ["phosphorus", "phosphate"],
    tsh: ["टीएसएच", "tsh", "thyroid stimulating"],
    creatinine: ["creatinine", "क्रिएटिनिन"],
    egfr: ["egfr", "gfr"],
    uric: ["uric", "uric acid", "यूरिक", "यूरिक एसिड"],
    hb: ["हीमोग्लोबिन", "हिमोग्लोबिन", "haemoglobin", "hemoglobin", "hb", "hgb"],
    ferritin: ["फेरिटिन", "ferritin", "iron stores"],
    iron: ["serum iron"]
  };

  // Everyday topics that cover several tests.
  const TOPICS = [
    { id: "vitamins", words: ["vitamin", "vitamins", "vit", "विटामिन"], keys: ["vitd", "b12"] },
    { id: "thyroid", words: ["thyroid", "hypothyroid", "hypothyroidism", "hyperthyroid", "hyperthyroidism", "goitre", "goiter", "थायरॉइड", "थायराइड", "थायरोइड"], keys: ["tsh"], cond: true },
    { id: "sugar", words: ["sugar", "diabetes", "diabetic", "prediabetes", "prediabetic", "blood sugar", "शुगर", "डायबिटीज", "मधुमेह", "शक्कर"], keys: ["hba1c", "glucose"], cond: true },
    { id: "lipids", words: ["cholesterol", "lipid", "lipids", "heart", "dil", "कोलेस्ट्रॉल", "कोलेस्ट्रोल", "दिल", "हृदय"], keys: ["chol", "hdl", "ldl", "tg"] },
    { id: "liver", words: ["liver", "fatty liver", "lft", "jigar", "लिवर", "लीवर", "जिगर"], keys: ["alt", "ast", "ggt"], cond: true },
    { id: "kidney", words: ["kidney", "kidneys", "renal", "kft", "gurda", "gurde", "किडनी", "गुर्दा", "गुर्दे"], keys: ["creatinine", "egfr"], cond: true },
    { id: "iron", words: ["iron", "anaemia", "anemia", "anaemic", "anemic", "cbc", "blood count", "khoon ki kami", "khun ki kami", "आयरन", "एनीमिया", "खून की कमी", "लोहा"], keys: ["hb", "iron", "ferritin"], cond: true },
    { id: "inflammation", words: ["inflammation", "inflammatory", "sujan", "soojan", "सूजन"], keys: ["crp", "esr"] },
    { id: "bones", words: ["bone", "bones", "haddi", "haddiyan", "हड्डी", "हड्डियां", "हड्डियाँ"], keys: ["calcium", "phosphorus", "vitd"] },
    { id: "gout", words: ["gout", "गाउट", "गठिया"], keys: ["uric"] }
  ];

  // Tests the app doesn't track yet: answered honestly instead of guessing.
  const OTHER = [
    { words: ["free t4", "ft4", "t4", "free t3", "ft3", "t3"], name: "Free T4 / T3", topic: "thyroid" },
    { words: ["vitamin c", "विटामिन सी", "विटामिन c"], name: "Vitamin C" },
    { words: ["folate", "folic acid", "folic"], name: "Folate" },
    { words: ["magnesium"], name: "Magnesium" },
    { words: ["potassium", "sodium", "electrolytes", "electrolyte"], name: "Electrolytes (sodium, potassium)" },
    { words: ["platelet", "platelets", "wbc", "white blood", "rbc"], name: "Other blood count values" },
    { words: ["psa"], name: "PSA" },
    { words: ["urine", "यूरिन", "पेशाब"], name: "Urine tests" },
    { words: ["insulin"], name: "Insulin" },
    { words: ["urea", "bun"], name: "Urea" },
    { words: ["zinc"], name: "Zinc" }
  ];

  // What to ask for when a test isn't in the user's reports.
  const TEST_NAME = {
    vitd: "Vitamin D (25-OH)", b12: "Vitamin B12", hba1c: "HbA1c", glucose: "Fasting blood sugar",
    chol: "Lipid profile", hdl: "Lipid profile", ldl: "Lipid profile", tg: "Lipid profile",
    alt: "Liver function test (LFT)", ast: "Liver function test (LFT)", ggt: "Liver function test (LFT)",
    creatinine: "Kidney function test (KFT) with eGFR", egfr: "Kidney function test (KFT) with eGFR",
    hb: "Complete blood count (CBC)", iron: "Iron studies with ferritin", ferritin: "Iron studies with ferritin",
    tsh: "Thyroid test: TSH, often with Free T4", crp: "hs-CRP", esr: "ESR",
    calcium: "Calcium and phosphorus", phosphorus: "Calcium and phosphorus", uric: "Uric acid"
  };
  // A common basic check-up, for "which tests haven't I done?"
  const BASIC = ["hb", "hba1c", "glucose", "chol", "alt", "creatinine", "tsh", "vitd", "b12"];

  // Ordinary words that must never be "corrected" into a test name.
  const KEEP = new Set(("what which when where does have show tell about range normal healthy report reports result results level levels value values " +
    "test tests mine high good from with this that they them there been done should need take give much many more less okay fine well last latest " +
    "over under body feel feeling weak tired doctor " +
    // Hinglish and Hindi everyday words
    "kya hai mera meri mere mujhe kitna kitni batao bataiye kaise kaun kaunsa kaunse report normal kami problem samasya bimari dawa dawai goli " +
    "क्या मेरा मेरी मेरे मुझे कितना कितनी बताओ बताइए कैसा कैसी कौन रिपोर्ट टेस्ट नतीजे सामान्य समस्या बीमारी कमी दवा दवाई गोली").split(" "));

  // ---------- understanding the question ----------
  const phrases = [];
  for (const o of OTHER) for (const w of o.words) phrases.push({ w: clean(w), kind: "other", ref: o });
  for (const [k, ws] of Object.entries(MARKER)) for (const w of ws) phrases.push({ w: clean(w), kind: "marker", ref: k });
  for (const t of TOPICS) for (const w of t.words) phrases.push({ w: clean(w), kind: "topic", ref: t });
  phrases.sort((a, b) => b.w.length - a.w.length);
  const VOCAB = [...new Set(phrases.flatMap(p => p.w.split(" ")).filter(w => w.length >= 4 && !/\d/.test(w)))];

  // edit distance that counts a swap of two neighbouring letters as one ("heamoglobin", "thyriod")
  function dist(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
    return d[a.length][b.length];
  }
  function correct(tok) {
    if (tok.length < 4 || KEEP.has(tok) || VOCAB.includes(tok) || /\d/.test(tok)) return tok;
    const max = tok.length <= 5 ? 1 : 2;
    let best = null, bd = max + 1;
    for (const v of VOCAB) { if (Math.abs(v.length - tok.length) > max) continue; const x = dist(tok, v); if (x < bd) { bd = x; best = v; } }
    return best || tok;
  }

  function understand(q) {
    let s = " " + clean(q).split(" ").filter(Boolean).map(correct).join(" ") + " ";
    const raw = s, keys = [], topics = [], others = [];
    for (const p of phrases) {
      const pat = " " + p.w + " ";
      if (!s.includes(pat)) continue;
      s = s.split(pat).join("  ");   // consume it so "vitamin d" doesn't also count as "vitamin"
      if (p.kind === "marker" && !keys.includes(p.ref)) keys.push(p.ref);
      if (p.kind === "topic" && !topics.includes(p.ref)) topics.push(p.ref);
      if (p.kind === "other" && !others.includes(p.ref)) others.push(p.ref);
    }
    for (const t of topics) for (const k of t.keys) if (!keys.includes(k)) keys.push(k);
    for (const o of others) if (o.topic === "thyroid" && !keys.includes("tsh")) keys.push("tsh");
    const has = re => re.test(raw);
    return {
      keys, topics, others,
      condition: has(/ (have|got|am i|do i|is it|suffer|suffering|problem|problems|disease|issue|issues|deficient|deficiency|diabetic|anaemic|anemic|hai kya|kya mujhe|samasya|bimari|bimaari|kami|है क्या|हैं क्या|क्या मुझे|समस्या|बीमारी|कमी|रोग|तकलीफ) /) || topics.some(t => t.cond && / (diabetes|anaemia|anemia|hypothyroid|hyperthyroid|hypothyroidism|hyperthyroidism) /.test(raw)),
      meds: has(/ (medicine|medicines|medication|tablet|tablets|capsule|capsules|dose|dosage|supplement|supplements|injection|pill|pills|dawa|dawai|davai|goli|दवा|दवाई|गोली|इंजेक्शन|सप्लीमेंट|खुराक|डोज) /),
      overview: has(/ (report|reports|result|results|summary|overall|everything|natije|रिपोर्ट|नतीजे|सारांश) /),
      tests: has(/ (which|what) (tests?|checks?) | should i (do|get|take|test) | (missing|pending) | tests? (to do|should) | kaun ?se test | kaun ?sa test | kaunse test | कौन ?से टेस्ट | कौन ?सा टेस्ट | कौन ?सी जांच | कौन ?से जांच /)
    };
  }

  // ---------- answering ----------
  // withUnit: "30 ng/mL or more" instead of "30 or more"
  function rangeOf(k, t, withUnit) {
    const c = R.CATALOG[k], lo = t && t.low != null ? t.low : c.low, hi = t && t.high != null ? t.high : c.high, u = withUnit ? " " + c.unit : "";
    if (c.dir === "high" || !lo) return `under ${hi}${u}`;
    if (c.dir === "low" || hi == null) return `${lo}${u} or more`;
    return `${lo} to ${hi}${u}`;
  }
  function verdict(k, t) {
    const r = rangeOf(k, t);
    if (t.phase === "maintain") return `Back in the healthy range (${r}). One more normal test confirms it.`;
    if (t.status === "ok") return `In the healthy range (${r}).`;
    if (k === "hba1c") return Number(t.value) >= 6.5 ? "In the diabetes range (6.5 and above). Please see your doctor about this result." : "In the prediabetes range (5.7 to 6.4). Healthy is under 5.7.";
    return t.status === "low" ? `Below the healthy range (${r}).` : `Above the healthy range (${r}).`;
  }

  // The answer as plain data (the screen and the tests both use this).
  function answer(q, reports) {
    const u = understand(q), L = R.latest(reports || []), has = (reports || []).length > 0;
    const found = u.keys.filter(k => L[k]).map(k => ({ key: k, t: L[k], verdict: verdict(k, L[k]) }));
    const miss = u.keys.filter(k => !L[k]);
    const ask = [...new Set(miss.map(k => TEST_NAME[k]))].map(name => ({ name, keys: miss.filter(k => TEST_NAME[k] === name) }));
    const out = { kind: "answer", understood: u, found, missing: ask, others: u.others, hasReports: has };
    if (u.meds) out.meds = true;
    if (u.keys.length) return out;
    if (u.others.length || u.meds) return { ...out, kind: "other" };
    if (u.tests) {
      const todo = [...new Set(BASIC.filter(k => !L[k]).map(k => TEST_NAME[k]))];
      return { ...out, kind: "tests", todo };
    }
    if (u.overview) {
      const keys = Object.keys(L);
      return { ...out, kind: "overview",
        active: keys.filter(k => L[k].phase === "active").map(k => ({ key: k, t: L[k] })),
        back: keys.filter(k => L[k].phase === "maintain").map(k => ({ key: k, t: L[k] })),
        normal: keys.filter(k => L[k].status === "ok" && L[k].phase !== "maintain").map(k => ({ key: k, t: L[k] })) };
    }
    return { ...out, kind: "unknown" };
  }

  const API = { understand, answer, correct, TEST_NAME };
  window.ResetSearch = API;
  if (typeof document === "undefined" || !document.getElementById("askForm")) return;

  // ---------- screen ----------
  const $ = id => document.getElementById(id), app = window.resetApp, H = window.HealthUI;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const name = k => R.CATALOG[k].name;
  const SUGGEST = ["What are my vitamin results?", "Do I have a thyroid problem?", "Haemoglobin range", "What does my report say?", "Which tests haven't I done?"];
  const COND = "One test can't confirm or rule out a condition. Your doctor reads results together with your symptoms and history.";
  const MEDS = "The app doesn't suggest medicines, supplements or doses. Please ask your doctor.";
  let last = "";

  function trendLine(k, t) {
    if (!t.prev) return "";
    const c = R.CATALOG[k], d = t.value - t.prev.value;
    if (Math.abs(d) < 1e-9) return ` Same as on ${H.fmtDate(t.prev.date)}.`;
    // "improving" only makes sense if one of the two results was out of range
    const prevSt = t.hist && t.hist.length > 1 ? t.hist[t.hist.length - 2].status : "ok";
    const good = t.status === "ok" && prevSt === "ok" ? null : c.dir === "low" ? d > 0 : c.dir === "high" ? d < 0 : null;
    return ` Earlier: ${t.prev.value} on ${H.fmtDate(t.prev.date)}${good == null ? "" : good ? ", so it's improving" : ", so it's getting worse"}.`;
  }
  function foundCard(f) {
    const { key: k, t } = f, c = R.CATALOG[k], maint = t.phase === "maintain", st = maint ? "maint" : t.status, ef = R.effects(k, t.status);
    return `<div class="mcard st-${st} ans">
      <div class="mtop"><span class="nm">${esc(c.name)}<span class="pill2">${maint ? "back in range" : t.status === "ok" ? "OK" : t.status}</span></span><span class="mval"><b>${esc(t.value)}</b> ${esc(t.unit || c.unit)}</span></div>
      ${H.bar({ ...t, key: k })}
      <p><b>${esc(f.verdict)}</b></p>
      <p class="note">From your report of ${esc(H.fmtDate(t.date))}.${esc(trendLine(k, t))}</p>
      <p class="note">${esc(c.about)}</p>
      ${t.phase === "active" && ef.note ? `<p class="note"><b>${esc(ef.note)}</b></p>` : ""}
      <button type="button" class="linkbtn" data-m="${k}">More: what it means, why it happens and what helps</button></div>`;
  }
  function missingCard(m, hasReports) {
    const c = R.CATALOG[m.keys[0]];
    return `<div class="card ans nt"><span class="eyebrow">${hasReports ? "Not in your reports" : "No report added yet"}</span>
      <b>${esc(m.keys.map(name).join(", "))}</b>
      <p class="note">${esc(c.about)}</p>
      <p class="note">${esc(T("Healthy range:"))} ${m.keys.map(k => `${esc(T(name(k).replace(/ \(.*\)/, "")))} ${esc(T(rangeOf(k, null, true)))}`).join("; ")} ${esc(T("(labs vary a little)."))}</p>
      <p><b>Test to ask for:</b> ${esc(m.name)}. Ask your doctor whether you need it.</p></div>`;
  }
  const otherCard = o => `<div class="card ans nt"><span class="eyebrow">Not tracked yet</span><b>${esc(o.name)}</b><p class="note">The app doesn't read this test yet. Please check the value on your report itself, or ask your doctor.</p></div>`;
  const noteCard = t => `<div class="notice"><span>${esc(t)}</span></div>`;
  const chipsHTML = list => `<div class="askchips">${list.map(s => `<button type="button" data-ask="${esc(s)}">${esc(s)}</button>`).join("")}</div>`;
  const listRow = ({ key: k, t }) => `<button type="button" class="okrow askrow" data-m="${k}"><span>${esc(name(k))}</span><span>${esc(t.value)} ${esc(t.unit || R.CATALOG[k].unit)}</span></button>`;

  function view(a) {
    const parts = [];
    if (a.kind === "answer" && a.understood.condition) parts.push(noteCard(COND));
    if (a.meds) parts.push(noteCard(MEDS));
    if (a.kind === "answer" || a.kind === "other") {
      parts.push(...a.found.map(foundCard), ...a.missing.map(m => missingCard(m, a.hasReports)), ...a.others.map(otherCard));
      if (!a.hasReports && a.found.length === 0 && a.missing.length) parts.push(`<button type="button" class="btn primary" data-ask-upload style="align-self:flex-start">Upload a report</button>`);
    } else if (a.kind === "tests") {
      parts.push(`<div class="card ans"><b>${a.todo.length ? "Common tests not in your reports" : "Your reports cover the common tests"}</b>
        ${a.todo.length ? `<ul class="clean">${a.todo.map(t => `<li>${esc(t)}</li>`).join("")}</ul><p class="note">These are part of a usual yearly check-up. Ask your doctor which ones you need.</p>` : `<p class="note">Vitamins, sugar, cholesterol, liver, kidney, thyroid and blood count are all there.</p>`}</div>`);
    } else if (a.kind === "overview") {
      if (!a.hasReports) parts.push(`<div class="card ans"><b>You haven't added a report yet</b><p class="note">Upload a PDF or a photo of your blood report and you can ask about any result.</p><button type="button" class="btn primary" data-ask-upload style="align-self:flex-start">Upload a report</button></div>`);
      else {
        const sec = (title, list) => list.length ? `<span class="eyebrow">${title} (${list.length})</span><div class="oklist">${list.map(listRow).join("")}</div>` : "";
        parts.push(`<div class="card ans"><b>${a.active.length ? `${a.active.length} result${a.active.length > 1 ? "s" : ""} need${a.active.length > 1 ? "" : "s"} attention` : "All your results are in the healthy range"}</b>
          ${sec("Needs attention", a.active)}${sec("Back in range", a.back)}${sec("Normal", a.normal)}
          <p class="note">Tap a result for what it means. The full summary is below.</p></div>`);
      }
    } else {
      parts.push(`<div class="card ans"><b>Sorry, I couldn't match that to a blood test</b><p class="note">Try a word like vitamin, thyroid, sugar, cholesterol, liver, kidney, iron or haemoglobin.</p>${chipsHTML(SUGGEST)}</div>`);
    }
    return parts.join("");
  }

  function run(q) {
    last = q.trim();
    $("askOut").innerHTML = last ? view(answer(last, app.getState().reports || [])) : "";
    $("askClear").hidden = !last;
  }
  const screen = $("askScreen");
  function open(q) {
    screen.hidden = false; document.body.style.overflow = "hidden";
    if (q) { $("askQ").value = q; run(q); } else { $("askQ").focus(); }
  }
  function close() { screen.hidden = true; document.body.style.overflow = ""; }
  API.open = open; API.close = close;
  $("askOpen").onclick = () => open();
  $("askBack").onclick = close;
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !screen.hidden && !e.defaultPrevented) close(); });
  $("askForm").addEventListener("submit", e => { e.preventDefault(); $("askQ").blur(); run($("askQ").value); });
  $("askQ").addEventListener("input", e => { if (!e.target.value.trim()) run(""); });
  $("askClear").onclick = () => { $("askQ").value = ""; run(""); $("askQ").focus(); };
  screen.addEventListener("click", e => {
    const chip = e.target.closest("[data-ask]");
    if (chip) { const q = T(chip.dataset.ask); $("askQ").value = q; run(q); $("askOut").scrollIntoView({ block: "nearest" }); return; }
    if (e.target.closest("[data-ask-upload]")) { close(); $("hUpload").click(); return; }
    const m = e.target.closest("#askOut [data-m]");
    if (m) H.openPanel(m.dataset.m);
  });
  $("askSuggest").innerHTML = chipsHTML(SUGGEST);
  // keep an open answer up to date when reports change
  const orig = H.render;
  window.HealthUI.render = function () { orig(); if (last) run(last); };
})();
