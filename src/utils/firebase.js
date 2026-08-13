/**
 * Firebase Configuration for CueMii Cloud Sync
 * 
 * To set up:
 * 1. Go to Firebase Console > Project Settings > Your Apps
 * 2. Add a Web App if you haven't already
 * 3. Copy the firebaseConfig values below
 */

import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  enableIndexedDbPersistence,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

// Firebase configuration for CueMii Database.
//
// Read from the environment rather than written here. A Firebase web API key
// isn't a credential — it identifies the project and is visible in any browser
// that loads the app — but automated secret scanners flag the "AIza..." pattern
// on sight, which fails the deploy. Keeping it out of the source avoids that,
// and means a different project can be pointed at without editing code.
//
// Local development: put these in a .env file (see .env.example).
// Netlify: set them under Site settings > Environment variables.
// The fallbacks keep existing local installs working with no setup.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "cuemii-database.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "cuemii-database",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "cuemii-database.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "129349819856",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "",
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || "G-YBZDH11K3T"
};

// Initialize Firebase
let app = null;
let db = null;
let isInitialized = false;
let initError = null;

// With no API key there is nothing to connect to, so don't try: initialising
// without one throws, and the app should simply run locally instead.
const hasConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

if (!hasConfig) {
  // Not an error: the app is designed to run without cloud sync, keeping
  // everything locally. Reported as a notice so it doesn't look like a fault.
  console.info(
    'CueMii: cloud sync is off (no Firebase settings found). ' +
    'To enable it, copy .env.example to .env, fill in the values, and restart ' +
    'the dev server — .env is only read at startup.'
  );
}

try {
  if (!hasConfig) {
    throw new Error('NO_CONFIG');
  }
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  
  // Enable offline persistence
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('Firebase persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firebase persistence not available in this browser');
    }
  });
  
  isInitialized = true;
} catch (error) {
  // A missing configuration has already been explained above; anything else is
  // a genuine failure worth surfacing.
  if (error && error.message !== 'NO_CONFIG') {
    console.error('Firebase initialization error:', error);
  }
  initError = error;
}

export { db, isInitialized, initError };

/**
 * Sync player database to cloud
 */
/**
 * Push the local player set to the cloud.
 *
 * @param {Array} localPlayers - live players
 * @param {Object} deletedPlayers - { [id]: { id, name, deletedAt } } tombstones.
 *   These are written as records marked deleted rather than removed, so other
 *   machines learn that the player was deleted. Without them, a machine that
 *   still has the player would treat it as one the cloud is missing and upload
 *   it again — resurrecting it.
 */
export const syncPlayersToCloud = async (localPlayers, deletedPlayers = {}) => {
  if (!db || !isInitialized) {
    throw new Error('Firebase not initialized');
  }

  const batch = writeBatch(db);
  const playersRef = collection(db, 'players');
  
  // Get existing cloud players to detect deletions
  const cloudSnapshot = await getDocs(playersRef);
  const cloudPlayerIds = new Set(cloudSnapshot.docs.map(doc => doc.id));
  const localPlayerIds = new Set(localPlayers.map(p => p.id.toString()));
  
  const deletedIds = new Set(Object.keys(deletedPlayers).map(String));

  // Remove cloud records this machine knows nothing about. Anything we hold a
  // deletion marker for is written below instead, so the deletion travels.
  for (const cloudId of cloudPlayerIds) {
    if (!localPlayerIds.has(cloudId) && !deletedIds.has(cloudId)) {
      batch.delete(doc(db, 'players', cloudId));
    }
  }

  // Add/update local players to cloud
  for (const player of localPlayers) {
    const playerDoc = doc(db, 'players', player.id.toString());
    batch.set(playerDoc, {
      ...player,
      deleted: false,
      // Written explicitly rather than left off. batch.set replaces the whole
      // document, so omitting it would drop the field entirely and make a live
      // record look different in shape from a deleted one.
      deletedAt: 0,
      updatedAt: player.updatedAt || Date.now(),
      syncedAt: serverTimestamp()
    });
  }

  // Write the deletion markers.
  for (const [id, tombstone] of Object.entries(deletedPlayers)) {
    batch.set(doc(db, 'players', id.toString()), {
      id: tombstone.id ?? (parseInt(id, 10) || id),
      name: tombstone.name || '',
      deleted: true,
      deletedAt: tombstone.deletedAt || Date.now(),
      updatedAt: tombstone.deletedAt || Date.now(),
      syncedAt: serverTimestamp()
    });
  }
  
  await batch.commit();
  return localPlayers.length;
};

