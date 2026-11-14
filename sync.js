// Google sign-in and cloud sync for 12-Week Reset.
// Progress lives in Firestore at users/{uid}: { start: "YYYY-MM-DD", days: { "YYYY-MM-DD": [habitIds] }, updatedAt }.
// The app keeps working from localStorage; this file mirrors it to the cloud when signed in.
import {
  initializeApp, getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut, setPersistence, indexedDBLocalPersistence,
  initializeFirestore, persistentLocalCache, doc, setDoc, getDoc, onSnapshot, serverTimestamp
} from "./firebase.js";

const firebaseConfig = {
  apiKey: "AIzaSyDLOQuRd8J8IzVavIQIoXufxE8d2f_kC3k",
  authDomain: "reset-app-17bdb.firebaseapp.com",
  projectId: "reset-app-17bdb",
  storageBucket: "reset-app-17bdb.firebasestorage.app",
  messagingSenderId: "719015505852",
  appId: "1:719015505852:web:3dda0e24c382f68b0345b9"
};

const $ = id => document.getElementById(id);
const app = window.resetApp;
const fb = initializeApp(firebaseConfig);
const auth = getAuth(fb);
setPersistence(auth, indexedDBLocalPersistence).catch(() => {});
let db;
try { db = initializeFirestore(fb, { localCache: persistentLocalCache() }); }
catch (e) { db = initializeFirestore(fb, {}); }

let user = null, ref = null, unsub = null, pending = 0;

// "In step" = this phone has no changes the cloud is missing (stores the account id).
// When in step, the cloud copy is taken as it is on the next start, so a report deleted or a tick
// removed on another device stays gone. Only a phone with unsent changes merges both copies.
const STEP = "reset84insync";
const inStep = uid => { try { return localStorage.getItem(STEP) === uid; } catch (e) { return false; } };
const setInStep = uid => { try { uid ? localStorage.setItem(STEP, uid) : localStorage.removeItem(STEP); } catch (e) {} };

function status(text, ok) {
  $("syncTxt").textContent = text;
  $("syncChip").classList.toggle("ok", !!ok);
}
function showAccount() {
  const signedIn = !!user;
  $("signIn").hidden = signedIn;
  $("signOut").hidden = !signedIn;
  $("acctMsg").textContent = signedIn
    ? `Signed in as ${user.email}. Your progress is backed up and syncs to any phone or laptop where you sign in.`
    : "Sign in with Google to back up your progress and use it on more than one device.";
  if (!signedIn) status("Saved on this phone", false);
}

// Union of two progress objects; keeps every tick from both.
function merge(local, cloud) {
  const days = { ...cloud.days };
  for (const [d, ids] of Object.entries(local.days || {})) {
    days[d] = [...new Set([...(days[d] || []), ...ids])];
  }
  const water = { ...(cloud.water || {}) };
  for (const [d, n] of Object.entries(local.water || {})) water[d] = Math.max(water[d] || 0, n);
  const reports = [...(cloud.reports || [])];
  for (const r of local.reports || []) if (!reports.some(x => x.id === r.id)) reports.push(r);
  const steps = { ...(cloud.steps || {}), ...(local.steps || {}) };
  const walks = [...(cloud.walks || [])];
  for (const w of local.walks || []) if (!walks.some(x => x.id === w.id)) walks.push(w);
  const profile = { ...(cloud.profile || {}), ...(local.profile || {}) };
  // plan: repeated weeks from both, the earliest focus start, every safety note read; body: weight and waist by date
  const lp = local.plan || {}, cp = cloud.plan || {}, ff = [lp.focusFrom, cp.focusFrom].filter(Boolean).sort()[0];
  const plan = { ...cp, ...lp, repeats: [...new Set([...(cp.repeats || []), ...(lp.repeats || [])])].sort(), asked: [...new Set([...(cp.asked || []), ...(lp.asked || [])])].sort(), ack: { ...(cp.ack || {}), ...(lp.ack || {}) } };
  if (ff) plan.focusFrom = ff;
  const body = { ...(cloud.body || {}), ...(local.body || {}) };
  const cloudHasData = Object.values(cloud.days || {}).some(a => a.length);
  return { start: cloudHasData ? cloud.start : (local.start || cloud.start), days, water, reports, steps, walks, profile, plan, body };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function write(data, mergeIt) {
  if (!ref) return;
  pending++;
  status(navigator.onLine ? "Saving…" : "Saved offline, will sync", false);
  try {
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: mergeIt });
    pending--;
    if (!pending) { status("Backed up", true); if (user) setInStep(user.uid); }
  } catch (e) {
    pending--;
    status("Not backed up", false);
    app.toast(e && e.code === "permission-denied" ? "Cloud backup is not set up yet." : "Couldn't back up just now. Will retry on your next tick.");
  }
}

