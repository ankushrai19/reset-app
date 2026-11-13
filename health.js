// Health tab: upload a report, review the extracted results, save, and see trends.
// READER_MODE "test" returns sample results instead of calling the AI (no cost).
// Stage 2 switches it to "live", which sends the trimmed report to the Cloud Function.
(function () {
  const READER_MODE = "test";
  const R = window.ResetRules, app = window.resetApp;
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const isoToday = () => { const d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const fmtDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); };
  const shortDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" }); };
  const rid = () => "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const num = v => { const n = Number(v); return isFinite(n) ? n : null; };

  // Made-up sample reports for trying the feature. Not anyone's real results.
  const SAMPLE_A = { date: "2026-08-12", lab: "Sample Lab", tests: [
    ["Vitamin D (25-OH)", 11.2, "ng/mL", 30, 100], ["Vitamin B12", 236, "pg/mL", 197, 771], ["HbA1c", 6.2, "%", null, 5.7],
    ["HDL Cholesterol", 34, "mg/dL", 40, 60], ["LDL Cholesterol", 128, "mg/dL", null, 100], ["Triglycerides", 196, "mg/dL", null, 150],
    ["SGPT (ALT)", 58, "U/L", null, 45], ["Haemoglobin", 14.1, "g/dL", 13, 17], ["TSH", 2.3, "µIU/mL", 0.54, 5.3], ["Calcium", 8.9, "mg/dL", 8.8, 10.6]] };
  const SAMPLE_B = { date: "2026-11-05", lab: "Sample Lab", tests: [
    ["Vitamin D (25-OH)", 24.6, "ng/mL", 30, 100], ["Vitamin B12", 312, "pg/mL", 197, 771], ["HbA1c", 5.9, "%", null, 5.7],
    ["HDL Cholesterol", 38, "mg/dL", 40, 60], ["LDL Cholesterol", 112, "mg/dL", null, 100], ["Triglycerides", 158, "mg/dL", null, 150],
    ["SGPT (ALT)", 44, "U/L", null, 45], ["hs-CRP", 1.8, "mg/L", null, 3], ["Fasting glucose", 96, "mg/dL", 70, 100],
    ["Haemoglobin", 14.4, "g/dL", 13, 17], ["TSH", 2.1, "µIU/mL", 0.54, 5.3], ["Calcium", 9.1, "mg/dL", 8.8, 10.6], ["eGFR", 104, "mL/min", 90, null]] };
  const toTests = s => s.tests.map(([name, value, unit, low, high]) => ({ key: R.keyFor(name), name, value, unit, low, high }));

  // ---------- reading ----------
  async function prepare(file, onStep) {
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      onStep("open", "ok");
      onStep("pages", "run");
      const pdfjs = await import("./vendor/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "./vendor/pdf.worker.min.mjs";
      const { extractResults } = await import("./pdftext.js");
      const r = await extractResults(new Uint8Array(await file.arrayBuffer()), pdfjs);
      if (!r.kept.length) throw new Error("no-text");
      onStep("pages", "ok", `Found results on ${r.kept.length} of ${r.pages} page${r.pages > 1 ? "s" : ""}`);
      return { kind: "pdf", text: r.text, pages: r.pages, kept: r.kept };
    }
    if (file.type.startsWith("image/")) {
      onStep("open", "ok");
      onStep("pages", "run");
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/jpeg", 0.85);
      onStep("pages", "ok", "Photo prepared", dataUrl);
      return { kind: "image", dataUrl };
    }
    throw new Error("type");
  }

  async function readReport(payload) {
    if (READER_MODE === "test") {
      await new Promise(r => setTimeout(r, 1400));
      return { date: isoToday(), lab: "Sample Lab", tests: toTests(SAMPLE_B), test: true };
    }
    throw new Error("live-off");
  }

  // ---------- upload sheet ----------
  let draft = null;
  function openSheet(html) { $("sheetIn").innerHTML = html; $("sheet").hidden = false; document.body.style.overflow = "hidden"; }
  function closeSheet() { $("sheet").hidden = true; $("sheetIn").innerHTML = ""; document.body.style.overflow = ""; draft = null; }

  async function startUpload(file) {
    const steps = { open: "Opening file", pages: file.type.startsWith("image/") ? "Preparing photo" : "Finding the pages with results", read: "Reading your results" };
    openSheet(`<div class="shead"><h2 id="sheetTitle">Reading your report</h2><button class="btn" type="button" data-x="close">Cancel</button></div>
      <p class="note">${esc(file.name)}</p>
      <ul class="steps">${Object.entries(steps).map(([k, t]) => `<li id="st-${k}"><i></i><span>${t}</span></li>`).join("")}</ul>
      <div id="thumbWrap"></div>
      ${READER_MODE === "test" ? `<p class="testmode">Test mode: the app reads your file on this phone, then shows <b>sample results</b> instead of calling the AI. Nothing is sent anywhere and no credits are used.</p>` : ""}`);
    const step = (k, st, label, img) => {
      const li = $("st-" + k); if (!li) return;
      li.className = st; if (label) li.querySelector("span").textContent = label;
      if (img) $("thumbWrap").innerHTML = `<img class="thumb" src="${img}" alt="Your report photo">`;
    };
    try {
      step("open", "run");
      const payload = await prepare(file, step);
      if ($("sheet").hidden) return;
      step("read", "run");
      const res = await readReport(payload);
      if ($("sheet").hidden) return;
      step("read", "ok");
      draft = { id: rid(), date: res.date || isoToday(), lab: res.lab || "", tests: res.tests, sample: !!res.test, test: !!res.test };
      setTimeout(showReview, 350);
    } catch (e) {
      const msg = e.message === "type" ? "That file type isn't supported. Choose a PDF or a photo (JPG or PNG)."
        : e.message === "no-text" ? "This PDF has no readable text (it may be a scan). Try taking a clear photo of the results page instead."
        : e.message === "live-off" ? "Report reading isn't switched on yet."
        : "Something went wrong reading this file. Please try again, or try a photo of the results page.";
      openSheet(`<div class="shead"><h2 id="sheetTitle">Couldn't read the report</h2></div><p>${msg}</p><div class="sfoot"><button class="btn primary" type="button" data-x="close">Close</button></div>`);
    }
  }

  function statusOf(t) { return R.status({ ...t, value: num(t.value) }); }
  function showReview() {
    const d = draft;
    openSheet(`<div class="shead"><h2 id="sheetTitle">Check your results</h2><button class="btn" type="button" data-x="close">Cancel</button></div>
      ${d.test ? `<p class="testmode">Test mode: these are <b>sample results</b>, not read from your file.</p>` : `<p class="note">Compare these with your report and fix anything that was read wrongly before saving.</p>`}
      <div class="fields">
        <label class="f" for="rvDate">Test date<input type="date" id="rvDate" value="${esc(d.date)}" max="${isoToday()}"></label>
        <label class="f" for="rvLab">Lab<input type="text" id="rvLab" value="${esc(d.lab)}" placeholder="e.g. Thyrocare"></label>
      </div>
      <div class="card" style="padding:4px 14px" id="rvList"></div>
      <p class="note" id="rvCount"></p>
      <div class="sfoot"><button class="btn" type="button" data-x="close">Cancel</button><button class="btn primary" type="button" data-x="save">Save report</button></div>`);
    renderReviewRows();
  }
  function renderReviewRows() {
    const known = draft.tests.filter(t => t.key);
    $("rvList").innerHTML = known.map(t => {
      const i = draft.tests.indexOf(t), st = statusOf(t), c = R.CATALOG[t.key];
      const range = rangeText(t);
      return `<div class="rv st-${st}"><div><div style="font-weight:700">${esc(c.name)}<span class="pill2">${st === "ok" ? "OK" : st}</span></div>
        <div class="sm">${esc(t.unit || c.unit)} · healthy ${esc(range)}</div></div>
        <input type="number" inputmode="decimal" step="any" id="rv-${i}" data-i="${i}" value="${esc(t.value)}" aria-label="${esc(c.name)} value">
        <button class="x" type="button" data-rm="${i}" aria-label="Remove ${esc(c.name)}">×</button></div>`;
    }).join("") || `<p class="note" style="padding:10px 0">No results left. Cancel and try again.</p>`;
    const other = draft.tests.length - known.length;
    $("rvCount").textContent = `${known.length} result${known.length === 1 ? "" : "s"} the app tracks` + (other ? `. ${other} other line${other > 1 ? "s" : ""} on the report aren't tracked yet.` : ".");
  }
  function rangeText(t) {
    const c = R.CATALOG[t.key] || {}, lo = t.low ?? c.low, hi = t.high ?? c.high;
    if (c.dir === "high" || !lo) return `under ${hi}`;
    if (c.dir === "low" || hi == null) return `${lo}+`;
    return `${lo}–${hi}`;
  }

  $("sheet").addEventListener("click", e => {
    const x = e.target.closest("[data-x]"), rm = e.target.closest("[data-rm]");
    if (rm) { draft.tests.splice(+rm.dataset.rm, 1); renderReviewRows(); return; }
    if (!x) return;
    if (x.dataset.x === "close") closeSheet();
    if (x.dataset.x === "save") saveDraft();
  });
  $("sheet").addEventListener("input", e => {
    if (e.target.dataset.i != null) {
      const t = draft.tests[+e.target.dataset.i]; t.value = e.target.value;
      const row = e.target.closest(".rv"), st = statusOf(t);
      row.className = "rv st-" + st; row.querySelector(".pill2").textContent = st === "ok" ? "OK" : st;
    }
  });
  function saveDraft() {
    const date = $("rvDate").value, lab = $("rvLab").value.trim();
    if (!date) { app.toast("Add the test date first"); $("rvDate").focus(); return; }
    const bad = draft.tests.find(t => t.key && num(t.value) == null);
    if (bad) { app.toast("One value is empty. Fix it or remove that row."); return; }
    const report = { id: draft.id, date, lab, tests: draft.tests.filter(t => t.key).map(t => ({ key: t.key, name: t.name, value: num(t.value), unit: t.unit || R.CATALOG[t.key].unit, low: t.low ?? null, high: t.high ?? null })) };
    if (draft.sample) report.sample = true;
    const st = app.getState();
    st.reports = [...(st.reports || []), report];
    app.save({ reports: true }); app.render(); showSummary(report.id); app.toast("Report saved. Your habits are updated.");
  }

  function showSummary(id) {
    const all = app.getState().reports || [], r = all.find(x => x.id === id);
    if (!r || !window.ReportSummary) { closeSheet(); return; }
    openSheet(window.ReportSummary.html(r, all, bar));
    $("sheet").scrollTop = 0;
  }

  // ---------- Health tab ----------
  let open = null, confirmDel = null;
  function domain(t) {
    const c = R.CATALOG[t.key], lo = t.low ?? c.low, hi = t.high ?? c.high, v = t.value;
    if (c.dir === "high") return [0, Math.max(hi * 1.6, v * 1.15)];
    if (c.dir === "low") return [0, Math.max((hi ?? lo * 2) * 1.1, v * 1.15, lo * 1.6)];
    const span = hi - lo; return [Math.max(0, Math.min(lo - span * .5, v - span * .1)), Math.max(hi + span * .5, v + span * .1)];
  }
  const pct = (x, a, b) => Math.max(0, Math.min(100, (x - a) / (b - a) * 100));
  function bar(t) {
    const c = R.CATALOG[t.key], lo = t.low ?? c.low, hi = t.high ?? c.high, [a, b] = domain(t);
    const bl = c.dir === "high" ? 0 : pct(lo, a, b), br = c.dir === "low" ? 100 : pct(hi, a, b);
    return `<div class="rbar" aria-hidden="true"><span class="band" style="left:${bl}%;width:${br - bl}%"></span><span class="pin" style="left:${pct(t.value, a, b)}%"></span></div>
      <div class="rlab"><span>${c.dir === "high" ? "" : "low"}</span><span>healthy ${esc(rangeText(t))}</span><span>${c.dir === "low" ? "" : "high"}</span></div>`;
  }
  function trend(t) {
    if (!t.prev) return "";
    const c = R.CATALOG[t.key], d = t.value - t.prev.value;
    if (Math.abs(d) < 1e-9) return `<span class="trend">Same as ${fmtDate(t.prev.date)} (${t.prev.value})</span>`;
    const good = c.dir === "low" ? d > 0 : c.dir === "high" ? d < 0 : null;
    const arrow = d > 0 ? "↑" : "↓";
    return `<span class="trend ${good == null ? "" : good ? "better" : "worse"}">${arrow} from ${t.prev.value} on ${fmtDate(t.prev.date)}${good == null ? "" : good ? ", improving" : ", getting worse"}</span>`;
  }
  function history(key, reports) {
    const pts = [...reports].sort((a, b) => a.date < b.date ? -1 : 1).map(r => ({ date: r.date, t: (r.tests || []).find(x => x.key === key) })).filter(p => p.t);
    if (pts.length < 2) return "";
    const c = R.CATALOG[key], W = 300, H = 110, L = 8, Rr = 8, T = 18, B = 22;
    const vals = pts.map(p => p.t.value), lo = pts.at(-1).t.low ?? c.low, hi = pts.at(-1).t.high ?? c.high;
    const ymin = Math.min(...vals, c.dir === "high" ? 0 : lo) * 0.9, ymax = Math.max(...vals, c.dir === "low" ? lo * 1.3 : hi) * 1.1;
    const y = v => T + (H - T - B) * (1 - (v - ymin) / (ymax - ymin)), x = i => L + (W - L - Rr) * (pts.length === 1 ? .5 : i / (pts.length - 1));
    const bandTop = c.dir === "low" ? T : y(Math.min(hi, ymax)), bandBot = c.dir === "high" ? H - B : y(Math.max(lo, ymin));
    const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.t.value).toFixed(1)}`).join(" ");
    return `<div class="hist"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(c.name)} over time">
      <rect x="${L}" y="${bandTop.toFixed(1)}" width="${W - L - Rr}" height="${Math.max(0, bandBot - bandTop).toFixed(1)}" fill="var(--done-soft)"/>
      <path d="${line}" fill="none" stroke="var(--ink)" stroke-width="2"/>
      ${pts.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.t.value).toFixed(1)}" r="4" fill="var(--sun)"/>
        <text x="${x(i).toFixed(1)}" y="${(y(p.t.value) - 8).toFixed(1)}" font-size="11" text-anchor="${i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}" fill="var(--ink)">${p.t.value}</text>
        <text x="${x(i).toFixed(1)}" y="${H - 6}" font-size="10" text-anchor="${i === 0 ? "start" : i === pts.length - 1 ? "end" : "middle"}" fill="var(--muted)">${esc(shortDate(p.date))}</text>`).join("")}
    </svg><span class="note">Green band: healthy range</span></div>`;
  }
  function markerCard(k, t, reports) {
    const c = R.CATALOG[k], ef = R.effects(k, t.status), isOpen = open === k;
    const habitNames = ef.habits.map(h => window.resetHabitName ? window.resetHabitName(h) : h);
    const plan = [...habitNames.map(h => `Your “${h}” habit now shows why it matters for this.`), ...ef.adds.map(a => `Adds a habit: ${a.t}${a.from > 1 ? ` (from day ${a.from})` : ""}.`)];
    return `<div class="mcard st-${t.status}"><button type="button" class="mhead" data-m="${k}" aria-expanded="${isOpen}">
      <div class="mtop"><span class="nm">${esc(c.name)}<span class="pill2">${t.status === "ok" ? "OK" : t.status}</span></span>
        <span class="mval"><b>${t.value}</b> ${esc(t.unit || c.unit)}</span></div>
      ${bar(t)}${trend(t)}</button>
      ${isOpen ? `<div class="mmore"><p>${esc(c.about)}</p>
        ${ef.note ? `<p><b>${esc(ef.note)}</b></p>` : ""}
        ${plan.length ? `<div><b>What changes in your plan</b><ul>${plan.map(p => `<li>${esc(p)}</li>`).join("")}</ul></div>` : ""}
        ${history(k, reports)}</div>` : ""}
    </div>`;
  }

  function render() {
    const st = app.getState(), reports = st.reports || [];
    const hasSample = reports.some(r => r.sample);
    $("hSample").textContent = hasSample ? "Remove sample reports" : "Try sample reports";
    if (!reports.length) {
      $("hSub").textContent = "";
      $("hBody").innerHTML = `<div class="card empty"><h2>Read your blood report</h2>
        <p class="note">Upload a PDF or a photo of a lab report. The app picks out each result, shows which are out of range, and adjusts your daily habits to match. You can check and correct every number before it's saved.</p>
        <p class="note">Want to see how it works first? Tap <b>Try sample reports</b> for two made-up reports.</p></div>`;
      return;
    }
    const p = R.plan(reports), L = p.latest, keys = Object.keys(L);
    const bad = keys.filter(k => L[k].status === "low" || L[k].status === "high"), good = keys.filter(k => L[k].status === "ok");
    const last = [...reports].sort((a, b) => a.date < b.date ? 1 : -1)[0];
    $("hSub").textContent = `Latest: ${fmtDate(last.date)}${last.lab ? " · " + last.lab : ""}`;
    const adds = Object.values(p.adds);
    $("hBody").innerHTML = `
      <button class="btn primary" type="button" data-sum="${last.id}" style="align-self:flex-start">Read the summary of your latest report</button>
      <div class="hsum">
        <div class="stat"><b>${bad.length}</b><span>need attention</span></div>
        <div class="stat"><b>${good.length}</b><span>in range</span></div>
        <div class="stat"><b>${reports.length}</b><span>report${reports.length > 1 ? "s" : ""}</span></div>
      </div>
      ${p.notes.map(n => `<div class="notice"><span><b>${esc(R.CATALOG[n.key].name)}:</b> ${esc(n.text)}</span></div>`).join("")}
      ${bad.length ? `<div class="sect"><span class="eyebrow">Needs attention</span>${bad.map(k => markerCard(k, L[k], reports)).join("")}</div>` : `<div class="cheer">Everything the app tracks is in range. Keep going.</div>`}
      ${adds.length ? `<div class="card"><h3 style="margin-bottom:6px">Added to your daily plan</h3><ul style="margin:0;padding-left:1.1em;display:flex;flex-direction:column;gap:4px">${adds.map(a => `<li>${esc(a.t)} <span class="note">(${esc(R.CATALOG[a.because].name)}${a.from > 1 ? `, from day ${a.from}` : ""}${a.to ? `, until day ${a.to}` : ""})</span></li>`).join("")}</ul></div>` : ""}
      ${good.length ? `<div class="sect"><span class="eyebrow">In range</span><div class="card oklist" style="padding:2px 14px">${good.map(k => `<button type="button" class="okrow" data-m="${k}" style="background:none;border:0;border-top:1px solid var(--line);font:inherit;color:inherit;text-align:left;cursor:pointer;width:100%"><span>${esc(R.CATALOG[k].name)}</span><span>${L[k].value} ${esc(L[k].unit || R.CATALOG[k].unit)}</span></button>${open === k ? markerCard(k, L[k], reports) : ""}`).join("")}</div></div>` : ""}
      <div class="sect"><span class="eyebrow">Your reports</span><div class="card" style="padding:2px 14px">
        ${[...reports].sort((a, b) => a.date < b.date ? 1 : -1).map(r => `<div class="rep"><div><b>${esc(fmtDate(r.date))}</b>${r.sample ? '<span class="tag">sample</span>' : ""}<div class="note">${esc(r.lab || "Lab not named")} · ${r.tests.length} results</div></div>
          ${confirmDel === r.id ? "" : `<button class="btn" type="button" data-sum="${r.id}">Summary</button>`}
          ${confirmDel === r.id ? `<div class="row"><button class="btn" type="button" data-del-no>Keep</button><button class="btn danger" type="button" data-del-yes="${r.id}">Delete</button></div>` : `<button class="btn" type="button" data-del="${r.id}" aria-label="Delete report from ${esc(fmtDate(r.date))}">Delete</button>`}</div>`).join("")}
      </div></div>`;
  }

  $("hBody").addEventListener("click", e => {
    const sum = e.target.closest("[data-sum]");
    if (sum) { showSummary(sum.dataset.sum); return; }
    const m = e.target.closest("[data-m]"), del = e.target.closest("[data-del]"), yes = e.target.closest("[data-del-yes]"), no = e.target.closest("[data-del-no]");
    if (e.target.closest(".mmore")) return;
    if (del) { confirmDel = del.dataset.del; render(); return; }
    if (no) { confirmDel = null; render(); return; }
    if (yes) { const st = app.getState(); st.reports = st.reports.filter(r => r.id !== yes.dataset.delYes); confirmDel = null; app.save({ reports: true }); app.render(); app.toast("Report deleted"); return; }
    if (m) { open = open === m.dataset.m ? null : m.dataset.m; render(); }
  });
  $("hUpload").onclick = () => { $("hFile").value = ""; $("hFile").click(); };
  $("hFile").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; if (f) startUpload(f); });
  $("hSample").onclick = () => {
    const st = app.getState();
    if ((st.reports || []).some(r => r.sample)) { st.reports = st.reports.filter(r => !r.sample); app.save({ reports: true }); app.render(); app.toast("Sample reports removed"); return; }
    st.reports = [...(st.reports || []), { id: rid(), date: SAMPLE_A.date, lab: SAMPLE_A.lab, sample: true, tests: toTests(SAMPLE_A) }, { id: rid(), date: SAMPLE_B.date, lab: SAMPLE_B.lab, sample: true, tests: toTests(SAMPLE_B) }];
    app.save({ reports: true }); app.render(); app.toast("Two sample reports added");
  };
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("sheet").hidden) closeSheet(); });

  window.HealthUI = { render };
  render();
})();