/**
 * Fetch players from cloud
 */
export const fetchPlayersFromCloud = async () => {
  if (!db || !isInitialized) {
    throw new Error('Firebase not initialized');
  }

  const playersRef = collection(db, 'players');
  const q = query(playersRef, orderBy('name'));
  const snapshot = await getDocs(q);

  const result = snapshot.docs.map(doc => {
    const data = doc.data();
    // Convert Firestore timestamps to regular dates/numbers
    return {
      ...data,
      id: parseInt(doc.id) || doc.id,
      // Deleted records come back too, so the merge can apply the deletion here.
      deleted: data.deleted === true,
      deletedAt: data.deletedAt?.toMillis?.() || data.deletedAt || 0,
      updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt,
      syncedAt: data.syncedAt?.toMillis?.() || data.syncedAt
    };
  });

  const uniqueNames = new Set(result.map(p => (p.name || '').trim().toLowerCase())).size;
  console.log(`[sync] fetched ${result.length} cloud docs, ${uniqueNames} unique names`);
  return result;
};

/**
 * Two-way sync: merge local and cloud data
 * Strategy: Last-write-wins based on updatedAt timestamp
 */
/**
 * Merge the local and cloud player sets.
 *
 * @param {Array} localPlayers - live players on this machine
 * @param {Function} setPlayers
 * @param {Object} localDeleted - { [id]: { id, name, deletedAt } }
 * @param {Function} setDeleted
 */
