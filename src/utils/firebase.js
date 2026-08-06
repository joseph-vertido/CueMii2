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

// Firebase configuration for CueMii Database
const firebaseConfig = {
  apiKey: "AIzaSyAHgH2IFI6kMs6jZgIHckbKuGazJ6rL17g",
  authDomain: "cuemii-database.firebaseapp.com",
  projectId: "cuemii-database",
  storageBucket: "cuemii-database.firebasestorage.app",
  messagingSenderId: "129349819856",
  appId: "1:129349819856:web:83522e76bb1fcb78c9add5",
  measurementId: "G-YBZDH11K3T"
};

// Initialize Firebase
let app = null;
let db = null;
let isInitialized = false;
let initError = null;

try {
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
  console.error('Firebase initialization error:', error);
  initError = error;
}

export { db, isInitialized, initError };

/**
 * Sync player database to cloud
 */
export const syncPlayersToCloud = async (localPlayers) => {
  if (!db || !isInitialized) {
    throw new Error('Firebase not initialized');
  }

  const batch = writeBatch(db);
  const playersRef = collection(db, 'players');
  
  // Get existing cloud players to detect deletions
  const cloudSnapshot = await getDocs(playersRef);
  const cloudPlayerIds = new Set(cloudSnapshot.docs.map(doc => doc.id));
  const localPlayerIds = new Set(localPlayers.map(p => p.id.toString()));
  
  // Delete players that exist in cloud but not locally
  for (const cloudId of cloudPlayerIds) {
    if (!localPlayerIds.has(cloudId)) {
      batch.delete(doc(db, 'players', cloudId));
    }
  }
  
  // Add/update local players to cloud
  for (const player of localPlayers) {
    const playerDoc = doc(db, 'players', player.id.toString());
    batch.set(playerDoc, {
      ...player,
      updatedAt: serverTimestamp(),
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
export const twoWaySync = async (localPlayers, setPlayers) => {
  if (!db || !isInitialized) {
    throw new Error('Firebase not initialized');
  }

  // Fetch cloud players
  const cloudPlayers = await fetchPlayersFromCloud();
  
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
  const byName = new Map();
  const unnamed = [];
  for (const p of mergedPlayers) {
    const key = (p.name || '').trim().toLowerCase();
    if (!key) { unnamed.push(p); continue; }
    const existing = byName.get(key);
    if (!existing || (p.updatedAt || 0) > (existing.updatedAt || 0)) {
      byName.set(key, p);
    }
  }
  const finalPlayers = [...byName.values(), ...unnamed];

  if (finalPlayers.length !== mergedPlayers.length) {
    console.warn(`[sync] collapsed ${mergedPlayers.length} -> ${finalPlayers.length} players by name (local=${localPlayers.length}, cloud=${cloudPlayers.length})`);
  }

  // Update local state
  setPlayers(finalPlayers);

  // Push cleaned data back to cloud (removes any extra cloud copies)
  await syncPlayersToCloud(finalPlayers);

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

  // Upsert local enrollments. Each entry is { template, player }.
  for (const [playerId, entry] of Object.entries(fingerprintsMap)) {
    if (!entry) continue;
    const template = typeof entry === 'string' ? entry : entry.template;
    const player = typeof entry === 'string' ? null : (entry.player || null);
    if (!template) continue;
    const enrolledAt = typeof entry === 'string' ? null : (entry.enrolledAt || null);
    batch.set(doc(db, 'fingerprints', playerId.toString()), {
      template,
      player,
      enrolledAt,          // when the print was captured, for newest-wins merges
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
    if (data && data.template) {
      // enrolledAt must survive the round trip, or every merge would see 0.
      map[d.id] = { template: data.template, player: data.player || null, enrolledAt: data.enrolledAt || 0 };
    }
  });
  return map;
};
