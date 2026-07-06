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
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    // Convert Firestore timestamps to regular dates/numbers
    return {
      ...data,
      id: parseInt(doc.id) || doc.id,
      updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt,
      syncedAt: data.syncedAt?.toMillis?.() || data.syncedAt
    };
  });
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
  
  // Update local state
  setPlayers(mergedPlayers);
  
  // Push merged data back to cloud
  await syncPlayersToCloud(mergedPlayers);
  
  return {
    totalPlayers: mergedPlayers.length,
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
