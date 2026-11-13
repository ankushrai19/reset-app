// Reads a lab-report PDF on the device and keeps only the pages that hold results.
// Used so the AI step (Stage 2) receives a few pages of text instead of the whole report.
const UNIT = /(mg\/dl|ng\/ml|pg\/ml|g\/dl|gm\/dl|u\/l|iu\/l|mmol\/l|µmol\/l|umol\/l|mg\/l|mm\/hr|µiu\/ml|uiu\/ml|miu\/l|µg\/dl|ug\/dl|fl\b|pg\b|%|10\^3|x10|lakh|cells\/|ml\/min)/i;
const NUM = /(^|\s)[<>]?\d+(\.\d+)?(\s|$)/;
const NAMES = /(vitamin|hba1c|haemoglobin|hemoglobin|cholesterol|triglyceride|hdl|ldl|creatinine|urea|bilirubin|sgpt|sgot|alt\b|ast\b|tsh|t3|t4|glucose|calcium|ferritin|iron|platelet|crp|esr|sodium|potassium|uric|albumin|egfr)/i;

export function scorePage(lines) {
  let hits = 0;
  for (const l of lines) if (NUM.test(l) && (UNIT.test(l) || NAMES.test(l))) hits++;
  return hits;
}

// Returns { pages: total, kept: [pageNumbers], text } with text joined from kept pages.
export async function extractResults(data, pdfjs) {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const kept = [], parts = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    // rebuild lines by y position
    const rows = new Map();
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const y = Math.round(it.transform[5]);
      const key = [...rows.keys()].find(k => Math.abs(k - y) <= 2) ?? y;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ x: it.transform[4], s: it.str });
    }
    const lines = [...rows.entries()].sort((a, b) => b[0] - a[0])
      .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map(c => c.s.trim()).join("  ").replace(/\s{3,}/g, "  "));
    if (scorePage(lines) >= 2) { kept.push(i); parts.push(`--- page ${i} ---\n` + lines.join("\n")); }
  }
  return { pages: doc.numPages, kept, text: parts.join("\n\n") };
}
