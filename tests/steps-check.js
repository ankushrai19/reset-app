// node tests/steps-check.js  — checks step detection on simulated phone movement (made-up signals)
const listeners = {}; global.window = { addEventListener: (t, f) => (listeners[t] = f), removeEventListener() {} };
global.document = { addEventListener() {}, hidden: false }; global.navigator = {}; global.performance = { now: () => 0 }; global.DeviceMotionEvent = function () {};
require("../steps.js"); const S = window.ResetSteps;
async function sim(label, fn, expect, secs = 10, hz = 60) {
  await S.start(0);
  for (let i = 0; i < secs * hz; i++) { const t = (i * 1000) / hz; listeners.devicemotion({ timeStamp: t, accelerationIncludingGravity: { x: 0.3, y: fn(t / 1000), z: 1.2 } }); }
  const n = S.stop(), ok = Math.abs(n - expect) <= 2; console.log((ok ? "PASS " : "FAIL ") + label.padEnd(30), "steps", n, "expected ~" + expect); return ok;
}
(async () => {
  const noise = () => (Math.random() - 0.5) * 0.6; let ok = true;
  ok &= await sim("walking 2 steps/s", s => 9.81 + 3 * Math.sin(2 * Math.PI * 2 * s) + noise(), 20);
  ok &= await sim("brisk 2.4 steps/s", s => 9.81 + 3.5 * Math.sin(2 * Math.PI * 2.4 * s) + noise(), 24);
  ok &= await sim("slow 1.5 steps/s", s => 9.81 + 2.2 * Math.sin(2 * Math.PI * 1.5 * s) + noise(), 15);
  ok &= await sim("sitting", s => 9.81 + noise(), 0);
  ok &= await sim("single bump", s => 9.81 + (s > 3 && s < 3.2 ? 4 : 0) + noise(), 0);
  process.exit(ok ? 0 : 1);
})();
