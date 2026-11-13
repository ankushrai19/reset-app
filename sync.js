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
  const cloudHasData = Object.values(cloud.days || {}).some(a => a.length);
  return { start: cloudHasData ? cloud.start : (local.start || cloud.start), days, water, reports };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function write(data, mergeIt) {
  if (!ref) return;
  pending++;
  status(navigator.onLine ? "Saving…" : "Saved offline, will sync", false);
  try {
    await setDoc(ref, { ...data, updatedAt: serverTimestamp() }, { merge: mergeIt });
    pending--;
    if (!pending) status("Backed up", true);
  } catch (e) {
    pending--;
    status("Not backed up", false);
    app.toast(e && e.code === "permission-denied" ? "Cloud backup is not set up yet." : "Couldn't back up just now. Will retry on your next tick.");
  }
}

// Called by the app after every local change.
window.onResetChange = (change, state) => {
  if (!user) return;
  if (change && change.day) write({ days: { [change.day]: state.days[change.day] || [] } }, true);
  else if (change && change.reports) write({ reports: state.reports || [] }, true);
  else if (change && change.water) write({ water: { [change.water]: (state.water || {})[change.water] || 0 } }, true);
  else if (change && change.start) write({ start: state.start }, true);
  else write({ start: state.start, days: state.days, water: state.water || {}, reports: state.reports || [] }, false);
};

async function startSync(u) {
  ref = doc(db, "users", u.uid);
  status("Syncing…", false);
  try {
    const snap = await getDoc(ref);
    const local = app.getState();
    const cloud = snap.exists() ? { start: snap.data().start, days: snap.data().days || {}, water: snap.data().water || {}, reports: snap.data().reports || [] } : { start: local.start, days: {}, water: {}, reports: [] };
    const merged = merge(local, cloud);
    if (!snap.exists() || !same(merged, cloud)) await write(merged, false);
    app.applyRemote(merged);
    status("Backed up", true);
  } catch (e) {
    status("Not backed up", false);
    app.toast(e && e.code === "permission-denied" ? "Cloud backup is not set up yet." : "Couldn't reach your backup. Your ticks are still saved on this phone.");
    return;
  }
  unsub = onSnapshot(ref, snap => {
    if (!snap.exists() || snap.metadata.hasPendingWrites) return;
    const d = snap.data();
    const next = { start: d.start, days: d.days || {}, water: d.water || {}, reports: d.reports || [] };
    if (!same(next, app.getState())) app.applyRemote(next);
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