export const twoWaySync = async (localPlayers, setPlayers, localDeleted = {}, setDeleted = null) => {
  if (!db || !isInitialized) {
    throw new Error('Firebase not initialized');
  }

  // Fetch cloud players
  const cloudRecords = await fetchPlayersFromCloud();
  const cloudPlayers = cloudRecords.filter(p => !p.deleted);

  // Deletion markers from both sides, newest kept per id.
  const tombstones = { ...localDeleted };
  for (const rec of cloudRecords) {
    if (!rec.deleted) continue;
    const id = rec.id.toString();
    const existing = tombstones[id];
    const cloudTime = rec.deletedAt || rec.updatedAt || 0;
    if (!existing || cloudTime > (existing.deletedAt || 0)) {
      tombstones[id] = { id: rec.id, name: rec.name || '', deletedAt: cloudTime };
    }
  }

  // Create maps for easy lookup
  const localMap = new Map(localPlayers.map(p => [p.id.toString(), p]));
  const cloudMap = new Map(cloudPlayers.map(p => [p.id.toString(), p]));
  
  const mergedPlayers = [];
  const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);
  
  for (const id of allIds) {
    const local = localMap.get(id);
    const cloud = cloudMap.get(id);
    
    if (local && cloud) {
      // Both exist - use the one with latest updatedAt
      const localTime = local.updatedAt || 0;
      const cloudTime = cloud.updatedAt || 0;
      mergedPlayers.push(localTime >= cloudTime ? local : cloud);
    } else if (local) {
      // Only exists locally - keep it
      mergedPlayers.push(local);
    } else if (cloud) {
      // Only exists in cloud - add it
      mergedPlayers.push(cloud);
    }
  }
  
  // Collapse by name. The app treats player names as unique, so if the same
  // person appears under more than one ID (across versions/devices), keep a
  // single entry (the most recently updated). This prevents the "two copies of
  // each player" duplication regardless of how it arises, and heals the cloud
  // on push.
  // One record per name, and — importantly — always the *same* id for that name
  // on every machine.
  //
  // Two browsers can each create the same person before either has synced, which
  // leaves two records with one name and different ids. Keeping whichever was
  // edited most recently isn't enough: it settles on the newer id and deletes the
  // older one, then the machine still holding the older id uploads it again on
  // its next sync, and the pair reappears.
  //
  // So the *oldest* id wins, since ids are creation timestamps and every machine
  // can agree on which is oldest without coordinating. The most recent details
  // are kept, but carried onto that id. The discarded ids are recorded as
  // deletions so they're removed from the cloud and stay removed.
  const byName = new Map();
  const unnamed = [];
  const supersededIds = {};

  for (const p of mergedPlayers) {
    const key = (p.name || '').trim().toLowerCase();
    if (!key) { unnamed.push(p); continue; }

    const existing = byName.get(key);
    if (!existing) { byName.set(key, p); continue; }

    // Newest details...
    const newer = (p.updatedAt || 0) > (existing.updatedAt || 0) ? p : existing;
    const older = newer === p ? existing : p;

    // ...under the oldest id.
    const keepId = Number(older.id) < Number(newer.id) ? older.id : newer.id;
    const dropId = keepId === older.id ? newer.id : older.id;

    if (String(dropId) !== String(keepId)) {
      supersededIds[String(dropId)] = {
        id: dropId,
        name: newer.name || older.name || '',
        deletedAt: Date.now(),
      };
    }

    byName.set(key, { ...newer, id: keepId });
  }

  let finalPlayers = [...byName.values(), ...unnamed];

  // Apply the deletion markers. A player stays deleted unless they were edited
  // or re-created after the deletion — that later timestamp is what allows a
  // re-added player to come back rather than being wiped again on every sync.
  const survivingTombstones = {};
  finalPlayers = finalPlayers.filter(p => {
    const mark = tombstones[p.id.toString()];
    if (!mark) return true;
    if ((p.updatedAt || 0) > (mark.deletedAt || 0)) return true; // re-added since
    survivingTombstones[p.id.toString()] = mark;
    return false;
  });
  // Keep markers for players nobody holds any more, so the deletion keeps
  // propagating to machines that haven't synced yet.
  for (const [id, mark] of Object.entries(tombstones)) {
    if (!finalPlayers.some(p => p.id.toString() === id)) survivingTombstones[id] = mark;
  }

  // Discarded duplicate ids are treated the same way as deletions, so the cloud
  // copy is removed and no machine can bring it back.
  for (const [id, mark] of Object.entries(supersededIds)) {
    if (!finalPlayers.some(p => p.id.toString() === id)) survivingTombstones[id] = mark;
  }
  if (setDeleted) setDeleted(survivingTombstones);

  if (finalPlayers.length !== mergedPlayers.length) {
    console.warn(`[sync] collapsed ${mergedPlayers.length} -> ${finalPlayers.length} players by name (local=${localPlayers.length}, cloud=${cloudPlayers.length})`);
  }

  // Update local state
  setPlayers(finalPlayers);

  // Push cleaned data back to cloud (removes any extra cloud copies)
  await syncPlayersToCloud(finalPlayers, survivingTombstones);

  return {
    totalPlayers: finalPlayers.length,
    fromCloud: cloudPlayers.length,
    fromLocal: localPlayers.length
  };
};

/**
 * Check if online
 */
export const checkOnlineStatus = () => {
  return navigator.onLine;
};

/**
 * ---------------------------------------------------------------------------
 * Fingerprint templates (biometric enrollment data)
 * ---------------------------------------------------------------------------
 * Stores one enrollment template (FMD, base64) per player in the `fingerprints`
 * collection: doc id = playerId, { template, updatedAt }.
 *
 * ⚠️ SECURITY / PRIVACY: fingerprint templates are sensitive biometric data.
 * Before enabling this, lock down Firestore rules so the `fingerprints`
 * collection is NOT world-readable (require auth), and make sure you have
 * consent to store biometric data (GDPR special-category / BIPA etc.).
 * Templates here are minutiae data, not images, but are still personal data.
 */

