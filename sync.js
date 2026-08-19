// Live sync bridge: localStorage <-> Firestore.
// Loaded as a separate module from app.js on purpose — if the Firebase CDN
// can't be reached (no signal on a cold load), this whole file just fails
// to import and the trip app keeps working exactly as before, offline,
// via localStorage + the "Share trip data" link.

const STORAGE_KEY = "chdp-trip-state-v1";
const TRIP_DOC_ID = "of-f5YraBhEQh6xj"; // unguessable id — this doubles as the "passcode"

const firebaseConfig = {
  apiKey: "AIzaSyAMS1XvKJrX6rlFivhFXjeJhlkHLOKWnSs",
  authDomain: "crown-hill-trip.firebaseapp.com",
  projectId: "crown-hill-trip",
  storageBucket: "crown-hill-trip.firebasestorage.app",
  messagingSenderId: "707703005324",
  appId: "1:707703005324:web:d8b2d5aad836822bdc5ba9",
};

try {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js");
  const {
    getFirestore, doc, setDoc, onSnapshot, enableIndexedDbPersistence,
  } = await import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js");

  const fbApp = initializeApp(firebaseConfig);
  const db = getFirestore(fbApp);
  try { await enableIndexedDbPersistence(db); } catch (e) { /* fine — falls back to memory-only cache */ }
  const tripRef = doc(db, "trips", TRIP_DOC_ID);

  let applyingRemote = false;

  onSnapshot(tripRef, (snap) => {
    if (!snap.exists()) {
      // Nothing in Firestore yet — seed it from whatever's already on this device.
      const local = localStorage.getItem(STORAGE_KEY);
      setDoc(tripRef, local ? JSON.parse(local) : {}).catch(() => {});
      return;
    }
    const incoming = JSON.stringify(snap.data());
    const current = localStorage.getItem(STORAGE_KEY);
    if (incoming === current) return; // our own write echoing back — nothing to do

    applyingRemote = true;
    localStorage.setItem(STORAGE_KEY, incoming);
    window.dispatchEvent(new Event("chdp:remote-update"));
    applyingRemote = false;
  }, (err) => {
    console.warn("Trip sync listener error (app still works offline):", err);
  });

  window.addEventListener("chdp:local-write", () => {
    if (applyingRemote) return; // don't immediately echo a remote write straight back to Firestore
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    setDoc(tripRef, JSON.parse(raw)).catch((e) => {
      console.warn("Trip sync write failed (likely offline — Firestore will retry once back online):", e);
    });
  });
} catch (e) {
  console.warn("Live sync unavailable — the app still works offline via Share trip data.", e);
}
