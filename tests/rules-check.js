// node tests/rules-check.js — result-name matching and the week-1 chai taper. Made-up values only.
global.window = {};
require("../rules.js");
const R = window.ResetRules;
let fail = 0;
const check = (label, got, want) => { const ok = got === want; if (!ok) fail++; console.log((ok ? "PASS " : "FAIL ") + label.padEnd(40), ok ? "" : `got ${got}, want ${want}`); };

// names on real lab reports -> tracked marker (null = a different test we don't track)
const NAMES = {
  "Haemoglobin": "hb", "Hemoglobin (Hb)": "hb", "Mean Corpuscular Hemoglobin (MCH)": null, "MCHC": null,
  "HbA1c": "hba1c", "Hb A1c": "hba1c", "Glycated Hemoglobin": "hba1c",
  "Fasting Blood Sugar": "glucose", "Glucose, Fasting": "glucose", "Glucose (Random)": null,
  "HDL Cholesterol": "hdl", "Non-HDL Cholesterol": null, "VLDL Cholesterol": null, "LDL Cholesterol Direct": "ldl",
  "Cholesterol, Total": "chol", "HDL/LDL ratio": null,
  "Iron, Serum": "iron", "Total Iron Binding Capacity (TIBC)": null, "Transferrin Saturation": null, "Serum Ferritin": "ferritin",
  "Calcium, Total": "calcium", "Ionized Calcium": null,
  "Creatinine, Serum": "creatinine", "Urine Creatinine": null, "Creatinine clearance": null, "Microalbumin/Creatinine": null,
  "25-OH Vitamin D (Total)": "vitd", "1,25-Dihydroxy Vitamin D": null,
  "Vitamin B12": "b12", "Holo-transcobalamin": null,
  "SGPT/ALT": "alt", "ALT (SGPT)": "alt", "SGOT/SGPT": null, "AST/ALT Ratio": null,
  "hs-CRP": "crp", "TSH - Ultrasensitive": "tsh", "Free T4": null, "eGFR": "egfr"
};
for (const [n, k] of Object.entries(NAMES)) check("name: " + n, R.keyFor(n), k);

// a report that lists the same test twice: the first value counts
const L = R.latest([{ id: "a", date: "2026-01-01", tests: [{ key: "hb", value: 12 }, { key: "hb", value: 31 }] }]);
check("duplicate test in one report", L.hb.value, 12);

// chai taper: high sugar tapers to none by day 7; normal sugar stays at half in week 1
const high = [{ id: "s", date: "2026-01-01", tests: [{ key: "hba1c", value: 6.2, low: null, high: 5.7 }] }];
const ok = [{ id: "s", date: "2026-01-01", tests: [{ key: "hba1c", value: 5.2, low: null, high: 5.7 }, { key: "tg", value: 190, low: null, high: 150 }] }];
const P1 = [{ id: "chai", at: "16:30", t: "Chai with half the usual sugar", w: "" }];
const chai = (n, reps) => (R.apply(P1, n, 1, reps).find(h => h.id === "chai") || {}).t;
check("high sugar, day 2", chai(2, high), "Chai with half the usual sugar");
check("high sugar, day 5", chai(5, high), "Chai with a quarter of the usual sugar");
check("high sugar, day 7", chai(7, high), "Chai without sugar");
check("sugar normal, day 7", chai(7, ok), "Chai with half the usual sugar");
// women's limits apply only when the lab gives no range of its own
const st = (key, value, sex, low) => { R.setSex(sex); const s = R.status({ key, value, low: low ?? null, high: null }); R.setSex(null); return s; };
check("HDL 45, woman, no lab range: low", st("hdl", 45, "f"), "low");
check("HDL 45, man, no lab range: ok", st("hdl", 45, "m"), "ok");
check("HDL 45, sex not set: ok", st("hdl", 45, null), "ok");
check("Haemoglobin 12.5, woman: ok", st("hb", 12.5, "f"), "ok");
check("Haemoglobin 12.5, man: low", st("hb", 12.5, "m"), "low");
check("Haemoglobin 12.5, woman, lab range 13: low (lab wins)", st("hb", 12.5, "f", 13), "low");
process.exit(fail ? 1 : 0);