// map: { [playerId]: templateBase64 }
export const syncFingerprintsToCloud = async (fingerprintsMap) => {
  if (!db || !isInitialized) {
    throw new Error('Firebase not initialized');
  }

  const batch = writeBatch(db);
  const ref = collection(db, 'fingerprints');

  const cloudSnapshot = await getDocs(ref);
  const cloudIds = new Set(cloudSnapshot.docs.map((d) => d.id));
  const localIds = new Set(Object.keys(fingerprintsMap));

  // Remove enrollments deleted locally
  for (const cloudId of cloudIds) {
    if (!localIds.has(cloudId)) {
      batch.delete(doc(db, 'fingerprints', cloudId));
    }
  }

  // Upsert local enrollments. Each entry is { template, player, enrolledAt }.
  //
  // An entry with no template is a deletion marker: the print was removed here,
  // and the record is kept so other machines learn about it. Without that they'd
  // see a player missing from the cloud, assume their own copy was newer, and
  // upload it again — undoing the delete.
  for (const [playerId, entry] of Object.entries(fingerprintsMap)) {
    if (!entry) continue;
    const template = typeof entry === 'string' ? entry : (entry.template || null);
    const player = typeof entry === 'string' ? null : (entry.player || null);
    const enrolledAt = typeof entry === 'string' ? null : (entry.enrolledAt || null);
    batch.set(doc(db, 'fingerprints', playerId.toString()), {
      template,            // null marks a deleted print
      player,
      enrolledAt,          // when captured or removed, for newest-wins merges
      updatedAt: serverTimestamp(),
    });
  }

  await batch.commit();
  return Object.keys(fingerprintsMap).length;
};


/**
 * Merge two fingerprint maps, keeping whichever template was enrolled most
 * recently for each player.
 *
 * Both sides are kept when a player only exists on one of them, so nothing is
 * lost. Where both hold a template for the same player, the newer `enrolledAt`
 * wins — previously the local copy always won, which meant an older template
 * could silently overwrite a fresh re-enrolment made on another machine.
 *
 * An entry with no template is a deletion marker. It takes part in the same
 * comparison, so a delete beats an older enrolment and an enrolment made after
 * the delete beats the marker.
 *
 * Entries predating this change have no timestamp. Those are treated as older
 * than any stamped entry, so a re-enrolment always takes precedence; if neither
 * side has one, the local copy is kept, matching the old behaviour.
 */
export const mergeFingerprintsByRecency = (cloudMap = {}, localMap = {}) => {
  const merged = { ...cloudMap };
  for (const [playerId, localEntry] of Object.entries(localMap)) {
    if (!localEntry) continue;
    const cloudEntry = merged[playerId];
    if (!cloudEntry) {
      merged[playerId] = localEntry;
      continue;
    }
    const localTime = localEntry.enrolledAt || 0;
    const cloudTime = cloudEntry.enrolledAt || 0;
    merged[playerId] = cloudTime > localTime ? cloudEntry : localEntry;
  }
  return merged;
};

// returns { [playerId]: templateBase64 }
export const fetchFingerprintsFromCloud = async () => {
  if (!db || !isInitialized) {
    throw new Error('Firebase not initialized');
  }
  const snapshot = await getDocs(collection(db, 'fingerprints'));
  const map = {};
  snapshot.docs.forEach((d) => {
    const data = d.data();
    if (!data) return;
    // Records with no template are deletion markers and must be read back too,
    // so the merge can apply the deletion here.
    if (data.template || data.enrolledAt) {
      // enrolledAt must survive the round trip, or every merge would see 0.
      map[d.id] = {
        template: data.template || null,
        player: data.player || null,
        enrolledAt: data.enrolledAt || 0,
      };
    }
  });
  return map;
};
