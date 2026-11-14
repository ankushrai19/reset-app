// Progress graphs. Hand-drawn SVG (no library) so they work offline.
// Uses the app's globals: state, habits, scored, calLen, add, diff, parse, TODAY, TOTAL, PHASES, mins, fmt, esc, resetHabitName.
(function () {
  const $ = id => document.getElementById(id);
  const E = x => String(x ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]));
  const W = 340, PAD = { l: 34, r: 10, t: 14, b: 26 };
  let range = "4w";
  try { range = localStorage.getItem("reset84range") || "4w"; } catch (e) {}

  const shortD = d => parse(d).toLocaleDateString(window.I18N&&I18N.loc, { day: "numeric", month: "short" });
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const pathCol = (x, y, w, h) => { // column with 4px rounded top, square at the baseline
    const r = Math.min(4, w / 2, h);
    if (h <= 0) return "";
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };
  const pathBarH = (x, y, w, h) => { // horizontal bar, rounded at the data end
    const r = Math.min(4, h / 2, w);
    if (w <= 0) return "";
    return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
  };

  // ---- data ----
  function daysIn(r) {
    const last = Math.min(diff(state.start, TODAY), calLen() - 1);
    if (last < 0) return [];
    const first = r === "2w" ? Math.max(0, last - 13) : r === "4w" ? Math.max(0, last - 27) : 0;
    const out = [];
    for (let i = first; i <= last; i++) out.push(add(state.start, i));
    return out;
  }
  function dayStats(d) {
    // list: every habit that day (for the per-habit graphs); the day's score counts the focus habits (see scored())
    const { list } = habits(d), done = new Set(state.days[d] || []), sc = scored(d);
    return { d, list, done, total: sc.length, n: sc.filter(h => done.has(h.id)).length };
  }

  // ---- chart pieces ----
  function columns({ values, labels, tips, max, ref, refLabel, highlight, unit, H = 170, empty, fmt }) {
    const n = values.length, pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b;
    const band = pw / Math.max(n, 1), bw = Math.max(3, Math.min(24, band * 0.62));
    const y = v => PAD.t + ph * (1 - v / max);
    const ticks = [0, max / 2, max];
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-hidden="false">`;
    for (const t of ticks) s += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${PAD.l - 6}" y="${y(t) + 4}" class="tick" text-anchor="end">${fmt ? fmt(Math.round(t)) : Math.round(t)}${unit || ""}</text>`;
    values.forEach((v, i) => {
      const x = PAD.l + band * i + (band - bw) / 2, h = ph * (Math.max(0, v) / max);
      const cls = highlight && highlight(i) ? "m2" : v == null ? "" : "m1";
      if (v != null && v > 0) s += `<path d="${pathCol(x, y(v), bw, h)}" class="${cls}"/>`;
      else if (v === 0) s += `<rect x="${x}" y="${y(0) - 2}" width="${bw}" height="2" rx="1" class="zero"/>`;
      // full-height hit target, focusable
      s += `<rect x="${PAD.l + band * i}" y="${PAD.t}" width="${band}" height="${ph}" class="hit" tabindex="0" data-tip="${E(tips[i])}"/>`;
    });
    if (ref != null) s += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(ref)}" y2="${y(ref)}" class="ref"/><text x="${W - PAD.r}" y="${y(ref) - 4}" class="reflab" text-anchor="end">${E(refLabel)}</text>`;
    // sparse x labels: first, last, and evenly between
    const every = Math.max(1, Math.ceil(n / 6)), show = [];
    for (let i = 0; i < n; i += every) show.push(i);
    if (show[show.length - 1] !== n - 1) { if (n - 1 - show[show.length - 1] < every * 0.7) show.pop(); show.push(n - 1); }
    show.forEach(i => { s += `<text x="${PAD.l + band * i + band / 2}" y="${H - 8}" class="tick" text-anchor="${i === n - 1 && n > 1 ? "end" : i === 0 ? "start" : "middle"}" dx="${i === n - 1 && n > 1 ? band / 2 : i === 0 ? -band / 2 : 0}">${E(labels[i])}</text>`; });
    if (empty) s += `<text x="${W / 2}" y="${PAD.t + ph / 2}" class="tick" text-anchor="middle">${E(empty)}</text>`;
    return s + `</svg>`;
  }
  function hbars(rows) { // rows: {label, v (0-100), right, tip, flag}
    const rowH = 26, H = rows.length * rowH + 8, lw = 118, pw = W - lw - 64;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
    s += `<line x1="${lw}" x2="${lw}" y1="2" y2="${H - 4}" class="grid"/>`;
    rows.forEach((r, i) => {
      const y = 6 + i * rowH, w = pw * r.v / 100;
      s += `<text x="${lw - 8}" y="${y + 13}" class="lab" text-anchor="end">${E(r.label)}</text>`;
      s += `<rect x="${lw}" y="${y + 3}" width="${pw}" height="12" rx="4" class="track"/>`;
      if (w > 0) s += `<path d="${pathBarH(lw, y + 3, w, 12)}" class="${r.flag ? "m2" : "m1"}"/>`;
      s += `<text x="${lw + pw + 6}" y="${y + 13}" class="val">${E(r.right)}</text>`;
      s += `<rect x="0" y="${y}" width="${W}" height="${rowH}" class="hit" tabindex="0" data-tip="${E(r.tip)}"/>`;
    });
    return s + `</svg>`;
  }
  // a line with dots, one point per entry (entries are evenly spaced, not by date)
  function line({ values, labels, tips, ref, refLabel, unit, H = 150 }) {
    const n = values.length, pw = W - PAD.l - PAD.r, ph = H - PAD.t - PAD.b, all = [...values, ...(ref != null ? [ref] : [])];
    let lo = Math.min(...all), hi = Math.max(...all); const padv = Math.max(1, (hi - lo) * 0.25); lo = Math.floor(lo - padv); hi = Math.ceil(hi + padv);
    const x = i => PAD.l + (n === 1 ? pw / 2 : pw * i / (n - 1)), y = v => PAD.t + ph * (1 - (v - lo) / (hi - lo));
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
    for (const t of [lo, (lo + hi) / 2, hi]) s += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(t)}" y2="${y(t)}" class="grid"/><text x="${PAD.l - 6}" y="${y(t) + 4}" class="tick" text-anchor="end">${Math.round(t)}${unit || ""}</text>`;
    if (ref != null) s += `<line x1="${PAD.l}" x2="${W - PAD.r}" y1="${y(ref)}" y2="${y(ref)}" class="ref"/><text x="${W - PAD.r}" y="${y(ref) - 4}" class="reflab" text-anchor="end">${E(refLabel)}</text>`;
    if (n > 1) s += `<path d="${values.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1)).join("")}" class="ln"/>`;
    values.forEach((v, i) => { s += `<circle cx="${x(i)}" cy="${y(v)}" r="4" class="pt"/><rect x="${x(i) - 14}" y="${PAD.t}" width="28" height="${ph}" class="hit" tabindex="0" data-tip="${E(tips[i])}"/>`; });
    [0, n - 1].filter((v, i, a) => a.indexOf(v) === i).forEach(i => { s += `<text x="${x(i)}" y="${H - 8}" class="tick" text-anchor="${n > 1 ? (i ? "end" : "start") : "middle"}">${E(labels[i])}</text>`; });
    return s + `</svg>`;
  }
  const table = (head, rows) => `<details class="tview"><summary>Show as table</summary><div class="tbl"><table><thead><tr>${head.map(h => `<th>${E(h)}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${E(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
  const key = (hi, rest) => `<p class="note key"><i class="sw m1"></i>${E(rest)} <i class="sw m2"></i>${E(hi)}</p>`;
  const card = (title, lead, body, tbl, id) => `<div class="card chart"${id ? ` id="${id}"` : ""}><h3>${E(title)}</h3><p class="note lead">${lead}</p>${body}${tbl}</div>`;

  // ---- the charts ----
  function weekly() {
    // calendar weeks: 12, plus one for each repeated week
    const last = Math.min(diff(state.start, TODAY), calLen() - 1), cur = Math.floor(Math.max(last, 0) / 7);
    const vals = [], tips = [], rows = [];
    for (let w = 0; w < calLen() / 7; w++) {
      const ds = []; for (let i = w * 7; i < w * 7 + 7 && i <= last; i++) ds.push(dayStats(add(state.start, i)));
      if (!ds.length) { vals.push(null); tips.push(`Week ${w + 1}: not started`); continue; }
      const p = Math.round(ds.reduce((a, s) => a + (s.total ? s.n / s.total : 0), 0) / ds.length * 100);
      vals.push(p); tips.push(`Week ${w + 1}: ${p}% average over ${ds.length} day${ds.length > 1 ? "s" : ""}`); rows.push([`Week ${w + 1}`, shortD(add(state.start, w * 7)), p + "%"]);
    }
    const doneW = vals.filter(v => v != null);
    const lead = last < 0 ? "Your weeks fill in once the plan starts." : doneW.length > 1 ? `This week ${vals[cur]}%, last week ${vals[cur - 1]}%.` : `Week 1 so far: ${vals[0]}% on average.`;
    return card("Week by week", lead, columns({ values: vals, labels: vals.map((_, i) => "W" + (i + 1)), tips, max: 100, unit: "%", ref: 70, refLabel: "70% good", highlight: i => i === cur }) + key("This week", "Earlier weeks"), table(["Week", "Starts", "Average"], rows));
  }
  function daily(days) {
    const st = days.map(dayStats), vals = st.map(s => pct(s.n, s.total));
    const good = vals.filter(v => v >= 70).length;
    const lead = days.length ? `${good} of ${days.length} day${days.length > 1 ? "s" : ""} were good days (70%+).` : "Nothing to show yet.";
    return card("Daily routine", lead, columns({ values: vals, labels: days.map(d => shortD(d)), tips: st.map((s, i) => `${shortD(s.d)}: ${s.n} of ${s.total} habits (${vals[i]}%)`), max: 100, unit: "%", ref: 70, refLabel: "Good day", highlight: i => days[i] === TODAY }) + key("Today", "Earlier days"),
      table(["Date", "Done", "Habits", "%"], st.map((s, i) => [shortD(s.d), s.n, s.total, vals[i] + "%"])));
  }
  function byHabit(days) {
    const agg = {};
    for (const d of days) { const s = dayStats(d); for (const h of s.list) { const a = agg[h.id] || (agg[h.id] = { id: h.id, sched: 0, done: 0 }); a.sched++; if (s.done.has(h.id)) a.done++; } }
    const rows = Object.values(agg).map(a => ({ ...a, p: pct(a.done, a.sched) })).sort((a, b) => b.p - a.p || b.sched - a.sched);
    if (!rows.length) return card("Habit by habit", "Nothing to show yet.", "", "");
    const weak = rows.filter(r => r.p < 50 && r.sched >= 3).slice(-2).map(r => resetHabitName(r.id));
    const lead = weak.length ? `Needs the most attention: ${E(weak.join(" and "))}.` : `Strongest: ${E(resetHabitName(rows[0].id))} (${rows[0].p}%).`;
    return card("Habit by habit", lead,
      hbars(rows.map(r => ({ label: resetHabitName(r.id), v: r.p, right: r.p + "%", flag: r.p < 50 && r.sched >= 3, tip: `${resetHabitName(r.id)}: done ${r.done} of ${r.sched} scheduled days (${r.p}%)` }))) +
      `<p class="note key"><i class="sw m1"></i>Done on scheduled days <i class="sw m2"></i>Under 50%, needs focus</p>`,
      table(["Habit", "Done", "Scheduled", "%"], rows.map(r => [resetHabitName(r.id), r.done, r.sched, r.p + "%"])));
  }
  const MED_IDS = ["meds"];
  function medicines(days) {
    const cells = days.map(d => { const s = dayStats(d), m = s.list.find(h => MED_IDS.includes(h.id)); return { d, sched: !!m, taken: m ? s.done.has(m.id) : false, label: m ? m.t : "" }; });
    const sched = cells.filter(c => c.sched), taken = sched.filter(c => c.taken).length;
    if (!sched.length) return card("Medicines and supplements", "No medicines or supplements are in your plan for these days.", "", "");
    let streak = 0; for (let i = cells.length - 1; i >= 0; i--) { const c = cells[i]; if (!c.sched) continue; if (c.taken) streak++; else if (c.d === TODAY) continue; else break; }
    const size = Math.min(22, Math.floor((W - 8) / Math.min(cells.length, 14)) - 4), per = Math.min(cells.length, 14), rowsN = Math.ceil(cells.length / per), gap = 4;
    const H = rowsN * (size + gap) + 4;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img">`;
    cells.forEach((c, i) => {
      const x = 4 + (i % per) * (size + gap), y = 2 + Math.floor(i / per) * (size + gap), r = size / 2;
      if (c.sched && c.taken) s += `<circle cx="${x + r}" cy="${y + r}" r="${r - 1}" class="good"/>`;
      else if (c.sched) s += `<circle cx="${x + r}" cy="${y + r}" r="${r - 2}" class="miss"/>`;
      else s += `<circle cx="${x + r}" cy="${y + r}" r="2" class="none"/>`;
      s += `<rect x="${x - 1}" y="${y - 1}" width="${size + 2}" height="${size + 2}" class="hit" tabindex="0" data-tip="${E(shortD(c.d) + ": " + (c.sched ? (c.taken ? "taken" : c.d === TODAY ? "not ticked yet" : "missed") : "not scheduled"))}"/>`;
    });
    s += `</svg>`;
    const p = pct(taken, sched.length);
    return card("Medicines and supplements",
      `Taken on ${taken} of ${sched.length} scheduled days (${p}%). Current run: ${streak} day${streak === 1 ? "" : "s"}.`,
      s + `<p class="note key"><i class="dot good"></i>Taken <i class="dot miss"></i>Missed <i class="dot none"></i>Not scheduled</p><p class="note">Counts your "${E(cells.find(c => c.sched).label)}" habit. Prescribed medicines will appear here once that feature is added.</p>`,
      table(["Date", "Status"], cells.map(c => [shortD(c.d), c.sched ? (c.taken ? "Taken" : c.d === TODAY ? "Not ticked yet" : "Missed") : "Not scheduled"])));
  }
  function timeOfDay(days) {
    const slots = [{ k: "Morning", lab: "before noon", a: 0, b: 720 }, { k: "Afternoon", lab: "noon to 5 pm", a: 720, b: 1020 }, { k: "Evening", lab: "after 5 pm", a: 1020, b: 1440 }].map(x => ({ ...x, sched: 0, done: 0 }));
    for (const d of days) { const s = dayStats(d); for (const h of s.list) { const sl = slots.find(x => mins(h.at) >= x.a && mins(h.at) < x.b); sl.sched++; if (s.done.has(h.id)) sl.done++; } }
    const used = slots.filter(x => x.sched);
    if (!used.length) return card("Time of day", "Nothing to show yet.", "", "");
    used.forEach(x => x.p = pct(x.done, x.sched));
    const worst = [...used].sort((a, b) => a.p - b.p)[0], best = [...used].sort((a, b) => b.p - a.p)[0];
    const lead = worst.p === best.p ? "All parts of the day are even." : `${worst.k} habits slip most (${worst.p}%); ${best.k.toLowerCase()} is strongest (${best.p}%).`;
    return card("Time of day", lead, hbars(used.map(x => ({ label: x.k, v: x.p, right: x.p + "%", flag: x === worst && worst.p < best.p, tip: `${x.k} (${x.lab}): ${x.done} of ${x.sched} habits done (${x.p}%)` }))),
      table(["Part of day", "Done", "Scheduled", "%"], used.map(x => [x.k + " (" + x.lab + ")", x.done, x.sched, x.p + "%"])));
  }
  function water(days) {
    const vals = days.map(d => (state.water && state.water[d]) || 0), goal = 8, hit = vals.filter(v => v >= goal).length;
    const avg = days.length ? (vals.reduce((a, b) => a + b, 0) / days.length).toFixed(1) : 0;
    return card("Water", days.length ? `Average ${avg} glasses a day; goal reached on ${hit} of ${days.length} days.` : "Nothing to show yet.",
      columns({ values: vals, labels: days.map(d => shortD(d)), tips: days.map((d, i) => `${shortD(d)}: ${vals[i]} glass${vals[i] === 1 ? "" : "es"}`), max: Math.max(10, ...vals), ref: goal, refLabel: "Goal 8", highlight: i => days[i] === TODAY }) + key("Today", "Earlier days"),
      table(["Date", "Glasses"], days.map((d, i) => [shortD(d), vals[i]])));
  }

  function goalFor(d) { const n = diff(state.start, d) + 1, p = PHASES.find(x => n >= x.from && n <= x.to) || PHASES[PHASES.length - 1]; return p.steps || 5000; }
  function steps(days) {
    const st = days.map(d => window.resetDaySteps(d)), vals = st.map(s => s.n), goals = days.map(goalFor);
    const met = vals.filter((v, i) => v >= goals[i]).length, logged = vals.filter(v => v > 0).length;
    const avg = logged ? Math.round(vals.reduce((a, b) => a + b, 0) / logged) : 0, goalNow = goals[goals.length - 1] || 5000;
    const max = Math.ceil(Math.max(goalNow * 1.25, ...vals) / 1000) * 1000;
    const lead = logged ? `Average ${avg.toLocaleString()} steps on ${logged} day${logged > 1 ? "s" : ""} with steps; goal reached on ${met}.` : "No steps yet. Use Start walk on a walking habit, or enter today's total from your watch on the Today screen.";
    return card("Steps", lead,
      columns({ values: vals, labels: days.map(d => shortD(d)), tips: st.map((s, i) => `${shortD(days[i])}: ${vals[i].toLocaleString()} steps (goal ${goals[i].toLocaleString()})${s.n ? (s.src === "watch" ? ", from your watch" : ", counted by the app") : ""}`), max, ref: goalNow, refLabel: "Goal " + goalNow.toLocaleString(), highlight: i => days[i] === TODAY, fmt: v => v >= 1000 ? (v / 1000) + "k" : String(v) }) + key("Today", "Earlier days"),
      table(["Date", "Steps", "Goal", "Source"], st.map((s, i) => [shortD(days[i]), vals[i].toLocaleString(), goals[i].toLocaleString(), s.n ? (s.src === "watch" ? "Watch total" : "Counted walks") : "-"])));
  }
  function calories(days) {
    const pf = state.profile || {}, S = window.ResetSteps;
    if (!pf.weight) return card("Calories burned walking", "Add your weight and height in Settings to see estimated calories.", "", "");
    const vals = days.map(d => S.kcal(window.resetDaySteps(d).n, pf) || 0), total = vals.reduce((a, b) => a + b, 0), logged = vals.filter(v => v > 0).length;
    const max = Math.ceil(Math.max(100, ...vals) / 50) * 50;
    return card("Calories burned walking", logged ? `About ${total.toLocaleString()} kcal over ${logged} day${logged > 1 ? "s" : ""}, ${Math.round(total / logged)} a day on average. Estimated from steps, height and weight.` : "No steps yet.",
      columns({ values: vals, labels: days.map(d => shortD(d)), tips: days.map((d, i) => `${shortD(d)}: about ${vals[i]} kcal`), max, highlight: i => days[i] === TODAY }) + key("Today", "Earlier days") +
      `<p class="note">An estimate (about 0.5 kcal per kg per km walked). Your Galaxy Watch measures this more closely; the Android app version will read it directly.</p>`,
      table(["Date", "kcal (estimate)"], days.map((d, i) => [shortD(d), vals[i]])));
  }

  // Weight and waist, from the weekly weigh-in or the + button. Waist target by sex (Asian cut-offs, IDF): men under 90 cm, women under 80 cm.
  function body() {
    const b = state.body || {}, ds = Object.keys(b).sort(), sex = (state.profile || {}).sex;
    const wd = ds.filter(d => b[d].w != null), cd = ds.filter(d => b[d].waist != null), target = sex === "f" ? 80 : sex === "m" ? 90 : null;
    if (!wd.length && !cd.length) return card("Weight and waist", "Log your weight and waist from the + button, or when you tick the weekly weigh-in.", "", "");
    const ch = (a, z, u) => { const d = Math.round((z - a) * 10) / 10; return (d > 0 ? "+" : "") + d + " " + u; };
    const parts = [];
    if (wd.length) parts.push(`Weight ${b[wd.at(-1)].w} kg` + (wd.length > 1 ? ` (${ch(b[wd[0]].w, b[wd.at(-1)].w, "kg")} since ${shortD(wd[0])})` : ""));
    if (cd.length) parts.push(`waist ${b[cd.at(-1)].waist} cm` + (cd.length > 1 ? ` (${ch(b[cd[0]].waist, b[cd.at(-1)].waist, "cm")} since ${shortD(cd[0])})` : ""));
    // each part is translated on its own (a template can't tell where one part ends)
    const T = x => (window.I18N ? I18N.t(x) : x);
    const lead = parts.map(T).join(", ") + T(".");
    let bodyHTML = "";
    if (wd.length) bodyHTML += `<p class="note"><b>Weight (kg)</b></p>` + line({ values: wd.map(d => b[d].w), labels: wd.map(shortD), tips: wd.map(d => `${shortD(d)}: ${b[d].w} kg`), unit: "" });
    if (cd.length) bodyHTML += `<p class="note"><b>Waist (cm)</b></p>` + line({ values: cd.map(d => b[d].waist), labels: cd.map(shortD), tips: cd.map(d => `${shortD(d)}: ${b[d].waist} cm`), ref: target, refLabel: target ? `Target under ${target} cm` : "", unit: "" });
    if (!target) bodyHTML += `<p class="note">Set your sex in Settings to see your waist target (men under 90 cm, women under 80 cm).</p>`;
    return card("Weight and waist", lead, bodyHTML, table(["Date", "Weight (kg)", "Waist (cm)"], ds.map(d => [shortD(d), b[d].w ?? "–", b[d].waist ?? "–"])));
  }

  function render() {
    const host = $("charts"); if (!host) return;
    const days = daysIn(range);
    host.innerHTML = weekly() + body() +
      `<div class="seg" role="group" aria-label="Range for the graphs below">${[["2w", "2 weeks"], ["4w", "4 weeks"], ["all", "All days"]].map(([k, l]) => `<button type="button" data-r="${k}" aria-pressed="${range === k}">${l}</button>`).join("")}</div>` +
      daily(days) + steps(days) + calories(days) + byHabit(days) + medicines(days) + timeOfDay(days) + water(days) +
      `<p class="note">Result trends from your blood reports are on the Results tab.</p>`;
  }

  // tooltip: hover, tap or keyboard focus
  const tip = document.createElement("div"); tip.className = "ctip"; tip.hidden = true; tip.setAttribute("role", "status"); document.body.appendChild(tip);
  const showTip = (el, x, y) => { tip.textContent = el.dataset.tip; tip.hidden = false; const r = tip.getBoundingClientRect(); tip.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2)) + "px"; tip.style.top = Math.max(8, y - r.height - 12) + "px"; };
  const hide = () => { tip.hidden = true; document.querySelectorAll("#charts .hit.on").forEach(e => e.classList.remove("on")); };
  document.addEventListener("pointerover", e => { const h = e.target.closest && e.target.closest("#charts .hit"); if (h && e.pointerType === "mouse") { hide(); h.classList.add("on"); showTip(h, e.clientX, e.clientY); } });
  document.addEventListener("pointermove", e => { const h = e.target.closest && e.target.closest("#charts .hit"); if (h && e.pointerType === "mouse" && !tip.hidden) showTip(h, e.clientX, e.clientY); else if (!h && e.pointerType === "mouse") hide(); });
  document.addEventListener("click", e => { const h = e.target.closest && e.target.closest("#charts .hit"); if (h) { hide(); h.classList.add("on"); showTip(h, e.clientX, e.clientY); } else if (!e.target.closest("#charts")) hide(); });
  document.addEventListener("focusin", e => { const h = e.target.closest && e.target.closest("#charts .hit"); if (h) { hide(); h.classList.add("on"); const r = h.getBoundingClientRect(); showTip(h, r.left + r.width / 2, r.top); } });
  window.addEventListener("scroll", hide, { passive: true });
  document.addEventListener("click", e => { const b = e.target.closest && e.target.closest("#charts [data-r]"); if (!b) return; range = b.dataset.r; try { localStorage.setItem("reset84range", range); } catch (x) {} render(); });

  window.ResetCharts = { render };
  render();
})();
