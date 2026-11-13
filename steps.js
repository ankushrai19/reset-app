// Step counting with the phone's motion sensor, plus distance and calorie estimates.
// Works only while the app is open and visible (the browser pauses sensors otherwise),
// so the counter keeps the screen awake during a walk. The Android app version (Health Connect)
// will replace this with the phone's own step counter and the watch's data.
(function () {
  let listening = false, steps = 0, onStep = null, wake = null;
  let base = 9.81, smooth = 0, prev = 0, lastStep = 0, gotEvent = false;
  const TH = 1.1;          // m/s² above the moving average that counts as a footfall peak
  const MIN_GAP = 280;     // ms: faster than ~3.5 steps a second is noise
  const MAX_GAP = 2000;    // ms: a pause longer than this restarts the rhythm check
  let pending = 0, firstAt = 0;

  function handle(e) {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    gotEvent = true;
    const m = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    base = base * 0.97 + m * 0.03;               // slow baseline (gravity + posture)
    smooth = smooth * 0.6 + (m - base) * 0.4;    // light smoothing of the bounce
    const now = e.timeStamp || performance.now();
    if (prev <= TH && smooth > TH && now - lastStep > MIN_GAP) {
      // require a rhythm: the first two peaks are held until a third confirms walking
      if (now - lastStep > MAX_GAP) { pending = 1; firstAt = now; }
      else if (pending > 0 && pending < 3) { pending++; if (pending === 3) { steps += 3; onStep && onStep(steps); pending = 0; firstAt = 0; } }
      else { steps++; onStep && onStep(steps); }
      lastStep = now;
    }
    prev = smooth;
  }
  async function keepAwake() {
    try { if ("wakeLock" in navigator) { wake = await navigator.wakeLock.request("screen"); } } catch (e) { wake = null; }
  }
  document.addEventListener("visibilitychange", () => { if (listening && !document.hidden) keepAwake(); });

  async function start(from, cb) {
    steps = from || 0; onStep = cb; base = 9.81; smooth = 0; prev = 0; lastStep = 0; pending = 0; gotEvent = false;
    if (typeof DeviceMotionEvent === "undefined") return false;
    // listen first, then ask: some browsers grant silently, some prompt once, iOS requires the prompt
    window.addEventListener("devicemotion", handle);
    listening = true; keepAwake();
    let ok = true;
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      try { ok = (await DeviceMotionEvent.requestPermission()) === "granted"; } catch (e) { ok = true; }
    }
    return ok;
  }
  function stop() {
    window.removeEventListener("devicemotion", handle);
    listening = false; onStep = null;
    try { wake && wake.release(); } catch (e) {} wake = null;
    return steps;
  }

  // ---- estimates ----
  // Stride from height (a widely used rule of thumb: about 41.5% of height for men, 41.3% for women).
  function strideM(profile) {
    const h = profile && Number(profile.height);
    if (!h) return 0.75;
    return h / 100 * (profile.sex === "f" ? 0.413 : 0.415);
  }
  const km = (n, profile) => n * strideM(profile) / 1000;
  // Net (active) energy of walking on flat ground: roughly 0.5 kcal per kg per km. Estimate only.
  function kcal(n, profile) {
    const w = profile && Number(profile.weight);
    if (!w) return null;
    return Math.round(0.5 * w * km(n, profile));
  }

  window.ResetSteps = { start, stop, get count() { return steps; }, get active() { return listening; }, get sensorSeen() { return gotEvent; }, strideM, km, kcal };
})();
