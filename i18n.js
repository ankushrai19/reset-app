// Language support. The app is written in English; when Hindi is chosen, every English phrase on screen
// that has a translation in i18n-hi.js is swapped for its Hindi version as it appears (a MutationObserver),
// so app code stays unchanged and anything untranslated simply stays in English.
// Dictionary entries may hold {placeholders}: "Day {n} of 84" matches "Day 5 of 84" and keeps the number.
// A captured value is itself translated when it is a known phrase ("Phase {n} · {name}" → the phase name too).
(function () {
  const KEY = "reset84lang";
  let lang = null;
  try { lang = localStorage.getItem(KEY); } catch (e) {}
  if (lang !== "en" && lang !== "hi") lang = /^hi\b/i.test(navigator.language || "") ? "hi" : "en";

  const exact = new Map(), patterns = [];
  function load(dict) {
    for (const [en, hi] of Object.entries(dict)) {
      if (!/\{\w+\}/.test(en)) { exact.set(en, hi); continue; }
      const names = [];
      const src = en.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\\?\{(\w+)\\?\}|\{(\w+)\}/g, (m, a, b) => { names.push(a || b); return "(.+?)"; });
      patterns.push({ re: new RegExp("^" + src + "$"), names, hi });
    }
    patterns.sort((a, b) => b.re.source.length - a.re.source.length);   // most specific first
  }
  // translate one phrase (already trimmed); returns null when there is no translation
  function tr(s, depth) {
    if (exact.has(s)) return exact.get(s);
    if ((depth || 0) > 2) return null;
    for (const p of patterns) {
      const m = p.re.exec(s);
      if (!m) continue;
      const v = {};
      p.names.forEach((n, i) => { const c = m[i + 1]; v[n] = tr(c, (depth || 0) + 1) ?? c; });
      return p.hi.replace(/\{(\w+)\}/g, (x, n) => v[n] ?? x);
    }
    return null;
  }
  const t = s => (lang === "hi" ? tr(String(s).trim()) ?? s : s);

  // ---------- on-screen text ----------
  const ATTRS = ["placeholder", "aria-label", "title"];
  const origText = new WeakMap(), origAttr = new WeakMap();
  const skip = el => !el || el.closest && el.closest("script,style,textarea,[translate='no'],[data-noi18n]");
  function textNode(n) {
    if (skip(n.parentElement)) return;
    const cur = n.nodeValue, s = cur.trim();
    if (!s || !/[A-Za-z]/.test(s)) return;
    const h = tr(s);
    if (h == null || h === s) return;
    origText.set(n, cur);
    n.nodeValue = cur.replace(s, h);
  }
  function element(el) {
    if (skip(el)) return;
    for (const a of ATTRS) {
      const v = el.getAttribute(a);
      if (!v || !/[A-Za-z]/.test(v)) continue;
      const h = tr(v.trim());
      if (h == null || h === v) continue;
      const o = origAttr.get(el) || {}; if (!(a in o)) o[a] = v; origAttr.set(el, o);
      el.setAttribute(a, h);
    }
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) return textNode(root);
    if (root.nodeType !== 1) return;
    element(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) n.nodeType === 3 ? textNode(n) : element(n);
  }
  function restore(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { if (origText.has(n)) { n.nodeValue = origText.get(n); origText.delete(n); } }
      else if (origAttr.has(n)) { for (const [a, v] of Object.entries(origAttr.get(n))) n.setAttribute(a, v); origAttr.delete(n); }
    }
  }
  const obs = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === "characterData") textNode(m.target);
      else if (m.type === "attributes") element(m.target);
      else m.addedNodes.forEach(walk);
    }
  });
  function watch(on) {
    obs.disconnect();
    if (on) obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }

  function apply() {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    if (!document.body) return;
    if (lang === "hi") { walk(document.body); watch(true); } else { watch(false); restore(document.body); }
  }
  function setLang(l) {
    if (l !== "en" && l !== "hi" || l === lang) return;
    lang = l;
    try { localStorage.setItem(KEY, l); } catch (e) {}
    apply();
    window.dispatchEvent(new Event("langchange"));
  }

  document.documentElement.lang = lang;
  document.documentElement.dataset.lang = lang;
  document.addEventListener("DOMContentLoaded", apply);
  window.I18N = {
    get lang() { return lang; },
    get loc() { return lang === "hi" ? "hi-IN" : undefined; },   // for dates: "14 नव॰"
    t, tr, load, setLang, apply,
    get size() { return exact.size + patterns.length; }
  };
})();