// Called by the app after every local change.
window.onResetChange = (change, state) => {
  setInStep(null);
  if (!user) return;
  if (change && change.day) write({ days: { [change.day]: state.days[change.day] || [] } }, true);
  else if (change && change.reports) write({ reports: state.reports || [] }, true);
  else if (change && change.steps) write({ steps: { [change.steps]: (state.steps || {})[change.steps] ?? null } }, true);
  else if (change && change.walks) write({ walks: state.walks || [] }, true);
  else if (change && change.profile) write({ profile: state.profile || {} }, true);
  else if (change && change.plan) write({ plan: state.plan || {} }, true);
  else if (change && change.body) write({ body: { [change.body]: (state.body || {})[change.body] ?? null } }, true);
  else if (change && change.water) write({ water: { [change.water]: (state.water || {})[change.water] || 0 } }, true);
  else if (change && change.start) write({ start: state.start }, true);
  else write({ start: state.start, days: state.days, water: state.water || {}, reports: state.reports || [], steps: state.steps || {}, walks: state.walks || [], profile: state.profile || {}, plan: state.plan || {}, body: state.body || {} }, false);
};

async function startSync(u) {
  ref = doc(db, "users", u.uid);
  status("Syncing…", false);
  try {
    const snap = await getDoc(ref);
    const local = app.getState();
    const d0 = snap.exists() ? snap.data() : null;
    const cloud = d0 ? { start: d0.start, days: d0.days || {}, water: d0.water || {}, reports: d0.reports || [], steps: d0.steps || {}, walks: d0.walks || [], profile: d0.profile || {}, plan: d0.plan || {}, body: d0.body || {} } : { start: local.start, days: {}, water: {}, reports: [], steps: {}, walks: [], profile: {}, plan: {}, body: {} };
    const merged = snap.exists() && inStep(u.uid) ? cloud : merge(local, cloud);
    if (!snap.exists() || !same(merged, cloud)) await write(merged, false);
    app.applyRemote(merged);
    setInStep(u.uid);
    status("Backed up", true);
  } catch (e) {
    status("Not backed up", false);
    app.toast(e && e.code === "permission-denied" ? "Cloud backup is not set up yet." : "Couldn't reach your backup. Your ticks are still saved on this phone.");
    return;
  }
  unsub = onSnapshot(ref, snap => {
    if (!snap.exists() || snap.metadata.hasPendingWrites) return;
    const d = snap.data();
    const next = { start: d.start, days: d.days || {}, water: d.water || {}, reports: d.reports || [], steps: d.steps || {}, walks: d.walks || [], profile: d.profile || {}, plan: d.plan || {}, body: d.body || {} };
    if (!same(next, app.getState())) app.applyRemote(next);
    if (!pending) setInStep(user && user.uid);
    if (!pending) status(snap.metadata.fromCache ? "Saved offline, will sync" : "Backed up", !snap.metadata.fromCache);
  }, () => status("Not backed up", false));
}

onAuthStateChanged(auth, u => {
  if (unsub) { unsub(); unsub = null; }
  ref = null; user = u; showAccount();
  app.setName(u && u.displayName ? u.displayName.split(" ")[0] : "");
  if (u) startSync(u);
});

getRedirectResult(auth).catch(e => app.toast("Sign-in didn't finish. Please try again."));

$("signIn").addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    await signInWithPopup(auth, provider);
    app.toast("Signed in");
  } catch (e) {
    const code = e && e.code;
    console.warn("sign-in failed:", code);
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      signInWithRedirect(auth, provider);
    } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
      app.toast(code === "auth/unauthorized-domain" ? "This web address isn't allowed in Firebase yet." : "Sign-in didn't work. Please try again.");
    }
  }
});
$("signOut").addEventListener("click", async () => {
  await signOut(auth);
  app.toast("Signed out. Your progress stays on this phone.");
});

window.addEventListener("online", () => { if (user && !pending) status("Backed up", true); });
window.addEventListener("offline", () => { if (user) status("Offline, will sync later", false); });
