// node tests/search-check.js — Health tab search: everyday questions, misspellings, missing tests. Made-up values only.
global.window = {};
require("../rules.js");
require("../search.js");
const R = window.ResetRules, S = window.ResetSearch;
let fail = 0;
const check = (label, ok, info) => { if (!ok) fail++; console.log((ok ? "PASS " : "FAIL ") + label.padEnd(52), ok ? "" : JSON.stringify(info)); };
const rep = (date, rows) => ({ id: date, date, lab: "T", tests: rows.map(([n, v, lo, hi]) => ({ key: R.keyFor(n), name: n, value: v, low: lo, high: hi })) });
const reports = [
  rep("2026-08-01", [["Vitamin D", 11, 30, 100], ["HbA1c", 6.2, null, 5.7], ["Haemoglobin", 14.1, 13, 17]]),
  rep("2026-11-01", [["Vitamin D", 24, 30, 100], ["Vitamin B12", 300, 197, 771], ["HbA1c", 5.9, null, 5.7], ["Haemoglobin", 14.4, 13, 17], ["HDL", 35, 40, 60]])
];
const keys = (q, reps = reports) => { const a = S.answer(q, reps); return { a, found: a.found.map(f => f.key).sort().join(), missing: a.missing.flatMap(m => m.keys).sort().join() }; };

// everyday questions -> the right tests
const CASES = [
  ["what is my vitamin results", "b12,vitd", ""],
  ["vitamin d", "vitd", ""],
  ["what is my b12", "b12", ""],
  ["what is Heamoglobin range", "hb", ""],
  ["hemoglobin", "hb", ""],
  ["do i have Thyroid", "", "tsh"],
  ["do i have thyriod problem", "", "tsh"],
  ["am I diabetic", "hba1c", "glucose"],
  ["my suger level", "hba1c", "glucose"],
  ["cholestrol", "hdl", "chol,ldl,tg"],
  ["how is my liver", "", "alt,ast,ggt"],
  ["kidny", "", "creatinine,egfr"],
  ["do i have anemia", "hb", "ferritin,iron"],
  ["bones", "vitd", "calcium,phosphorus"],
  ["sgpt", "", "alt"],
  ["good cholesterol", "hdl", ""],
  // Hindi and Hinglish
  ["क्या मुझे थायरॉइड की समस्या है?", "", "tsh"],
  ["मेरे विटामिन के नतीजे?", "b12,vitd", ""],
  ["हीमोग्लोबिन की सीमा", "hb", ""],
  ["विटामिन डी की कमी", "vitd", ""],
  ["vitamin ki kami hai kya", "b12,vitd", ""],
  ["thyroid hai kya", "", "tsh"],
  ["sugar kitni hai", "hba1c", "glucose"],
  ["khoon ki kami", "hb", "ferritin,iron"],
  ["कोलेस्ट्रॉल", "hdl", "chol,ldl,tg"],
  ["लिवर कैसा है", "", "alt,ast,ggt"],
  ["किडनी", "", "creatinine,egfr"],
  ["haddi", "vitd", "calcium,phosphorus"]
];
for (const [q, f, m] of CASES) { const r = keys(q); check(`"${q}"`, r.found === f && r.missing === m, { found: r.found, missing: r.missing }); }

// missing tests come with a test to ask for
const thy = S.answer("do i have thyroid", reports);
check("thyroid not tested: suggests a TSH test", thy.missing.length === 1 && /TSH/.test(thy.missing[0].name), thy.missing);
check("'do i have' adds the can't-diagnose note", thy.understood.condition === true, thy.understood);
const lip = S.answer("cholesterol", reports);
check("lipid tests grouped into one 'Lipid profile'", lip.missing.length === 1 && lip.missing[0].name === "Lipid profile", lip.missing);

// verdicts in plain words
const v = S.answer("vitamin d", reports).found[0];
check("vitamin D low says below the healthy range", /Below the healthy range/.test(v.verdict), v.verdict);
const a1c = S.answer("hba1c", reports).found[0];
check("HbA1c 5.9 says prediabetes range", /prediabetes range/.test(a1c.verdict), a1c.verdict);

// no reports at all: still answers with the test to ask for
const none = S.answer("vitamin d", []);
check("no reports: vitamin D suggests a test", none.found.length === 0 && none.missing[0].name === "Vitamin D (25-OH)", none);

// other kinds of question
check("'what does my report say' gives an overview", S.answer("what does my report say", reports).kind === "overview");
const t = S.answer("which tests should i do", reports);
check("'which tests' lists tests not done", t.kind === "tests" && t.todo.includes("Lipid profile") && !t.todo.includes("HbA1c"), t.todo);
check("untracked test is answered honestly", S.answer("folate").kind === "other");
check("Free T4 also shows the thyroid answer", S.answer("free t4", reports).missing.some(m => m.keys.includes("tsh")));
check("medicine question gets the doctor note", S.answer("which vitamin d tablet should i take", reports).meds === true);
check("nonsense gets the try-these message", S.answer("hello there", reports).kind === "unknown");
check("Hindi 'do I have' adds the can't-diagnose note", S.answer("क्या मुझे थायरॉइड की समस्या है?", reports).understood.condition === true);
check("Hinglish 'kami hai kya' adds the note", S.answer("vitamin ki kami hai kya", reports).understood.condition === true);
check("Hindi medicine question gets the doctor note", S.answer("विटामिन डी की कौन सी गोली लूँ", reports).meds === true);
check("Hindi 'what does my report say' gives an overview", S.answer("मेरी रिपोर्ट क्या कहती है?", reports).kind === "overview");
check("Hindi 'which tests' lists tests not done", S.answer("कौन से टेस्ट नहीं हुए?", reports).kind === "tests");
check("ordinary words are not corrected", ["level", "range", "what", "have", "tired"].every(w => S.correct(w) === w));
process.exit(fail ? 1 : 0);
