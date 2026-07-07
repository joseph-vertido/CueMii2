/**
 * Cloud Sync Hook for CueMii
 * Handles automatic and manual syncing with Firebase
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  isInitialized as firebaseInitialized,
  twoWaySync,
  syncPlayersToCloud,
  checkOnlineStatus
} from '../utils/firebase';

// Sync status enum
export const SYNC_STATUS = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
  OFFLINE: 'offline',
  NOT_CONFIGURED: 'not_configured'
};

export const useCloudSync = (players, setPlayers, enabled = true) => {
  const [syncStatus, setSyncStatus] = useState(SYNC_STATUS.IDLE);
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    const saved = localStorage.getItem('baddixx_lastSyncTime');
    return saved ? parseInt(saved) : null;
  });
  const [syncError, setSyncError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const pendingSyncRef = useRef(false);
  const playersRef = useRef(players);
  
  // Keep players ref updated
  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Trigger sync when coming back online
      if (enabled && pendingSyncRef.current) {
        performSync();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus(SYNC_STATUS.OFFLINE);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [enabled]);

  // Check Firebase initialization
  useEffect(() => {
    if (!firebaseInitialized) {
      setSyncStatus(SYNC_STATUS.NOT_CONFIGURED);
    }
  }, []);

  // Perform sync
  const performSync = useCallback(async () => {
    if (!firebaseInitialized) {
      setSyncStatus(SYNC_STATUS.NOT_CONFIGURED);
      setSyncError('Firebase not configured. Please update firebase.js with your config.');
      return { success: false, error: 'Not configured' };
    }

    if (!checkOnlineStatus()) {
      setSyncStatus(SYNC_STATUS.OFFLINE);
      pendingSyncRef.current = true;
      return { success: false, error: 'Offline' };
    }

    try {
      setSyncStatus(SYNC_STATUS.SYNCING);
      setSyncError(null);
      
      const result = await twoWaySync(playersRef.current, setPlayers);
      
      const now = Date.now();
      setLastSyncTime(now);
      localStorage.setItem('baddixx_lastSyncTime', now.toString());
      
      setSyncStatus(SYNC_STATUS.SUCCESS);
      pendingSyncRef.current = false;
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSyncStatus(SYNC_STATUS.IDLE);
      }, 3000);
      
      return { success: true, result };
    } catch (error) {
      console.error('Sync error:', error);
      setSyncError(error.message);
      setSyncStatus(SYNC_STATUS.ERROR);
      
      // Reset to idle after 5 seconds
      setTimeout(() => {
        setSyncStatus(SYNC_STATUS.IDLE);
      }, 5000);
      
      return { success: false, error: error.message };
    }
  }, [setPlayers]);

  // Auto-sync at most once every 2 hours while enabled. Manual performSync
  // (the "Sync Now" button) is unaffected and always syncs immediately.
  const AUTO_SYNC_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

  useEffect(() => {
    if (!enabled || !firebaseInitialized) return;

    let intervalId;
    const initialTimer = setTimeout(() => {
      // On load, only sync if the last sync was more than 2 hours ago.
      const stale = !lastSyncTime || (Date.now() - lastSyncTime) >= AUTO_SYNC_INTERVAL_MS;
      if (checkOnlineStatus() && stale) performSync();

      // Then sync on a 2-hour cadence.
      intervalId = setInterval(() => {
        if (checkOnlineStatus()) performSync();
      }, AUTO_SYNC_INTERVAL_MS);
    }, 2000);

    return () => {
      clearTimeout(initialTimer);
      if (intervalId) clearInterval(intervalId);
    };
    // lastSyncTime intentionally read once at mount for the staleness check.
  }, [enabled, performSync]);

  // Format last sync time
  const getLastSyncDisplay = () => {
    if (!lastSyncTime) return 'Never';
    
    const diff = Date.now() - lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return {
    syncStatus,
    lastSyncTime,
    lastSyncDisplay: getLastSyncDisplay(),
    syncError,
    isOnline,
    performSync,
    isFirebaseConfigured: firebaseInitialized
  };
};

export default useCloudSync;
