import React, { useState, useEffect, useRef, useMemo } from 'react';
import AlertDialog from './components/AlertDialog';
import { flyPlayerToMatch, flyPlayersToMatch, flyMatchToCourt, flyPlayersToCourt, flyPlayersToPool, flyPlayerGroup, animateCardSwap } from './utils/flyAnimation';
import { skipNextFlip } from './hooks/useFlipList';
import { showAlert, showConfirm, showPrompt } from './utils/appAlert';
import { initialPlayers, initialCourts } from './data/initialData';
import useCurrentTime from './hooks/useCurrentTime';
import useLocalStorage from './hooks/useLocalStorage';
import useCloudSync, { SYNC_STATUS } from './hooks/useCloudSync';
import { syncFingerprintsToCloud, fetchFingerprintsFromCloud, syncPlayersToCloud, fetchPlayersFromCloud, mergeFingerprintsByRecency } from './utils/firebase';
import { replaceEnrollments, importEnrollments } from './utils/fingerprintService';
import {
  Header,
  PlayerDatabaseModal,
  PlayerPool,
  MatchQueue,
  CourtsPanel,
  MatchHistoryModal,
  LicenseEntryModal,
  AboutModal,
  ReportsModal,
  SettingsModal,
  FingerprintController
} from './components';
import { 
  validateLicense, 
  loadLicense, 
  isLicenseExpired,
  clearLicense 
} from './utils/licenseUtils';

/**
 * Main Baddixx Queuing System Application
 */
// Password required to run destructive resets (Reset Day, Reset FP).
const RESET_PASSWORD = '0067006700';
const requireResetPassword = async () => {
  const pw = await showPrompt('Enter password to continue:', { password: true });
  if (pw === null) return false; // cancelled
  if (pw !== RESET_PASSWORD) {
    showAlert('Incorrect password.');
    return false;
  }
  return true;
};

function App() {
  // License State
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [isLicenseValid, setIsLicenseValid] = useState(false);
  const [isLicenseExpiredState, setIsLicenseExpiredState] = useState(false);
  const [isCheckingLicense, setIsCheckingLicense] = useState(true);

  // Theme State
  // Theme: 'light' | 'dark' | 'neon'. Neon is a dark variant, so isDarkMode
  // stays true for it and every component's existing dark styling applies;
  // the neon look is layered on top via CSS scoped to the .neon class.
  const [theme, setTheme] = useLocalStorage('baddixx_theme', 'dark');
  const isDarkMode = theme !== 'light';
  const cycleTheme = () => setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'neon' : 'light');
  
  // Persistent State (saved to localStorage)
  const [players, setPlayers] = useLocalStorage('baddixx_players', initialPlayers);
  const [poolPlayers, setPoolPlayers] = useLocalStorage('baddixx_pool', []);
  const [notPresentPlayers, setNotPresentPlayers] = useLocalStorage('baddixx_notPresent', []); // Players added but not yet available
  // Fingerprint enrollments: { [playerId]: string[] } (captured samples/templates)
  const [fingerprints, setFingerprints] = useLocalStorage('baddixx_fingerprints', {});
  const [matches, setMatches] = useLocalStorage('baddixx_matches', []);
  const [courts, setCourts] = useLocalStorage('baddixx_courts', initialCourts);
  const [nextMatchNumber, setNextMatchNumber] = useLocalStorage('baddixx_nextMatchNumber', 1);
  const [matchHistory, setMatchHistory] = useLocalStorage('baddixx_matchHistory', []);
  const [waitTimeHistory, setWaitTimeHistory] = useLocalStorage('baddixx_waitTimeHistory', []); // Track wait times when transferred to court
  const [warningSettings, setWarningSettings] = useLocalStorage('baddixx_warningSettings', {
    noviceOverMatchThreshold: 4,  // Warn when non-novice has played with novices this many times
    noviceToNoviceThreshold: 8,   // Warn when novice has played with this many novices
    repeatPairingsThreshold: 4    // Warn when players have played together this many times
  });
  const [lastSessionDate, setLastSessionDate] = useLocalStorage('baddixx_lastSessionDate', null);
  const [matchReservations, setMatchReservations] = useLocalStorage('baddixx_matchReservations', {}); // Track reserved slots: { matchId: { slotIndex: player } }
  const [cloudSyncEnabled, setCloudSyncEnabled] = useLocalStorage('baddixx_cloudSyncEnabled', false);
  
  // Cloud Sync Hook
  const {
    syncStatus,
    lastSyncDisplay,
    syncError,
    isOnline,
    performSync,
    isFirebaseConfigured
  } = useCloudSync(players, setPlayers, cloudSyncEnabled);
  
  // UI State (not persisted)
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [poolSearch, setPoolSearch] = useState('');
  const [poolLevelFilter, setPoolLevelFilter] = useState('All');
  const [selectedMatchId, setSelectedMatchId] = useState(null);
  const [newCourtName, setNewCourtName] = useState('');
  const [editingCourtId, setEditingCourtId] = useState(null);
  const [editingCourtName, setEditingCourtName] = useState('');
  const [lastSmartMatch, setLastSmartMatch] = useState(null); // For undo functionality
  const [lastSmartQueueAll, setLastSmartQueueAll] = useState(null); // For undo Smart Queue All
  const [smartMatchedPlayers, setSmartMatchedPlayers] = useState({}); // Track when players were smart matched: { playerId: timestamp }
  const [removedWhileOnCourt, setRemovedWhileOnCourt] = useState(new Set()); // Track players removed while on court
  const [returnedMatches, setReturnedMatches] = useState({}); // Track when matches were returned from court: { matchId: timestamp }
  const [highlightedPriorityMatches, setHighlightedPriorityMatches] = useState({}); // Track matches highlighted for priority: { matchId: timestamp }
  const [lastEndedMatch, setLastEndedMatch] = useState(null); // For undo end match: { courtId, courtName, match, startTime, previousPoolPlayers, previousMatchHistory }
  const [scrollToCourtId, setScrollToCourtId] = useState(null); // For auto-scrolling to court when match is assigned
  const [scrollToMatchId, setScrollToMatchId] = useState(null); // Bring a match into view before players return to it

  // Bumped only when the queue should jump to its end: the Create button, and
  // the empty match added after the last one is filled. Matches appearing for
  // any other reason — returning from a court, Smart Queue All — leave the
  // scroll where it is.
  const [queueBottomToken, setQueueBottomToken] = useState(0);

  // The last group to leave each court, so a match returned and then sent
  // straight back can resume its timer rather than starting from zero.
  const lastCourtOccupancy = useRef({});
  
  // Panel resize state
  const [panelWidths, setPanelWidths] = useLocalStorage('baddixx_panelWidths', {
    playerPool: 450,
    courts: 280
  });
  const [isResizing, setIsResizing] = useState(null); // 'left' or 'right'
  const containerRef = useRef(null);
  
  // Handle panel resize
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;
      
      if (isResizing === 'left') {
        // Resizing between Player Pool and Match Queue
        const newWidth = Math.max(250, Math.min(600, mouseX - 12)); // 12px for gap
        setPanelWidths(prev => ({ ...prev, playerPool: newWidth }));
      } else if (isResizing === 'right') {
        // Resizing between Match Queue and Courts
        const newWidth = Math.max(200, Math.min(400, containerWidth - mouseX - 12));
        setPanelWidths(prev => ({ ...prev, courts: newWidth }));
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setPanelWidths]);
  
  const currentTime = useCurrentTime();

  // Check license on app load
  useEffect(() => {
    const storedLicense = loadLicense();
    if (storedLicense) {
      const result = validateLicense(storedLicense);
      if (result.isValid) {
        if (isLicenseExpired(result.expirationDate)) {
          setIsLicenseExpiredState(true);
          setIsLicenseValid(false);
          clearLicense();
        } else {
          setLicenseInfo(result);
          setIsLicenseValid(true);
        }
      }
    }
    setIsCheckingLicense(false);
  }, []);

  // Periodically check license expiration
  useEffect(() => {
    if (!licenseInfo?.expirationDate) return;
    
    const checkExpiration = () => {
      if (isLicenseExpired(licenseInfo.expirationDate)) {
        setIsLicenseExpiredState(true);
        setIsLicenseValid(false);
        clearLicense();
      }
    };
    
    const interval = setInterval(checkExpiration, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [licenseInfo]);

  // Auto-reset session data at start of new day
  useEffect(() => {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
    
    if (lastSessionDate && lastSessionDate !== today) {
      // It's a new day - reset session data
      console.log(`New day detected (${lastSessionDate} → ${today}). Auto-resetting session data.`);
      
      // Clear session data (same as resetAllData but without confirmation)
      setPoolPlayers([]);
      setNotPresentPlayers([]);
      setMatches([]);
      setCourts(initialCourts);
      setNextMatchNumber(1);
      setWaitTimeHistory([]);
      setMatchReservations({});
      
      // Reset UI state
      setSelectedMatchId(null);
      setPoolSearch('');
      setPoolLevelFilter('All');
    }
    
    // Update the last session date to today
    setLastSessionDate(today);
  }, []); // Only run once on mount - intentionally empty deps

  // Handle valid license entry
  const handleLicenseValid = (result) => {
    setLicenseInfo(result);
    setIsLicenseValid(true);
    setIsLicenseExpiredState(false);
  };

  // Handle license update from About modal
  const handleLicenseUpdate = (result) => {
    setLicenseInfo(result);
  };

  // Get visible players (limited by license)
  const getVisiblePlayers = () => {
    if (!licenseInfo?.maxPlayers) return players;
    return players.slice(0, licenseInfo.maxPlayers);
  };

  // Calculate average wait time (minimum 15 minutes)
  const averageWaitTime = React.useMemo(() => {
    if (waitTimeHistory.length === 0) return 15;
    const sum = waitTimeHistory.reduce((acc, time) => acc + time, 0);
    const avg = Math.round(sum / waitTimeHistory.length);
    return Math.max(15, avg);
  }, [waitTimeHistory]);

  // ==================== Auto-Create Matches (minimum 7 + auto-expand) ====================
  
  useEffect(() => {
    const MIN_MATCHES = 7;
    
    // Ensure minimum of 7 matches
    if (matches.length < MIN_MATCHES) {
      const matchesToCreate = MIN_MATCHES - matches.length;
      const newMatches = [];
      let currentMatchNumber = nextMatchNumber;
      
      for (let i = 0; i < matchesToCreate; i++) {
        newMatches.push({
          id: `match_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 9)}`,
          matchNumber: currentMatchNumber,
          players: [],
          createdAt: Date.now()
        });
        currentMatchNumber++;
      }
      
      setMatches(prev => [...prev, ...newMatches]);
      setNextMatchNumber(currentMatchNumber);
      return;
    }
    
    // If last match has at least 1 player, create a new empty match.
    // Held back until the player's card has finished flying in, so the new
    // match doesn't appear underneath an animation still in progress.
    const lastMatch = matches[matches.length - 1];
    if (lastMatch && lastMatch.players && lastMatch.players.length > 0) {
      const timer = setTimeout(() => {
        const newMatch = {
          id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          matchNumber: nextMatchNumber,
          players: [],
          createdAt: Date.now()
        };
        setMatches(prev => [...prev, newMatch]);
        setNextMatchNumber(prev => prev + 1);
        setQueueBottomToken(t => t + 1);
      }, 820);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [matches]);

  // ==================== Reset Function ====================
  
  const resetAllData = async () => {
    if (!(await requireResetPassword())) return;
    if (await showConfirm('Are you sure you want to reset the day?\n\nThis will clear:\n• Player Pool (Available & Not Present)\n• All Matches\n• Courts\n\nMatch History and Player Database will be preserved.')) {
      // Clear all persisted data except player database and match history
      setPoolPlayers([]);
      setNotPresentPlayers([]);
      setMatches([]);
      setCourts(initialCourts);
      setNextMatchNumber(1);
      setWaitTimeHistory([]);
      setMatchReservations({});
      
      // Reset UI state
      setSelectedMatchId(null);
      setPoolSearch('');
      setPoolLevelFilter('All');
      setNewCourtName('');
      setEditingCourtId(null);
      setEditingCourtName('');
    }
  };

  // ==================== Clear Idle Times ====================
  
  // Asks first, then resets everyone's wait time. Previously the confirmation
  // lived in the player pool alongside the button; the action moved to the
  // header menu, so the prompt came with it.
  const confirmClearIdleTimes = async () => {
    if (!(await requireResetPassword())) return;
    if (await showConfirm("Are you sure you want to clear all player idle times? This will reset everyone's wait time to now.")) {
      clearIdleTimes();
    }
  };

  const clearIdleTimes = () => {
    const now = Date.now();
    // Reset joinedAt for all pool players to current time
    setPoolPlayers(prev => prev.map(p => ({
      ...p,
      joinedAt: now
    })));
    // Also reset joinedAt for players already in matches
    setMatches(prev => prev.map(m => ({
      ...m,
      players: m.players.map(p => ({
        ...p,
        joinedAt: now
      }))
    })));
    // Also reset wait time history to reset average wait time to 15 minutes
    setWaitTimeHistory([]);
  };

  // ==================== Clear Match History ====================
  
  const clearMatchHistory = async () => {
    if (!(await requireResetPassword())) return;
    setMatchHistory([]);
  };

  // ==================== Player Database Functions ====================
  
  const addPlayer = (player) => {
    setPlayers(prev => [...prev, { ...player, updatedAt: Date.now() }]);
  };

  // Add a player and return the new id (used by the fingerprint assign dialog
  // so it can immediately enroll the finger to the freshly created player).
  const addPlayerReturningId = (player) => {
    const id = Date.now();
    setPlayers(prev => [...prev, { ...player, id, updatedAt: Date.now() }]);
    return id;
  };

  const importPlayers = (newPlayers, newFingerprints = {}) => {
    // Merge players, deduping by name and preserving imported IDs.
    const nameToId = new Map(players.map(p => [p.name.trim().toLowerCase(), p.id]));
    const uniqueNewPlayers = [];
    for (const np of newPlayers) {
      const key = np.name.trim().toLowerCase();
      if (!nameToId.has(key)) {
        uniqueNewPlayers.push(np);
        nameToId.set(key, np.id);
      }
    }
    if (uniqueNewPlayers.length > 0) {
      setPlayers(prev => [...prev, ...uniqueNewPlayers.map(p => ({ ...p, updatedAt: Date.now() }))]);
    }

    // Merge fingerprints, remapping each to the resolved player's id (by name),
    // so imported prints attach to the right player even if the name already
    // existed under a different id.
    const fpToAdd = {};
    for (const np of newPlayers) {
      const entry = newFingerprints[np.id] || newFingerprints[String(np.id)];
      if (!entry || !entry.template) continue;
      const targetId = nameToId.get(np.name.trim().toLowerCase()) || np.id;
      fpToAdd[targetId] = {
        template: entry.template,
        player: { id: targetId, name: np.name, gender: np.gender, level: np.level },
        // Imported templates keep their original time where the file has one,
        // so importing an old backup can't override a newer enrolment.
        enrolledAt: entry.enrolledAt || Date.now()
      };
    }

    if (Object.keys(fpToAdd).length > 0) {
      setFingerprints(prev => {
        const next = { ...prev, ...fpToAdd };
        importEnrollments(next); // seed the matching service (merge)
        if (cloudSyncEnabled && isFirebaseConfigured) {
          syncFingerprintsToCloud(next).catch(err =>
            console.warn('Fingerprint cloud sync failed:', err.message));
        }
        return next;
      });
    }
  };

  const editPlayer = (updatedPlayer) => {
    // Update in players database
    setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? { ...updatedPlayer, updatedAt: Date.now() } : p));
    // Update in pool players (preserve joinedAt)
    setPoolPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? { ...updatedPlayer, joinedAt: p.joinedAt } : p));
    // Update in not present players
    setNotPresentPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? { ...updatedPlayer } : p));
    // Update in matches
    setMatches(prev => prev.map(m => ({
      ...m,
      players: m.players.map(p => p.id === updatedPlayer.id ? { ...updatedPlayer } : p)
    })));
    // Update in courts (for active matches on courts)
    setCourts(prev => prev.map(c => {
      if (c.match && c.match.players) {
        return {
          ...c,
          match: {
            ...c.match,
            players: c.match.players.map(p => p.id === updatedPlayer.id ? { ...updatedPlayer } : p)
          }
        };
      }
      return c;
    }));
  };

  const deletePlayer = (playerId) => {
    setPlayers(prev => prev.filter(p => p.id !== playerId));
    setPoolPlayers(prev => prev.filter(p => p.id !== playerId));
    setNotPresentPlayers(prev => prev.filter(p => p.id !== playerId));
    setMatches(prev => prev.map(m => ({
      ...m,
      players: m.players.filter(p => p.id !== playerId)
    })));
    // Also remove their fingerprint (from local, the matching service, and
    // Firebase) so a deleted player can't be re-added by scanning their finger.
    if (fingerprints[playerId] || fingerprints[String(playerId)]) {
      deletePlayerFingerprint(playerId);
    }
  };

  // ==================== Pool Functions ====================
  
  // Add player to "Not Present" section first (they need to be moved to Available manually)
  const addToPool = (player) => {
    // Check if player already exists in the pool or not present
    if (poolPlayers.find(p => p.id === player.id) || notPresentPlayers.find(p => p.id === player.id)) {
      return; // Already in pool or not present
    }
    setNotPresentPlayers(prev => [...prev, { 
      ...player,
      // No joinedAt, playCount yet - these are set when moved to Available
      noviceMatchCount: 0,
      lastNoviceMatchAt: 0, // playCount when Advanced last matched with a Novice
      lastAdvancedMatchAt: 0, // playCount when Novice last matched with an Advanced
      pairedNovices: [], // Track which novices this Advanced player has paired with
      pairedAdvanced: [], // Track which advanced players this Novice has paired with
      // Intermediate-Novice tracking
      intermediateNoviceCount: 0, // Total times Intermediate matched with any Novice
      lastIntermediateNoviceMatchAt: 0, // playCount when Intermediate last matched with Novice
      pairedNovicesAsIntermediate: [] // Track which novices this Intermediate has paired with
    }]);
  };

  // Move player from Not Present to Available (starts their timer)
  // Add a database player straight into the Available group, skipping the
  // Not Present step that addToPool goes through.
  const addToAvailable = (player) => {
    if (poolPlayers.find(p => p.id === player.id)) return;
    setNotPresentPlayers(prev => prev.filter(p => p.id !== player.id));
    setPoolPlayers(prev => ([...prev, {
      ...player,
      joinedAt: Date.now(),
      playCount: player.playCount || 0,
      noviceMatchCount: player.noviceMatchCount || 0,
      lastNoviceMatchAt: player.lastNoviceMatchAt || 0,
      lastAdvancedMatchAt: player.lastAdvancedMatchAt || 0,
      pairedNovices: player.pairedNovices || [],
      pairedAdvanced: player.pairedAdvanced || [],
      intermediateNoviceCount: player.intermediateNoviceCount || 0,
      lastIntermediateNoviceMatchAt: player.lastIntermediateNoviceMatchAt || 0,
      pairedNovicesAsIntermediate: player.pairedNovicesAsIntermediate || []
    }]));
  };

  // Drop a Not Present or database player straight onto a match: they join the
  // Available group first, then go into the match.
  const addExternalPlayerToMatch = async (matchId, player) => {
    addToAvailable(player);
    await addPlayerToMatch(matchId, {
      ...player,
      joinedAt: player.joinedAt || Date.now(),
      playCount: player.playCount || 0
    });
  };

  const moveToAvailable = (playerId) => {
    // Their card flies from the Not Present list up into Available
    const arriving = notPresentPlayers.find(p => p.id === playerId);
    if (arriving) {
      flyPlayerGroup(
        [arriving],
        `[data-player-card="${playerId}"]`,
        (p) => `[data-player-card="${p.id}"]`,
        isDarkMode
      );
    }

    const player = notPresentPlayers.find(p => p.id === playerId);
    if (!player) return;
    
    setNotPresentPlayers(prev => prev.filter(p => p.id !== playerId));
    setPoolPlayers(prev => [...prev, {
      ...player,
      joinedAt: Date.now(),
      playCount: 0
    }]);
  };

  // Fingerprint check-in: place a player DIRECTLY into the Available pool.
  // Used by the fingerprint reader when a known finger is scanned.
  const checkInPlayerById = (rawPlayerId) => {
    // IDs may arrive as strings (from the fingerprint service); normalize.
    const numId = Number(rawPlayerId);
    const playerId = Number.isNaN(numId) ? rawPlayerId : numId;

    // Source the player from Not Present (if staged) or the database.
    const staged = notPresentPlayers.find(p => p.id === playerId);
    let base = staged || players.find(p => p.id === playerId);

    // Fallback: the player database was cleared/not synced, but the fingerprint
    // carries the player's identity — use it and restore the player to the DB.
    if (!base) {
      const entry = fingerprints[playerId] || fingerprints[String(playerId)];
      if (entry && entry.player) {
        base = entry.player;
        setPlayers(prev => prev.find(p => p.id === base.id) ? prev : [...prev, base]);
      }
    }
    if (!base) return; // truly unknown player id

    if (staged) {
      setNotPresentPlayers(prev => prev.filter(p => p.id !== playerId));
    }

    // Add to the Available pool, deduping atomically against the latest state so
    // rapid repeat scans can't insert the same player twice.
    setPoolPlayers(prev => {
      if (prev.find(p => p.id === playerId)) return prev;
      return [...prev, {
        ...base,
        joinedAt: Date.now(),
        playCount: base.playCount || 0,
        // Ensure pairing/tracking fields exist (mirrors addToPool defaults).
        noviceMatchCount: base.noviceMatchCount || 0,
        lastNoviceMatchAt: base.lastNoviceMatchAt || 0,
        lastAdvancedMatchAt: base.lastAdvancedMatchAt || 0,
        pairedNovices: base.pairedNovices || [],
        pairedAdvanced: base.pairedAdvanced || [],
        intermediateNoviceCount: base.intermediateNoviceCount || 0,
        lastIntermediateNoviceMatchAt: base.lastIntermediateNoviceMatchAt || 0,
        pairedNovicesAsIntermediate: base.pairedNovicesAsIntermediate || []
      }];
    });
  };

  // Persist a fingerprint enrollment (template) for a player, and back it up
  // to Firebase when cloud sync is enabled.
  const handleFingerprintEnroll = (playerId, template) => {
    if (!template) return;
    // Store the player's identity WITH the template so the fingerprint stays
    // resolvable even if the local player database is cleared or this is a
    // fresh machine. Falls back to a minimal record if not found.
    const p = players.find(pl => pl.id === playerId);
    const player = p
      ? { id: p.id, name: p.name, gender: p.gender, level: p.level }
      : null;
    const next = { ...fingerprints, [playerId]: { template, player, enrolledAt: Date.now() } };
    setFingerprints(next);

    // Push to Firebase immediately (outside the state updater so it always runs).
    if (isFirebaseConfigured && cloudSyncEnabled) {
      syncFingerprintsToCloud(next)
        .then(() => console.log('[fingerprint] synced to Firebase:', playerId))
        .catch(err => console.warn('[fingerprint] Firebase sync FAILED:', err.message));
    } else {
      console.log(`[fingerprint] not synced (cloudSyncEnabled=${cloudSyncEnabled}, firebaseConfigured=${isFirebaseConfigured}). Enable Cloud Sync to back up fingerprints.`);
    }
  };

  // When cloud sync is on (including the moment it's switched on), pull any
  // cloud-stored fingerprint templates so this machine can identify players
  // enrolled elsewhere. Seeding the local service is handled by the
  // FingerprintController whenever the service is online.
  useEffect(() => {
    if (!cloudSyncEnabled || !isFirebaseConfigured) return;
    fetchFingerprintsFromCloud()
      .then(cloudMap => {
        setFingerprints(prev => mergeFingerprintsByRecency(cloudMap, prev));
      })
      .catch(err => console.warn('Fingerprint cloud fetch failed:', err.message));
  }, [cloudSyncEnabled, isFirebaseConfigured]);

  // Delete one player's fingerprint from the database (local + service + cloud).
  const deletePlayerFingerprint = (playerId) => {
    setFingerprints(prev => {
      const next = { ...prev };
      // Clear the template but keep the record, stamped with the time of the
      // delete. That marker is what tells other machines the print was removed —
      // simply dropping the record would let them re-upload their own copy on
      // the next sync and undo the deletion.
      const key = next[playerId] !== undefined ? playerId : String(playerId);
      const existing = next[key];
      if (existing) {
        next[key] = {
          ...(typeof existing === 'string' ? {} : existing),
          template: null,
          enrolledAt: Date.now(),
        };
      }
      replaceEnrollments(next); // update the matching service so it stops matching
      if (cloudSyncEnabled && isFirebaseConfigured) {
        syncFingerprintsToCloud(next).catch(err =>
          console.warn('Fingerprint cloud sync failed:', err.message));
      }
      return next;
    });
  };

  // Reset (clear) ALL fingerprints from the database.
  const resetAllFingerprints = async () => {
    if (!(await requireResetPassword())) return;
    const empty = {};
    setFingerprints(empty);
    replaceEnrollments(empty);
    if (cloudSyncEnabled && isFirebaseConfigured) {
      syncFingerprintsToCloud(empty).catch(err =>
        console.warn('Fingerprint cloud sync failed:', err.message));
    }
  };

  // Repair: de-duplicate players by name across BOTH the cloud and local copy,
  // then authoritatively rewrite the cloud and local list so each player exists
  // exactly once. Works even when the local list is empty (it pulls the cloud).
  const removeDuplicatePlayers = async () => {
    if (!(await requireResetPassword())) return;
    let pool = [...players];
    if (isFirebaseConfigured && cloudSyncEnabled) {
      try {
        const cloud = await fetchPlayersFromCloud();
        pool = [...players, ...cloud]; // union; dedupe by name below
      } catch (err) {
        console.warn('Dedupe cloud fetch failed:', err.message);
      }
    }

    const seen = new Set();
    const deduped = [];
    for (const p of pool) {
      const key = (p.name || '').trim().toLowerCase();
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      deduped.push(p);
    }
    const removed = pool.length - deduped.length;

    setPlayers(deduped);
    if (isFirebaseConfigured && cloudSyncEnabled) {
      try {
        await syncPlayersToCloud(deduped); // cloud = deduped set (extras deleted)
      } catch (err) {
        console.warn('Dedupe cloud push failed:', err.message);
      }
    }
    return removed;
  };

  // Reflect the fingerprint service's actual enrollments (enrollments.json) in
  // the app so the "has fingerprint" badge matches reality. Adds any templates
  // the app didn't know about, attaching player info from the database if found.
  const handleServiceEnrollments = (serviceMap) => {
    if (!serviceMap || Object.keys(serviceMap).length === 0) return;
    setFingerprints(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [id, template] of Object.entries(serviceMap)) {
        if (!template) continue;
        const key = next[id] ? id : (next[Number(id)] ? Number(id) : id);
        const existing = next[key];
        if (existing) {
          if (!existing.template) { next[key] = { ...existing, template }; changed = true; }
        } else {
          const pl = players.find(p => String(p.id) === String(id));
          next[id] = {
            template,
            player: pl ? { id: pl.id, name: pl.name, gender: pl.gender, level: pl.level } : null
          };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  };

  // Manual "Sync Now": syncs players (performSync) AND the fingerprint database
  // to Firebase. Fingerprints are merged both ways (union) so no machine's
  // templates are lost, then the merged set is pushed and stored locally.
  const handleManualSync = async () => {
    const result = await performSync();
    if (isFirebaseConfigured) {
      try {
        const cloudMap = await fetchFingerprintsFromCloud();
        const merged = mergeFingerprintsByRecency(cloudMap, fingerprints);
        setFingerprints(merged);
        await syncFingerprintsToCloud(merged);
        // Write the merged templates into the service's enrollments.json now,
        // regardless of the reader's current status (listening or not).
        //
        // Replace rather than import: importing only adds, so a print deleted on
        // another machine would stay in this scanner's set and keep matching.
        // The merged map is the full picture, so replacing is safe here.
        await replaceEnrollments(merged);
      } catch (err) {
        console.warn('Fingerprint manual sync failed:', err.message);
      }
    }
    return result;
  };

  // Move player from Available back to Not Present (with warning)
  const moveToNotPresent = async (playerId) => {
    const player = poolPlayers.find(p => p.id === playerId);
    if (!player) return;
    
    if (!await showConfirm(`Move ${player.name} back to "Not Present"?\n\nTheir idle time and game count will be reset.`)) {
      return;
    }

    // Their card flies from Available down into the Not Present list
    flyPlayerGroup(
      [player],
      `[data-player-card="${playerId}"]`,
      (p) => `[data-player-card="${p.id}"]`,
      isDarkMode
    );
    
    setPoolPlayers(prev => prev.filter(p => p.id !== playerId));
    setNotPresentPlayers(prev => [...prev, {
      ...player,
      joinedAt: undefined,
      playCount: undefined
    }]);
  };

  const removeFromPool = (playerId) => {
    // Check if player is currently on a court
    const onCourt = courts.some(c => c.match && c.match.players.some(p => p.id === playerId));
    if (onCourt) {
      // Track that this player was removed while on court - they shouldn't come back when match ends
      setRemovedWhileOnCourt(prev => new Set([...prev, playerId]));
    }
    setPoolPlayers(prevPool => prevPool.filter(p => p.id !== playerId));
    setNotPresentPlayers(prev => prev.filter(p => p.id !== playerId));
  };

  const removeAllFromPool = () => {
    setPoolPlayers([]);
    setNotPresentPlayers([]);
  };

  const isPlayerInMatch = (playerId) => {
    const inQueuedMatch = matches.some(m => m.players.some(p => p.id === playerId));
    const onCourt = courts.some(c => c.match && c.match.players.some(p => p.id === playerId));
    return inQueuedMatch || onCourt;
  };

  const isPlayerInQueue = (playerId) => {
    return matches.some(m => m.players.some(p => p.id === playerId));
  };

  const isPlayerOnCourt = (playerId) => {
    return courts.some(c => c.match && c.match.players.some(p => p.id === playerId));
  };

  const getAvailablePoolPlayers = () => {
    return poolPlayers.filter(p => !isPlayerInMatch(p.id));
  };

  // Check if player is in Not Present section
  const isPlayerNotPresent = (playerId) => {
    return notPresentPlayers.some(p => p.id === playerId);
  };

  // ==================== Match Functions ====================
  
  const createMatch = () => {
    const newMatch = {
      id: Date.now(),
      matchNumber: nextMatchNumber,
      players: [],
      createdAt: Date.now()
    };
    setNextMatchNumber(prev => prev + 1);
    setMatches(prev => [...prev, newMatch]);
    setQueueBottomToken(t => t + 1);
  };

  const deleteMatch = (matchId) => {
    // Save match to history before deleting
    const matchToDelete = matches.find(m => m.id === matchId);
    flyMatchPlayersHome(matchId, matchToDelete?.players);
    if (matchToDelete) {
      setMatchHistory(prev => [...prev, {
        ...matchToDelete,
        status: 'deleted',
        endedAt: Date.now()
      }]);
    }
    setMatches(prev => prev.filter(m => m.id !== matchId));
    if (selectedMatchId === matchId) setSelectedMatchId(null);
    // Clear undo state if this match had it
    if (lastSmartMatch?.matchId === matchId) {
      setLastSmartMatch(null);
    }
    // Clear reservations for this match
    setMatchReservations(prev => {
      const newReservations = { ...prev };
      delete newReservations[matchId];
      return newReservations;
    });
  };

  // Reserve a player for a specific slot in a match
  const reservePlayerInMatch = (matchId, slotIndex, player) => {
    setMatchReservations(prev => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || {}),
        [slotIndex]: player
      }
    }));
  };

  // Clear a specific reservation
  const clearReservation = (matchId, slotIndex) => {
    setMatchReservations(prev => {
      const matchRes = { ...(prev[matchId] || {}) };
      delete matchRes[slotIndex];
      // If no more reservations for this match, remove the match entry
      if (Object.keys(matchRes).length === 0) {
        const newReservations = { ...prev };
        delete newReservations[matchId];
        return newReservations;
      }
      return { ...prev, [matchId]: matchRes };
    });
  };

  // Clear reservation when the reserved player is actually added to the match
  const clearReservationForPlayer = (matchId, playerId) => {
    setMatchReservations(prev => {
      const matchRes = prev[matchId];
      if (!matchRes) return prev;
      
      const newMatchRes = { ...matchRes };
      for (const slotIndex in newMatchRes) {
        if (newMatchRes[slotIndex]?.id === playerId) {
          delete newMatchRes[slotIndex];
        }
      }
      
      if (Object.keys(newMatchRes).length === 0) {
        const newReservations = { ...prev };
        delete newReservations[matchId];
        return newReservations;
      }
      return { ...prev, [matchId]: newMatchRes };
    });
  };

  const togglePreferredCourt = (matchId, courtId) => {
    setMatches(prev => prev.map(m => {
      if (m.id === matchId) {
        const currentCourts = m.preferredCourts || [];
        const isSelected = currentCourts.includes(courtId);
        const newCourts = isSelected 
          ? currentCourts.filter(id => id !== courtId)
          : [...currentCourts, courtId];
        return { ...m, preferredCourts: newCourts };
      }
      return m;
    }));
  };

  const clearPreferredCourts = (matchId) => {
    setMatches(prev => prev.map(m => {
      if (m.id === matchId) {
        return { ...m, preferredCourts: [] };
      }
      return m;
    }));
  };

  const addPlayerToMatch = async (matchId, player) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.players.length >= 4 || match.players.find(p => p.id === player.id)) {
      return;
    }
    
    // Reservations hold their own slot; this player simply takes the next slot
    // that isn't reserved (the queue lays the slots out that way). All we need
    // to check is that a free, unreserved seat actually exists.
    const matchRes = matchReservations[matchId] || {};
    const heldForOthers = Object.values(matchRes)
      .filter(r => r.id !== player.id && !match.players.some(p => p.id === r.id)).length;
    if (match.players.length + heldForOthers >= 4) {
      const nextName = Object.values(matchRes).find(r => r.id !== player.id)?.name;
      showAlert(`The remaining slots are reserved${nextName ? ` (next: ${nextName})` : ''}.`);
      return;
    }
    
    // Get today's date for filtering
    const today = new Date().toLocaleDateString('en-CA');
    
    // Filter match history to only include today's matches
    const todayMatches = matchHistory.filter(m => {
      if (!m.endedAt) return false;
      return new Date(m.endedAt).toLocaleDateString('en-CA') === today;
    });
    
    // Helper to count how many times a player has played with novices (today only)
    const countNovicePlays = (playerId) => {
      let count = 0;
      todayMatches.forEach(m => {
        const playerIds = m.players.map(mp => mp.id);
        if (playerIds.includes(playerId)) {
          m.players.forEach(mp => {
            if (mp.level === 'Novice' && mp.id !== playerId) {
              count++;
            }
          });
        }
      });
      return count;
    };
    
    // Helper to count how many times two players have played together (today only)
    const countTimesPlayedTogether = (playerId1, playerId2) => {
      return todayMatches.filter(m => {
        const playerIds = m.players.map(p => p.id);
        return playerIds.includes(playerId1) && playerIds.includes(playerId2);
      }).length;
    };
    
    let noviceAlertMessages = [];
    let repeatAlertMessages = [];
    
    // Case 1: Novice player being added - check if existing players have played with novices too many times
    if (player.level === 'Novice') {
      const playersWithHighNoviceCount = [];
      match.players.forEach(existingPlayer => {
        if (existingPlayer.level === 'Novice') return; // Skip novice players
        const novicePlayCount = countNovicePlays(existingPlayer.id);
        if (novicePlayCount >= warningSettings.noviceOverMatchThreshold) {
          playersWithHighNoviceCount.push({ name: existingPlayer.name, count: novicePlayCount });
        }
      });
      
      if (playersWithHighNoviceCount.length > 0) {
        const playersList = playersWithHighNoviceCount
          .map(p => `• ${p.name}: ${p.count} times`)
          .join('\n');
        noviceAlertMessages.push(`Players in match who have played with novices ${warningSettings.noviceOverMatchThreshold}+ times:\n${playersList}`);
      }
      
      // Case 1b: Novice being added to match with existing novice - check if novice being added has played with too many novices
      const hasNoviceInMatch = match.players.some(p => p.level === 'Novice');
      if (hasNoviceInMatch) {
        const novicePlayCount = countNovicePlays(player.id);
        if (novicePlayCount >= warningSettings.noviceToNoviceThreshold) {
          noviceAlertMessages.push(`${player.name} (Novice) has already played with novices ${novicePlayCount} times`);
        }
      }
    }
    
    // Case 2: Non-novice player being added - check if match has novices and if player has played with novices too many times
    if (player.level !== 'Novice') {
      const hasNoviceInMatch = match.players.some(p => p.level === 'Novice');
      if (hasNoviceInMatch) {
        const playerNoviceCount = countNovicePlays(player.id);
        if (playerNoviceCount >= warningSettings.noviceOverMatchThreshold) {
          noviceAlertMessages.push(`${player.name} has already played with novices ${playerNoviceCount} times`);
        }
      }
    }
    
    // Check for repeat pairings
    const repeatPairings = [];
    match.players.forEach(existingPlayer => {
      const timesPlayed = countTimesPlayedTogether(player.id, existingPlayer.id);
      if (timesPlayed >= warningSettings.repeatPairingsThreshold) {
        repeatPairings.push({ name: existingPlayer.name, count: timesPlayed });
      }
    });
    
    if (repeatPairings.length > 0) {
      const playersList = repeatPairings
        .map(p => `• ${p.name}: ${p.count} times`)
        .join('\n');
      repeatAlertMessages.push(`${player.name} has played with these players ${warningSettings.repeatPairingsThreshold}+ times:\n${playersList}`);
    }
    
    // Show novice alert if any issues detected
    if (noviceAlertMessages.length > 0) {
      const proceed = await showConfirm(
        `⚠️ NOVICE OVER-MATCHING ⚠️\n\n${noviceAlertMessages.join('\n\n')}\n\nDo you still want to add ${player.name} to this match?`
      );
      if (!proceed) return;
    }
    
    // Show repeat pairings alert if any issues detected
    if (repeatAlertMessages.length > 0) {
      const proceed = await showConfirm(
        `⚠️ REPEAT PAIRINGS ⚠️\n\n${repeatAlertMessages.join('\n\n')}\n\nDo you still want to add ${player.name} to this match?`
      );
      if (!proceed) return;
    }
    
    setMatches(prev => {
      const updatedMatches = prev.map(m => {
        if (m.id === matchId && m.players.length < 4 && !m.players.find(p => p.id === player.id)) {
          const at = insertIndexForReservation(matchId, m.players, player.id);
          const next = [...m.players];
          next.splice(at, 0, player);
          return { ...m, players: next };
        }
        return m;
      });
      
      return updatedMatches;
    });
    
    
    flyPlayerToMatch(player, matchId, isDarkMode);

    // Clear any reservation for this player in this match
    clearReservationForPlayer(matchId, player.id);
  };

  // When a player who holds a reservation joins, put them in the array position
  // that lands them on their reserved slot, so they appear exactly where the
  // "Waiting for ..." marker was rather than at the end of the row.
  const insertIndexForReservation = (matchId, players, playerId) => {
    const slots = matchReservations[matchId] || {};
    const mine = Object.entries(slots).find(([, r]) => r.id === playerId);
    if (!mine) return players.length;
    const reservedIndex = Number(mine[0]);
    const othersBefore = Object.entries(slots)
      .filter(([i, r]) => Number(i) < reservedIndex && r.id !== playerId).length;
    return Math.min(Math.max(reservedIndex - othersBefore, 0), players.length);
  };

  const removePlayerFromMatch = (matchId, playerId) => {
    // The player's card flies from its slot in the queue back to the pool
    const leaving = matches.find(m => m.id === matchId)?.players?.find(p => p.id === playerId);
    if (leaving) {
      flyPlayerGroup(
        [leaving],
        `[data-match-card="${matchId}"]`,
        (p) => `[data-player-card="${p.id}"]`,
        isDarkMode
      );
    }

    setMatches(prev => prev.map(m => {
      if (m.id === matchId) {
        return { ...m, players: m.players.filter(p => p.id !== playerId) };
      }
      return m;
    }));
  };

  const movePlayerFromMatchToNotPresent = (matchId, playerId) => {
    // Find the player in the match
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    
    const player = match.players.find(p => p.id === playerId);
    if (!player) return;

    // Their card flies from the match slot down to the Not Present list
    flyPlayerGroup(
      [player],
      `[data-match-card="${matchId}"]`,
      (p) => `[data-player-card="${p.id}"]`,
      isDarkMode
    );
    
    // Remove from match
    setMatches(prev => prev.map(m => {
      if (m.id === matchId) {
        return { ...m, players: m.players.filter(p => p.id !== playerId) };
      }
      return m;
    }));
    
    // Remove from pool players if they're there
    setPoolPlayers(prev => prev.filter(p => p.id !== playerId));
    
    // Add to not present
    setNotPresentPlayers(prev => {
      // Check if already in not present
      if (prev.some(p => p.id === playerId)) return prev;
      return [...prev, {
        ...player,
        joinedAt: undefined,
        playCount: undefined
      }];
    });
  };

  const movePlayerBetweenMatches = async (sourceMatchId, targetMatchId, player) => {
    const targetMatch = matches.find(m => m.id === targetMatchId);
    if (!targetMatch || targetMatch.players.length >= 4) {
      return;
    }
    
    // Reservations in the target match hold their own slot; this player takes
    // the next unreserved slot, so we only need a free seat to exist.
    const targetRes = matchReservations[targetMatchId] || {};
    const heldForOthers = Object.values(targetRes)
      .filter(r => r.id !== player.id && !targetMatch.players.some(p => p.id === r.id)).length;
    if (targetMatch.players.length + heldForOthers >= 4) {
      const nextName = Object.values(targetRes).find(r => r.id !== player.id)?.name;
      showAlert(`The remaining slots are reserved${nextName ? ` (next: ${nextName})` : ''}.`);
      return;
    }
    
    // Get today's date for filtering
    const today = new Date().toLocaleDateString('en-CA');
    
    // Filter match history to only include today's matches
    const todayMatches = matchHistory.filter(m => {
      if (!m.endedAt) return false;
      return new Date(m.endedAt).toLocaleDateString('en-CA') === today;
    });
    
    // Helper to count how many times a player has played with novices (today only)
    const countNovicePlays = (playerId) => {
      let count = 0;
      todayMatches.forEach(m => {
        const playerIds = m.players.map(mp => mp.id);
        if (playerIds.includes(playerId)) {
          m.players.forEach(mp => {
            if (mp.level === 'Novice' && mp.id !== playerId) {
              count++;
            }
          });
        }
      });
      return count;
    };
    
    // Helper to count how many times two players have played together (today only)
    const countTimesPlayedTogether = (playerId1, playerId2) => {
      return todayMatches.filter(m => {
        const playerIds = m.players.map(p => p.id);
        return playerIds.includes(playerId1) && playerIds.includes(playerId2);
      }).length;
    };
    
    let noviceAlertMessages = [];
    let repeatAlertMessages = [];
    
    // Case 1: Novice player being moved - check if existing players in target have played with novices too many times
    if (player.level === 'Novice') {
      const playersWithHighNoviceCount = [];
      targetMatch.players.forEach(existingPlayer => {
        if (existingPlayer.level === 'Novice') return;
        const novicePlayCount = countNovicePlays(existingPlayer.id);
        if (novicePlayCount >= warningSettings.noviceOverMatchThreshold) {
          playersWithHighNoviceCount.push({ name: existingPlayer.name, count: novicePlayCount });
        }
      });
      
      if (playersWithHighNoviceCount.length > 0) {
        const playersList = playersWithHighNoviceCount
          .map(p => `• ${p.name}: ${p.count} times`)
          .join('\n');
        noviceAlertMessages.push(`Players in match who have played with novices ${warningSettings.noviceOverMatchThreshold}+ times:\n${playersList}`);
      }
      
      // Case 1b: Novice being moved to match with existing novice - check if novice being moved has played with too many novices
      const hasNoviceInMatch = targetMatch.players.some(p => p.level === 'Novice');
      if (hasNoviceInMatch) {
        const novicePlayCount = countNovicePlays(player.id);
        if (novicePlayCount >= warningSettings.noviceToNoviceThreshold) {
          noviceAlertMessages.push(`${player.name} (Novice) has already played with novices ${novicePlayCount} times`);
        }
      }
    }
    
    // Case 2: Non-novice player being moved - check if target match has novices and if player has played with novices too many times
    if (player.level !== 'Novice') {
      const hasNoviceInMatch = targetMatch.players.some(p => p.level === 'Novice');
      if (hasNoviceInMatch) {
        const playerNoviceCount = countNovicePlays(player.id);
        if (playerNoviceCount >= warningSettings.noviceOverMatchThreshold) {
          noviceAlertMessages.push(`${player.name} has already played with novices ${playerNoviceCount} times`);
        }
      }
    }
    
    // Check for repeat pairings
    const repeatPairings = [];
    targetMatch.players.forEach(existingPlayer => {
      const timesPlayed = countTimesPlayedTogether(player.id, existingPlayer.id);
      if (timesPlayed >= warningSettings.repeatPairingsThreshold) {
        repeatPairings.push({ name: existingPlayer.name, count: timesPlayed });
      }
    });
    
    if (repeatPairings.length > 0) {
      const playersList = repeatPairings
        .map(p => `• ${p.name}: ${p.count} times`)
        .join('\n');
      repeatAlertMessages.push(`${player.name} has played with these players ${warningSettings.repeatPairingsThreshold}+ times:\n${playersList}`);
    }
    
    // Show novice alert if any issues detected
    if (noviceAlertMessages.length > 0) {
      const proceed = await showConfirm(
        `⚠️ NOVICE OVER-MATCHING ⚠️\n\n${noviceAlertMessages.join('\n\n')}\n\nDo you still want to move ${player.name} to this match?`
      );
      if (!proceed) return;
    }
    
    // Show repeat pairings alert if any issues detected
    if (repeatAlertMessages.length > 0) {
      const proceed = await showConfirm(
        `⚠️ REPEAT PAIRINGS ⚠️\n\n${repeatAlertMessages.join('\n\n')}\n\nDo you still want to move ${player.name} to this match?`
      );
      if (!proceed) return;
    }
    
    setMatches(prev => prev.map(m => {
      if (m.id === sourceMatchId) {
        // Remove from source match
        return { ...m, players: m.players.filter(p => p.id !== player.id) };
      }
      if (m.id === targetMatchId && m.players.length < 4) {
        // Add to target match (with pool player data)
        const poolPlayer = poolPlayers.find(p => p.id === player.id);
        const playerToAdd = poolPlayer || player;
        const at = insertIndexForReservation(targetMatchId, m.players, playerToAdd.id);
        const next = [...m.players];
        next.splice(at, 0, playerToAdd);
        return { ...m, players: next };
      }
      return m;
    }));
    
    
    flyPlayerToMatch(player, targetMatchId, isDarkMode);

    // If the moved player was the one reserved here, that reservation is done.
    clearReservationForPlayer(targetMatchId, player.id);
  };

  // Players leaving a match head back to their card in the pool.
  const flyMatchPlayersHome = (matchId, players) => {
    if (!players?.length) return;
    flyPlayerGroup(
      players,
      `[data-match-card="${matchId}"]`,
      (p) => `[data-player-card="${p.id}"]`,
      isDarkMode
    );
  };

  const clearMatch = (matchId) => {
    flyMatchPlayersHome(matchId, matches.find(m => m.id === matchId)?.players);

    setMatches(prev => prev.map(m => {
      if (m.id === matchId) {
        return { ...m, players: [] };
      }
      return m;
    }));
    // Clear undo state if this match had it
    if (lastSmartMatch?.matchId === matchId) {
      setLastSmartMatch(null);
    }
    // Clear reservations for this match
    setMatchReservations(prev => {
      const newReservations = { ...prev };
      delete newReservations[matchId];
      return newReservations;
    });
  };

  // Clear all players from all matches
  const clearAllMatches = async () => {
    matches.forEach(m => flyMatchPlayersHome(m.id, m.players));
    setMatches(prev => prev.map(m => ({ ...m, players: [] })));
    setLastSmartMatch(null);
    setLastSmartQueueAll(null);
    setMatchReservations({});
  };

  // Swap players between two adjacent matches
  const swapMatchPlayers = (matchId, direction) => {
    // Sort by matchNumber to get correct order
    const sortedMatches = [...matches].sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
    const sortedIndex = sortedMatches.findIndex(m => m.id === matchId);
    if (sortedIndex === -1) return;
    
    const targetSortedIndex = direction === 'up' ? sortedIndex - 1 : sortedIndex + 1;
    if (targetSortedIndex < 0 || targetSortedIndex >= sortedMatches.length) return;
    
    const currentMatch = sortedMatches[sortedIndex];
    const targetMatch = sortedMatches[targetSortedIndex];

    // Moving a match up or down swaps the PLAYERS between the two cards rather
    // than moving the cards, so nothing would appear to move. Start each card at
    // the other's position and slide it home, so the real cards are seen
    // exchanging places.
    animateCardSwap(
      `[data-match-card="${currentMatch.id}"]`,
      `[data-match-card="${targetMatch.id}"]`
    );
    
    // Check if current match has reservations
    const currentMatchReservations = matchReservations[currentMatch.id];
    const currentHasReservations = currentMatchReservations && Object.keys(currentMatchReservations).length > 0;
    
    // Check if target match has reservations
    const targetMatchReservations = matchReservations[targetMatch.id];
    const targetHasReservations = targetMatchReservations && Object.keys(targetMatchReservations).length > 0;
    
    // If moving up and would become position 0 (top) and current has reservations, show error
    if (direction === 'up' && targetSortedIndex === 0 && currentHasReservations) {
      const reservedNames = Object.values(currentMatchReservations).map(p => p.name).join(', ');
      showAlert(`Cannot move to top of queue.\n\nThis match is waiting for: ${reservedNames}\n\nFill all reserved slots first.`);
      return;
    }
    
    // If moving down from position 0 and target has reservations, show error (target would become top)
    if (direction === 'down' && sortedIndex === 0 && targetHasReservations) {
      const reservedNames = Object.values(targetMatchReservations).map(p => p.name).join(', ');
      showAlert(`Cannot swap - the match below is waiting for: ${reservedNames}\n\nIt cannot be moved to top of queue until all reserved slots are filled.`);
      return;
    }
    
    // Swap players between the two matches
    setMatches(prev => {
      return prev.map(m => {
        // The court preferences and the smart-match highlight belong to the
        // players, so they travel with them rather than staying with the card.
        if (m.id === currentMatch.id) {
          return {
            ...m,
            players: targetMatch.players,
            preferredCourts: targetMatch.preferredCourts,
            smartMatchedPlayerIds: targetMatch.smartMatchedPlayerIds,
          };
        }
        if (m.id === targetMatch.id) {
          return {
            ...m,
            players: currentMatch.players,
            preferredCourts: currentMatch.preferredCourts,
            smartMatchedPlayerIds: currentMatch.smartMatchedPlayerIds,
          };
        }
        return m;
      });
    });
    
    // Also swap reservations
    setMatchReservations(prev => {
      const currentRes = prev[currentMatch.id];
      const targetRes = prev[targetMatch.id];
      
      const newReservations = { ...prev };
      
      // Remove both
      delete newReservations[currentMatch.id];
      delete newReservations[targetMatch.id];
      
      // Swap them
      if (targetRes && Object.keys(targetRes).length > 0) {
        newReservations[currentMatch.id] = targetRes;
      }
      if (currentRes && Object.keys(currentRes).length > 0) {
        newReservations[targetMatch.id] = currentRes;
      }
      
      return newReservations;
    });
  };

  // ==================== Smart Match Algorithm ====================
  
  /**
   * Smart Match Algorithm v23
   * 
   * Rules:
   * 1. ALWAYS prioritize longest idle time (sort by joinedAt ascending)
   * 2. Prefer Regular Doubles (4M or 4F) or Mixed Doubles (2M/2F)
   * 3. Regular doubles preferred over mixed doubles (60% regular, 40% mixed)
   * 4. If regular doubles can't complete, fall back to mixed doubles
   *    - Works for empty matches AND matches with existing players
   *    - Only if current composition allows (≤2 of each gender)
   *    - Expert players are EXCLUDED from mixed doubles fallback
   * 5. Expert players only with experts unless non-experts already in match
   * 6. Expert players should only do Regular Doubles, unless match already has mixed genders
   * 7. Advanced male players prefer to be grouped with other Advanced males
   * 8. Advanced cannot match with ANY Novice for 3 matches after matching with a Novice
   * 9. Novice cannot match with ANY Advanced for 3 matches after matching with an Advanced
   * 10. Advanced and Novice who have been matched together cannot match again (ever)
   * 11. If no eligible players to complete match, leave rest blank
   */
  const smartMatch = (matchId) => {
    const availablePlayers = getAvailablePoolPlayers();
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const currentPlayers = match.players;
    // Slots held by a pending reservation (index at/after the current fill
    // point) must be left free for the reserved player.
    const reservedPendingSlots = Object.values(matchReservations[matchId] || {})
      .filter(r => !currentPlayers.some(p => p.id === r.id)).length;
    const neededPlayers = 4 - currentPlayers.length - reservedPendingSlots;
    
    // Track failure reasons
    let failureReasons = [];
    
    if (neededPlayers <= 0) {
      showAlert(currentPlayers.length >= 4
        ? '⚠️ Smart Match Failed\n\nMatch is already full (4 players).'
        : '⚠️ Smart Match Failed\n\nThe remaining slots are reserved for specific players.');
      return;
    }
    
    if (availablePlayers.length === 0) {
      showAlert('⚠️ Smart Match Failed\n\nNo available players in the pool.');
      return;
    }

    // Rule 1: Sort by joinedAt (ascending = longest wait first) - THIS IS THE PRIORITY
    const sortedPlayers = [...availablePlayers].sort((a, b) => a.joinedAt - b.joinedAt);
    
    // Current match composition
    const currentMales = currentPlayers.filter(p => p.gender === 'male').length;
    const currentFemales = currentPlayers.filter(p => p.gender === 'female').length;
    const hasNonExpertInMatch = currentPlayers.some(p => p.level !== 'Expert');
    const hasNoviceInMatch = currentPlayers.some(p => p.level === 'Novice');
    const novicesInMatch = currentPlayers.filter(p => p.level === 'Novice');
    const isAlreadyMixed = currentMales > 0 && currentFemales > 0;
    
    // Helper functions
    // Rule: Advanced cannot pair with ANY Novice for 3 matches after pairing with a Novice
    const canAdvancedPairWithNovice = (advancedPlayer, novicePlayer = null) => {
      // Check 3-match cooldown: use pairedNovices to know if they've ever matched with novice
      if ((advancedPlayer.pairedNovices || []).length > 0) {
        const matchesSinceNovice = (advancedPlayer.playCount || 0) - (advancedPlayer.lastNoviceMatchAt || 0);
        if (matchesSinceNovice < 3) return false;
      }
      
      // Rule: Advanced cannot pair with the same Novice twice ever
      if (novicePlayer && (advancedPlayer.pairedNovices || []).includes(novicePlayer.id)) return false;
      
      return true;
    };
    
    // Rule: Novice cannot pair with ANY Advanced for 3 matches after pairing with an Advanced
    const canNovicePairWithAdvanced = (novicePlayer, advancedPlayer = null) => {
      // Check 3-match cooldown: use pairedAdvanced to know if they've ever matched with advanced
      if ((novicePlayer.pairedAdvanced || []).length > 0) {
        const matchesSinceAdvanced = (novicePlayer.playCount || 0) - (novicePlayer.lastAdvancedMatchAt || 0);
        if (matchesSinceAdvanced < 3) return false;
      }
      
      // Rule: Novice cannot pair with the same Advanced twice ever
      if (advancedPlayer && (novicePlayer.pairedAdvanced || []).includes(advancedPlayer.id)) return false;
      
      return true;
    };
    
    // Rule: Intermediate cannot pair with Novice more than twice total
    // Rule: Intermediate cannot pair with the same Novice twice
    // Rule: Intermediate cannot pair with Novice 2 times in a row
    const canIntermediatePairWithNovice = (intermediatePlayer, novicePlayer = null) => {
      // Check total count (max 2 times with any novice)
      if ((intermediatePlayer.intermediateNoviceCount || 0) >= 2) return false;
      
      // Check 2-in-a-row: must have at least 1 non-novice match between novice matches
      // Use intermediateNoviceCount > 0 to know if they've ever matched with novice
      if ((intermediatePlayer.intermediateNoviceCount || 0) > 0) {
        const matchesSinceNovice = (intermediatePlayer.playCount || 0) - (intermediatePlayer.lastIntermediateNoviceMatchAt || 0);
        if (matchesSinceNovice < 2) return false; // Need at least 2 (the novice match itself + 1 more)
      }
      
      // Check if paired with this specific novice before
      if (novicePlayer && (intermediatePlayer.pairedNovicesAsIntermediate || []).includes(novicePlayer.id)) return false;
      
      return true;
    };
    
    const getLevelScore = (level) => {
      const scores = { 'Expert': 4, 'Advanced': 3, 'Intermediate': 2, 'Novice': 1 };
      return scores[level] || 0;
    };
    
    // Check if player can be added to match
    const canAddPlayer = (player, selectedPlayers, targetGenderMode) => {
      const allPlayers = [...currentPlayers, ...selectedPlayers];
      const totalMales = allPlayers.filter(p => p.gender === 'male').length + (player.gender === 'male' ? 1 : 0);
      const totalFemales = allPlayers.filter(p => p.gender === 'female').length + (player.gender === 'female' ? 1 : 0);
      const novicesInSelection = [...novicesInMatch, ...selectedPlayers.filter(p => p.level === 'Novice')];
      const hasNovice = novicesInSelection.length > 0;
      const hasNonExpert = allPlayers.some(p => p.level !== 'Expert') || hasNonExpertInMatch;
      
      // Gender composition check
      if (targetGenderMode === 'male' && player.gender !== 'male') {
        return { eligible: false, reason: `${player.name} is female (need males for 4M)` };
      }
      if (targetGenderMode === 'female' && player.gender !== 'female') {
        return { eligible: false, reason: `${player.name} is male (need females for 4F)` };
      }
      if (targetGenderMode === 'mixed') {
        // For mixed, ensure we don't exceed 2 of either gender
        if (player.gender === 'male' && totalMales > 2) {
          return { eligible: false, reason: `${player.name} would make too many males for mixed (max 2)` };
        }
        if (player.gender === 'female' && totalFemales > 2) {
          return { eligible: false, reason: `${player.name} would make too many females for mixed (max 2)` };
        }
        
        // Rule 6: Expert players should only do Regular Doubles unless match already has mixed genders
        if (player.level === 'Expert' && !isAlreadyMixed) {
          return { eligible: false, reason: `${player.name} (Expert) prefers Regular Doubles only` };
        }
      }
      
      // Rule 5: Expert only with experts unless non-experts already in match
      if (player.level === 'Expert' && hasNonExpert && !allPlayers.some(p => p.level === 'Expert')) {
        return { eligible: false, reason: `${player.name} (Expert) cannot join - match has non-Expert players` };
      }
      if (player.level !== 'Expert' && allPlayers.length > 0 && allPlayers.every(p => p.level === 'Expert')) {
        return { eligible: false, reason: `${player.name} (${player.level}) cannot join - match is Expert-only` };
      }
      
      // Rules for Advanced + Novice restrictions
      if (player.level === 'Advanced' && hasNovice) {
        // Check if Advanced can pair with ANY novice (3 match cooldown)
        if (!canAdvancedPairWithNovice(player, null)) {
          return { eligible: false, reason: `${player.name} (Advanced) needs 3 matches before pairing with Novice again` };
        }
        // Check against specific novices in the match (never pair twice with same novice)
        for (const novice of novicesInSelection) {
          if ((player.pairedNovices || []).includes(novice.id)) {
            return { eligible: false, reason: `${player.name} (Advanced) already paired with ${novice.name} before` };
          }
          // Also check if this Novice can pair with Advanced
          if (!canNovicePairWithAdvanced(novice, null)) {
            return { eligible: false, reason: `${novice.name} (Novice) needs 3 matches before pairing with Advanced again` };
          }
          if ((novice.pairedAdvanced || []).includes(player.id)) {
            return { eligible: false, reason: `${novice.name} (Novice) already paired with ${player.name} before` };
          }
        }
      }
      if (player.level === 'Novice') {
        const advancedPlayers = allPlayers.filter(p => p.level === 'Advanced');
        const intermediatePlayers = allPlayers.filter(p => p.level === 'Intermediate');
        
        // Check Advanced restrictions
        if (advancedPlayers.length > 0 && !canNovicePairWithAdvanced(player, null)) {
          return { eligible: false, reason: `${player.name} (Novice) needs 3 matches before pairing with Advanced again` };
        }
        for (const adv of advancedPlayers) {
          if (!canAdvancedPairWithNovice(adv, null)) {
            return { eligible: false, reason: `${adv.name} (Advanced) needs 3 matches before pairing with Novice` };
          }
          if ((adv.pairedNovices || []).includes(player.id)) {
            return { eligible: false, reason: `${player.name} (Novice) already paired with ${adv.name} before` };
          }
          if ((player.pairedAdvanced || []).includes(adv.id)) {
            return { eligible: false, reason: `${player.name} (Novice) already paired with ${adv.name} before` };
          }
        }
        
        // Check Intermediate restrictions
        for (const inter of intermediatePlayers) {
          if (!canIntermediatePairWithNovice(inter, player)) {
            if ((inter.intermediateNoviceCount || 0) >= 2) {
              return { eligible: false, reason: `${inter.name} (Intermediate) already matched with Novice 2 times` };
            }
            if ((inter.pairedNovicesAsIntermediate || []).includes(player.id)) {
              return { eligible: false, reason: `${inter.name} (Intermediate) already paired with ${player.name} before` };
            }
            const matchesSince = (inter.playCount || 0) - (inter.lastIntermediateNoviceMatchAt || 0);
            if (matchesSince < 2) {
              return { eligible: false, reason: `${inter.name} (Intermediate) just played with a Novice, needs 1 match break` };
            }
          }
        }
      }
      
      // Rules for Intermediate + Novice restrictions
      if (player.level === 'Intermediate' && hasNovice) {
        if (!canIntermediatePairWithNovice(player, null)) {
          if ((player.intermediateNoviceCount || 0) >= 2) {
            return { eligible: false, reason: `${player.name} (Intermediate) already matched with Novice 2 times total` };
          }
          const matchesSince = (player.playCount || 0) - (player.lastIntermediateNoviceMatchAt || 0);
          if (matchesSince < 2) {
            return { eligible: false, reason: `${player.name} (Intermediate) just played with a Novice, needs 1 match break` };
          }
        }
        // Check against specific novices
        for (const novice of novicesInSelection) {
          if ((player.pairedNovicesAsIntermediate || []).includes(novice.id)) {
            return { eligible: false, reason: `${player.name} (Intermediate) already paired with ${novice.name} before` };
          }
        }
      }
      
      return { eligible: true };
    };
    
    let selectedPlayers = [];
    let targetGenderMode;
    
    // Determine target gender mode
    if (currentPlayers.length === 0) {
      // Empty match: the two longest-waiting players decide the format, so
      // neither can be passed over for the sake of completing a set. Same
      // gender gives regular doubles; different gives mixed. A partly filled
      // match is preferred to skipping someone who has waited longer.
      const longestWaiting = sortedPlayers[0];
      const secondLongest = sortedPlayers.find(p => p.id !== longestWaiting?.id);

      if (!longestWaiting) {
        targetGenderMode = 'mixed';
      } else if (longestWaiting.level === 'Expert') {
        // Experts are excluded from the mixed fallback, so keep them in a
        // format they can actually be placed in.
        targetGenderMode = longestWaiting.gender;
      } else if (!secondLongest) {
        targetGenderMode = longestWaiting.gender;
      } else {
        targetGenderMode = secondLongest.gender === longestWaiting.gender
          ? longestWaiting.gender
          : 'mixed';
      }
    } else if (currentMales > 0 && currentFemales > 0) {
      // Already mixed - must continue as 2M/2F
      targetGenderMode = 'mixed';
    } else if (currentMales > 0) {
      // Has males only - continue as 4M
      targetGenderMode = 'male';
    } else {
      // Has females only - continue as 4F
      targetGenderMode = 'female';
    }
    
    const initialMode = targetGenderMode;
    const usedPlayerIds = new Set();
    
    // Sort players with preference for Advanced males when in male mode
    // or when there's already an Advanced male in the match
    const hasAdvancedMaleInMatch = currentPlayers.some(p => p.level === 'Advanced' && p.gender === 'male');
    
    let playersToConsider = [...sortedPlayers];
    // Only once the match has players — on an empty match, wait time alone
    // decides the order.
    if (currentPlayers.length > 0 && (targetGenderMode === 'male' || hasAdvancedMaleInMatch)) {
      // Sort to prefer Advanced males first, then by wait time
      playersToConsider.sort((a, b) => {
        const aIsAdvancedMale = a.level === 'Advanced' && a.gender === 'male';
        const bIsAdvancedMale = b.level === 'Advanced' && b.gender === 'male';
        
        // If one is Advanced male and the other isn't, prefer Advanced male
        if (aIsAdvancedMale && !bIsAdvancedMale) return -1;
        if (!aIsAdvancedMale && bIsAdvancedMale) return 1;
        
        // Otherwise, sort by wait time (longest first)
        return a.joinedAt - b.joinedAt;
      });
    }
    
    // Go through players in order of idle time (longest first)
    // Add eligible players until we have enough or run out
    for (const player of playersToConsider) {
      if (selectedPlayers.length >= neededPlayers) break;
      
      const result = canAddPlayer(player, selectedPlayers, targetGenderMode);
      if (result.eligible) {
        selectedPlayers.push(player);
        usedPlayerIds.add(player.id);
      } else if (result.reason) {
        failureReasons.push(result.reason);
      }
    }
    
    // If regular doubles didn't complete, try to fill rest with mixed doubles
    // This works for both empty matches and matches with existing same-gender players
    // NOTE: Expert players are excluded from mixed doubles fallback
    if (selectedPlayers.length < neededPlayers && 
        (initialMode === 'male' || initialMode === 'female')) {
      
      // Check if switching to mixed is possible
      // Mixed requires max 2 of each gender
      const currentAndSelectedMales = currentMales + selectedPlayers.filter(p => p.gender === 'male').length;
      const currentAndSelectedFemales = currentFemales + selectedPlayers.filter(p => p.gender === 'female').length;
      
      // Can only switch to mixed if we have 2 or fewer of each gender so far
      if (currentAndSelectedMales <= 2 && currentAndSelectedFemales <= 2) {
        // Switch to mixed mode
        targetGenderMode = 'mixed';
        failureReasons.push(`Switched to Mixed Doubles - not enough ${initialMode}s for regular doubles`);
        
        // Continue adding players with mixed mode rules
        // Expert players are excluded from mixed doubles fallback
        for (const player of sortedPlayers) {
          if (selectedPlayers.length >= neededPlayers) break;
          if (usedPlayerIds.has(player.id)) continue; // Skip already selected
          
          // Skip Expert players in mixed doubles fallback
          if (player.level === 'Expert') {
            failureReasons.push(`${player.name} (Expert) skipped - Experts excluded from mixed fallback`);
            continue;
          }
          
          const result = canAddPlayer(player, selectedPlayers, targetGenderMode);
          if (result.eligible) {
            selectedPlayers.push(player);
            usedPlayerIds.add(player.id);
          } else if (result.reason) {
            failureReasons.push(result.reason);
          }
        }
      }
    }
    
    // Sort selected players by level for balanced display
    selectedPlayers.sort((a, b) => getLevelScore(b.level) - getLevelScore(a.level));
    
    // Determine final mode label
    const finalMales = currentPlayers.filter(p => p.gender === 'male').length + 
                       selectedPlayers.filter(p => p.gender === 'male').length;
    const finalFemales = currentPlayers.filter(p => p.gender === 'female').length + 
                         selectedPlayers.filter(p => p.gender === 'female').length;
    const finalModeLabel = (finalMales > 0 && finalFemales > 0) ? 'Mixed' : 
                           finalMales > 0 ? 'Regular (4M)' : 'Regular (4F)';
    
    // Add selected players to match
    if (selectedPlayers.length > 0) {
      // Store for undo
      setLastSmartMatch({
        matchId,
        addedPlayers: selectedPlayers,
        timestamp: Date.now()
      });
      
      // Each smart-matched player flies from the pool into the match, staggered
      // slightly so four at once reads as a sequence rather than a blur.
      flyPlayersToMatch(selectedPlayers, matchId, isDarkMode);

      // Track when these players were smart matched (for 5-min highlight)
      const now = Date.now();
      setSmartMatchedPlayers(prev => {
        const updated = { ...prev };
        selectedPlayers.forEach(p => {
          updated[p.id] = now;
        });
        return updated;
      });
      
      // Store smartMatchedPlayerIds directly on the match
      const newSmartMatchedIds = selectedPlayers.map(p => p.id);
      
      setMatches(prev => {
        const updatedMatches = prev.map(m => {
          if (m.id === matchId) {
            // Merge with any existing smartMatchedPlayerIds
            const existingIds = m.smartMatchedPlayerIds || [];
            const mergedIds = [...new Set([...existingIds, ...newSmartMatchedIds])];
            return { ...m, players: [...m.players, ...selectedPlayers], smartMatchedPlayerIds: mergedIds };
          }
          return m;
        });
        return updatedMatches;
      });
      
      // Show info message if match is not complete
      if (currentPlayers.length + selectedPlayers.length < 4) {
        const uniqueReasons = [...new Set(failureReasons)];
        const reasonsList = uniqueReasons.length > 0 
          ? uniqueReasons.slice(0, 5).join('\n• ')
          : 'No additional eligible players found';
        
        showAlert(
          `ℹ️ Smart Match: Partial Fill\n\n` +
          `Mode: ${finalModeLabel}\n` +
          `Added ${selectedPlayers.length} player${selectedPlayers.length !== 1 ? 's' : ''} ` +
          `(${currentPlayers.length + selectedPlayers.length}/4 total)\n\n` +
          `Why incomplete:\n• ${reasonsList}`
        );
      }
    } else {
      // Show failure reasons
      const uniqueReasons = [...new Set(failureReasons)];
      const reasonsList = uniqueReasons.length > 0 
        ? uniqueReasons.slice(0, 5).join('\n• ')
        : 'No eligible players found';
      
      showAlert(
        `⚠️ Smart Match Could Not Add Any Players\n\n` +
        `Tried: ${initialMode === 'mixed' ? 'Mixed (2M/2F)' : `Regular (4${initialMode === 'male' ? 'M' : 'F'}) → Mixed`}\n\n` +
        `Reasons:\n• ${reasonsList}\n\n` +
        `Available: ${sortedPlayers.filter(p => p.gender === 'male').length} males, ` +
        `${sortedPlayers.filter(p => p.gender === 'female').length} females`
      );
    }
  };
  
  // Undo last Smart Match action
  const undoSmartMatch = () => {
    if (!lastSmartMatch) return;
    
    const { matchId, addedPlayers } = lastSmartMatch;
    const addedPlayerIds = addedPlayers.map(p => p.id);

    flyMatchPlayersHome(matchId, addedPlayers);
    
    // Remove the added players from the match
    setMatches(prev => prev.map(m => {
      if (m.id === matchId) {
        return { 
          ...m, 
          players: m.players.filter(p => !addedPlayerIds.includes(p.id)) 
        };
      }
      return m;
    }));
    
    // Clear smart matched tracking for these players
    setSmartMatchedPlayers(prev => {
      const updated = { ...prev };
      addedPlayerIds.forEach(id => delete updated[id]);
      return updated;
    });
    
    // Clear the undo state
    setLastSmartMatch(null);
  };

  // Smart Queue All - runs smart match on all incomplete matches, creating new ones as needed
  const smartQueueAll = () => {
    let allAddedPlayers = []; // Track all players added across all matches for undo
    let createdMatchIds = []; // Track newly created matches for undo
    const now = Date.now();
    let localNextMatchNumber = nextMatchNumber;
    let localMatches = [...matches];
    
    // Helper to count players in a match including those added this session
    const getMatchPlayerCount = (match) => {
      const addedToMatch = allAddedPlayers.filter(ap => ap.matchId === match.id).length;
      return match.players.length + addedToMatch;
    };
    
    // Slots held for a specific player must not be auto-filled.
    const getReservedPendingCount = (match) =>
      Object.values(matchReservations[match.id] || {})
        .filter(r => !match.players.some(p => p.id === r.id)).length;
    
    // How many slots Smart All may actually fill for this match.
    const getFillableCapacity = (match) => {
      const count = getMatchPlayerCount(match);
      return 4 - count - getReservedPendingCount(match);
    };
    
    // Keep processing until no more available players or all matches complete
    let continueProcessing = true;
    let iterations = 0;
    const maxIterations = 100; // Safety limit
    
    while (continueProcessing && iterations < maxIterations) {
      iterations++;
      
      // Get current available players (excluding already added ones)
      const availablePlayers = getAvailablePoolPlayers().filter(p => 
        !allAddedPlayers.some(added => added.playerId === p.id)
      );
      
      if (availablePlayers.length === 0) {
        continueProcessing = false;
        break;
      }
      
      // Get incomplete matches (considering players added this session)
      const sortedMatches = [...localMatches].sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
      let incompleteMatches = sortedMatches.filter(m => getFillableCapacity(m) > 0);
      
      // If no incomplete matches but still have players, create a new match
      if (incompleteMatches.length === 0 && availablePlayers.length > 0) {
        const newMatch = {
          id: Date.now() + Math.random() + iterations, // Add iterations to ensure unique ID
          matchNumber: localNextMatchNumber,
          players: [],
          preferredCourts: []
        };
        localNextMatchNumber++;
        localMatches = [...localMatches, newMatch];
        createdMatchIds.push(newMatch.id);
        incompleteMatches = [newMatch];
      }
      
      let addedAnyThisRound = false;
      
      // Process each incomplete match
      for (const match of incompleteMatches) {
        const currentAvailable = availablePlayers.filter(p => 
          !allAddedPlayers.some(added => added.playerId === p.id)
        );
        
        if (currentAvailable.length === 0) break;
        
        // Find players already added to this match in this session
        const alreadyAddedToMatch = allAddedPlayers
          .filter(ap => ap.matchId === match.id)
          .map(ap => poolPlayers.find(p => p.id === ap.playerId))
          .filter(Boolean);
        
        const currentPlayers = [...match.players, ...alreadyAddedToMatch];
        const neededPlayers = 4 - currentPlayers.length - getReservedPendingCount(match);
        
        if (neededPlayers <= 0) continue;
        
        // Sort by wait time
        const sortedPlayers = [...currentAvailable].sort((a, b) => a.joinedAt - b.joinedAt);
        
        // Current match composition
        const currentMales = currentPlayers.filter(p => p.gender === 'male').length;
        const currentFemales = currentPlayers.filter(p => p.gender === 'female').length;
        const hasNonExpertInMatch = currentPlayers.some(p => p.level !== 'Expert');
        const novicesInMatch = currentPlayers.filter(p => p.level === 'Novice');
        
        // Helper functions
        // Rule: Advanced cannot pair with ANY Novice for 3 matches after pairing with a Novice
        const canAdvancedPairWithNovice = (advancedPlayer, novicePlayer = null) => {
          // Check 3-match cooldown: use pairedNovices to know if they've ever matched with novice
          if ((advancedPlayer.pairedNovices || []).length > 0) {
            const matchesSinceNovice = (advancedPlayer.playCount || 0) - (advancedPlayer.lastNoviceMatchAt || 0);
            if (matchesSinceNovice < 3) return false;
          }
          if (novicePlayer && (advancedPlayer.pairedNovices || []).includes(novicePlayer.id)) return false;
          return true;
        };
        
        // Rule: Novice cannot pair with ANY Advanced for 3 matches after pairing with an Advanced
        const canNovicePairWithAdvanced = (novicePlayer, advancedPlayer = null) => {
          // Check 3-match cooldown: use pairedAdvanced to know if they've ever matched with advanced
          if ((novicePlayer.pairedAdvanced || []).length > 0) {
            const matchesSinceAdvanced = (novicePlayer.playCount || 0) - (novicePlayer.lastAdvancedMatchAt || 0);
            if (matchesSinceAdvanced < 3) return false;
          }
          if (advancedPlayer && (novicePlayer.pairedAdvanced || []).includes(advancedPlayer.id)) return false;
          return true;
        };
        
        // Rule: Intermediate cannot pair with Novice more than twice total, or same novice twice, or 2 in a row
        const canIntermediatePairWithNovice = (intermediatePlayer, novicePlayer = null) => {
          if ((intermediatePlayer.intermediateNoviceCount || 0) >= 2) return false;
          // Check 2-in-a-row using intermediateNoviceCount to know if they've matched with novice before
          if ((intermediatePlayer.intermediateNoviceCount || 0) > 0) {
            const matchesSinceNovice = (intermediatePlayer.playCount || 0) - (intermediatePlayer.lastIntermediateNoviceMatchAt || 0);
            if (matchesSinceNovice < 2) return false; // Need at least 2 (the novice match + 1 more)
          }
          if (novicePlayer && (intermediatePlayer.pairedNovicesAsIntermediate || []).includes(novicePlayer.id)) return false;
          return true;
        };
        
        const getLevelScore = (level) => {
          const scores = { 'Expert': 4, 'Advanced': 3, 'Intermediate': 2, 'Novice': 1 };
          return scores[level] || 0;
        };
        
        const canAddPlayer = (player, selectedPlayers, targetGenderMode) => {
          const allPlayers = [...currentPlayers, ...selectedPlayers];
          const totalMales = allPlayers.filter(p => p.gender === 'male').length + (player.gender === 'male' ? 1 : 0);
          const totalFemales = allPlayers.filter(p => p.gender === 'female').length + (player.gender === 'female' ? 1 : 0);
          const novicesInSelection = [...novicesInMatch, ...selectedPlayers.filter(p => p.level === 'Novice')];
          const hasNovice = novicesInSelection.length > 0;
          const hasNonExpert = allPlayers.some(p => p.level !== 'Expert') || hasNonExpertInMatch;
          
          if (targetGenderMode === 'male' && player.gender !== 'male') return false;
          if (targetGenderMode === 'female' && player.gender !== 'female') return false;
          if (targetGenderMode === 'mixed') {
            if (player.gender === 'male' && totalMales > 2) return false;
            if (player.gender === 'female' && totalFemales > 2) return false;
          }
          
          if (player.level === 'Expert' && hasNonExpert && !allPlayers.some(p => p.level === 'Expert')) return false;
          if (player.level !== 'Expert' && allPlayers.length > 0 && allPlayers.every(p => p.level === 'Expert')) return false;
          
          // Advanced-Novice restrictions
          if (player.level === 'Advanced' && hasNovice) {
            if (!canAdvancedPairWithNovice(player, null)) return false;
            for (const novice of novicesInSelection) {
              if ((player.pairedNovices || []).includes(novice.id)) return false;
              if (!canNovicePairWithAdvanced(novice, null)) return false;
              if ((novice.pairedAdvanced || []).includes(player.id)) return false;
            }
          }
          if (player.level === 'Novice') {
            const advancedPlayers = allPlayers.filter(p => p.level === 'Advanced');
            const intermediatePlayers = allPlayers.filter(p => p.level === 'Intermediate');
            
            if (advancedPlayers.length > 0 && !canNovicePairWithAdvanced(player, null)) return false;
            for (const adv of advancedPlayers) {
              if (!canAdvancedPairWithNovice(adv, null)) return false;
              if ((adv.pairedNovices || []).includes(player.id)) return false;
              if ((player.pairedAdvanced || []).includes(adv.id)) return false;
            }
            
            // Check Intermediate restrictions
            for (const inter of intermediatePlayers) {
              if (!canIntermediatePairWithNovice(inter, player)) return false;
            }
          }
          
          // Intermediate-Novice restrictions
          if (player.level === 'Intermediate' && hasNovice) {
            if (!canIntermediatePairWithNovice(player, null)) return false;
            for (const novice of novicesInSelection) {
              if ((player.pairedNovicesAsIntermediate || []).includes(novice.id)) return false;
            }
          }
          
          return true;
        };
        
        let selectedPlayers = [];
        let targetGenderMode;
        
        // Determine target gender mode
        if (currentPlayers.length === 0) {
          const isMixed = Math.random() < 0.30;
          if (isMixed) {
            targetGenderMode = 'mixed';
          } else {
            const longestWaitMale = sortedPlayers.find(p => p.gender === 'male');
            const longestWaitFemale = sortedPlayers.find(p => p.gender === 'female');
            if (longestWaitMale && longestWaitFemale) {
              targetGenderMode = longestWaitMale.joinedAt <= longestWaitFemale.joinedAt ? 'male' : 'female';
            } else if (longestWaitMale) {
              targetGenderMode = 'male';
            } else if (longestWaitFemale) {
              targetGenderMode = 'female';
            } else {
              targetGenderMode = 'mixed';
            }
          }
        } else if (currentMales > 0 && currentFemales > 0) {
          targetGenderMode = 'mixed';
        } else if (currentMales > 0) {
          targetGenderMode = 'male';
        } else {
          targetGenderMode = 'female';
        }
        
        const initialMode = targetGenderMode;
        const usedPlayerIds = new Set();
        
        // Sort players with preference for Advanced males when in male mode
        const hasAdvancedMaleInMatch = currentPlayers.some(p => p.level === 'Advanced' && p.gender === 'male');
        let playersToConsider = [...sortedPlayers];
        if (targetGenderMode === 'male' || hasAdvancedMaleInMatch) {
          playersToConsider.sort((a, b) => {
            const aIsAdvancedMale = a.level === 'Advanced' && a.gender === 'male';
            const bIsAdvancedMale = b.level === 'Advanced' && b.gender === 'male';
            if (aIsAdvancedMale && !bIsAdvancedMale) return -1;
            if (!aIsAdvancedMale && bIsAdvancedMale) return 1;
            return a.joinedAt - b.joinedAt;
          });
        }
        
        for (const player of playersToConsider) {
          if (selectedPlayers.length >= neededPlayers) break;
          if (canAddPlayer(player, selectedPlayers, targetGenderMode)) {
            selectedPlayers.push(player);
            usedPlayerIds.add(player.id);
          }
        }
        
        // Try mixed fallback
        if (selectedPlayers.length < neededPlayers && (initialMode === 'male' || initialMode === 'female')) {
          const currentAndSelectedMales = currentMales + selectedPlayers.filter(p => p.gender === 'male').length;
          const currentAndSelectedFemales = currentFemales + selectedPlayers.filter(p => p.gender === 'female').length;
          
          if (currentAndSelectedMales <= 2 && currentAndSelectedFemales <= 2) {
            targetGenderMode = 'mixed';
            for (const player of playersToConsider) {
              if (selectedPlayers.length >= neededPlayers) break;
              if (usedPlayerIds.has(player.id)) continue;
              if (player.level === 'Expert') continue;
              if (canAddPlayer(player, selectedPlayers, targetGenderMode)) {
                selectedPlayers.push(player);
                usedPlayerIds.add(player.id);
              }
            }
          }
        }
        
        // Sort and add to match
        selectedPlayers.sort((a, b) => getLevelScore(b.level) - getLevelScore(a.level));
        
        if (selectedPlayers.length > 0) {
          allAddedPlayers.push(...selectedPlayers.map(p => ({ playerId: p.id, matchId: match.id })));
          addedAnyThisRound = true;
        }
      }
      
      // Check if there are still available players after this round
      const remainingPlayers = getAvailablePoolPlayers().filter(p => 
        !allAddedPlayers.some(added => added.playerId === p.id)
      );
      
      // If there are still players remaining, we should continue
      // This ensures we create new matches even if existing incomplete matches couldn't be filled
      if (remainingPlayers.length > 0) {
        // Check if all existing matches are either complete or we couldn't add to them
        const allMatchesComplete = localMatches.every(m => getMatchPlayerCount(m) >= 4);
        
        if (allMatchesComplete || !addedAnyThisRound) {
          // Create a new match for the remaining players
          const newMatch = {
            id: Date.now() + Math.random() + iterations + 0.5,
            matchNumber: localNextMatchNumber,
            players: [],
            preferredCourts: []
          };
          localNextMatchNumber++;
          localMatches = [...localMatches, newMatch];
          createdMatchIds.push(newMatch.id);
          continueProcessing = true;
        }
        // If we added players this round, continue to see if we can add more
      } else {
        // No more players, stop
        continueProcessing = false;
      }
    }
    
    // Apply all changes at once
    if (allAddedPlayers.length > 0 || createdMatchIds.length > 0) {
      // Store for undo
      setLastSmartQueueAll({
        addedPlayers: allAddedPlayers,
        createdMatchIds: createdMatchIds,
        timestamp: now
      });
      
      // Clear single smart match undo since we're doing queue all
      setLastSmartMatch(null);
      
      // Clear ALL previous highlights and set new ones
      setSmartMatchedPlayers(() => {
        const fresh = {};
        allAddedPlayers.forEach(({ playerId }) => {
          fresh[playerId] = now;
        });
        return fresh;
      });
      
      // Update next match number if we created matches
      if (createdMatchIds.length > 0) {
        setNextMatchNumber(localNextMatchNumber);
      }
      
      // Update matches
      setMatches(prev => {
        let updated = [...prev];
        
        // Add any newly created matches
        createdMatchIds.forEach(newId => {
          const newMatch = localMatches.find(m => m.id === newId);
          if (newMatch && !updated.find(m => m.id === newId)) {
            updated.push(newMatch);
          }
        });
        
        // Add players to matches and track smartMatchedPlayerIds
        return updated.map(m => {
          const playersToAdd = allAddedPlayers
            .filter(ap => ap.matchId === m.id)
            .map(ap => poolPlayers.find(p => p.id === ap.playerId))
            .filter(Boolean);
          
          if (playersToAdd.length > 0) {
            flyPlayersToMatch(playersToAdd, m.id, isDarkMode);
            // Merge with any existing smartMatchedPlayerIds
            const existingIds = m.smartMatchedPlayerIds || [];
            const newIds = playersToAdd.map(p => p.id);
            const mergedIds = [...new Set([...existingIds, ...newIds])];
            return { ...m, players: [...m.players, ...playersToAdd], smartMatchedPlayerIds: mergedIds };
          }
          return m;
        });
      });
    }
  };

  // Undo Smart Queue All
  const undoSmartQueueAll = () => {
    if (!lastSmartQueueAll) return;
    
    const { addedPlayers, createdMatchIds = [] } = lastSmartQueueAll;

    // Send each player home from the match they were placed in
    addedPlayers.forEach(({ playerId, matchId }) => {
      const player = players.find(p => p.id === playerId);
      if (player) flyMatchPlayersHome(matchId, [player]);
    });

    // Group by match
    const playersByMatch = {};
    addedPlayers.forEach(({ playerId, matchId }) => {
      if (!playersByMatch[matchId]) playersByMatch[matchId] = [];
      playersByMatch[matchId].push(playerId);
    });
    
    // Remove players from matches and delete created matches
    setMatches(prev => {
      return prev
        .filter(m => !createdMatchIds.includes(m.id)) // Remove created matches
        .map(m => {
          const playerIdsToRemove = playersByMatch[m.id] || [];
          if (playerIdsToRemove.length > 0) {
            return {
              ...m,
              players: m.players.filter(p => !playerIdsToRemove.includes(p.id))
            };
          }
          return m;
        });
    });
    
    // Clear smart matched tracking
    setSmartMatchedPlayers(prev => {
      const updated = { ...prev };
      addedPlayers.forEach(({ playerId }) => delete updated[playerId]);
      return updated;
    });
    
    // Clear the undo state
    setLastSmartQueueAll(null);
  };

  // ==================== Court Functions ====================
  
  const addCourt = () => {
    const trimmedName = newCourtName.trim();
    if (trimmedName) {
      // Check for duplicate name (case-insensitive)
      const isDuplicate = courts.some(c => c.name.toLowerCase() === trimmedName.toLowerCase());
      if (isDuplicate) {
        showAlert(`A court named "${trimmedName}" already exists.`);
        return;
      }
      setCourts(prev => [...prev, { id: Date.now(), name: trimmedName, match: null, startTime: null }]);
      setNewCourtName('');
    }
  };

  const deleteCourt = async (courtId) => {
    const court = courts.find(c => c.id === courtId);
    const confirmMessage = court && court.match 
      ? `Are you sure you want to delete "${court.name}"? There is an active match on this court - the players will be returned to the pool.`
      : `Are you sure you want to delete "${court?.name || 'this court'}"?`;
    
    if (!await showConfirm(confirmMessage)) return;
    
    setCourts(prev => {
      const courtToDelete = prev.find(c => c.id === courtId);
      if (courtToDelete && courtToDelete.match) {
        const matchPlayerIds = courtToDelete.match.players.map(p => p.id);
        
        // Update existing pool players' joinedAt time, or add them if not in pool
        setPoolPlayers(prevPool => {
          const updatedPool = prevPool.map(p => {
            if (matchPlayerIds.includes(p.id)) {
              return { ...p, joinedAt: Date.now() };
            }
            return p;
          });
          
          const existingIds = new Set(prevPool.map(p => p.id));
          const newPlayers = courtToDelete.match.players
            .filter(p => !existingIds.has(p.id))
            .map(p => ({ 
              ...p, 
              joinedAt: Date.now(), 
              playCount: p.playCount || 0,
              noviceMatchCount: p.noviceMatchCount || 0
            }));
          
          return [...updatedPool, ...newPlayers];
        });
      }
      return prev.filter(c => c.id !== courtId);
    });
  };

  const renameCourt = (courtId, newName) => {
    const trimmedName = newName.trim();
    if (trimmedName) {
      // Check for duplicate name (case-insensitive), excluding the current court
      const isDuplicate = courts.some(c => c.id !== courtId && c.name.toLowerCase() === trimmedName.toLowerCase());
      if (isDuplicate) {
        showAlert(`A court named "${trimmedName}" already exists.`);
        return;
      }
      setCourts(prev => prev.map(c => c.id === courtId ? { ...c, name: trimmedName } : c));
    }
    setEditingCourtId(null);
    setEditingCourtName('');
  };

  const moveMatchToCourt = async (matchId, courtId) => {
    // Get the match first before we modify state
    const matchToMove = matches.find(m => m.id === matchId);
    if (!matchToMove || matchToMove.players.length === 0) return;
    
    // Get the court name for messages
    const targetCourt = courts.find(c => c.id === courtId);
    if (!targetCourt || targetCourt.match) return; // Court not found or already occupied
    
    // Check 1: If match has preferred courts and this court is NOT in the list
    const hasPreferences = matchToMove.preferredCourts && matchToMove.preferredCourts.length > 0;
    if (hasPreferences && !matchToMove.preferredCourts.includes(courtId)) {
      const preferredNames = matchToMove.preferredCourts
        .map(cId => courts.find(c => c.id === cId)?.name || 'Unknown')
        .join(', ');
      const confirmed = await showConfirm(
        `⚠️ Non-Preferred Court Warning\n\n` +
        `Match #${matchToMove.matchNumber} is waiting for: ${preferredNames}\n\n` +
        `You are assigning them to "${targetCourt.name}" which is not in their preferred list.\n\n` +
        `Do you want to proceed anyway?`
      );
      if (!confirmed) return;
    }
    
    // Check 2: If match has NO preferences, check if other matches with lower matchNumber want this court
    if (!hasPreferences) {
      const matchesWaitingForCourt = matches.filter(m => 
        m.id !== matchId && 
        m.matchNumber < matchToMove.matchNumber &&
        m.preferredCourts && 
        m.preferredCourts.includes(courtId)
      ).sort((a, b) => a.matchNumber - b.matchNumber);
      
      if (matchesWaitingForCourt.length > 0) {
        const waitingInfo = matchesWaitingForCourt.map(m => {
          const playerNames = m.players.map(p => p.name).join(', ') || 'No players yet';
          return `• Match #${m.matchNumber}: ${playerNames}`;
        }).join('\n');
        
        const confirmed = await showConfirm(
          `⚠️ Players Waiting for This Court\n\n` +
          `The following matches are waiting for "${targetCourt.name}":\n\n` +
          `${waitingInfo}\n\n` +
          `Do you want to assign Match #${matchToMove.matchNumber} to this court anyway?`
        );
        if (!confirmed) return;
      }
    }
    
    // Check 3: Check if there are lower ID matches (complete) that can also be assigned to this court
    const lowerCompletedMatches = matches.filter(m => 
      m.id !== matchId && 
      m.matchNumber < matchToMove.matchNumber &&
      m.players.length === 4 // Complete matches only
    ).sort((a, b) => a.matchNumber - b.matchNumber);
    
    if (lowerCompletedMatches.length > 0) {
      // Check if they can use this court (either no preference or this court is preferred)
      const eligibleLowerMatches = lowerCompletedMatches.filter(m => {
        const hasPrefs = m.preferredCourts && m.preferredCourts.length > 0;
        return !hasPrefs || m.preferredCourts.includes(courtId);
      });
      
      if (eligibleLowerMatches.length > 0) {
        const eligibleInfo = eligibleLowerMatches
          .map(m => `Match #${m.matchNumber}`)
          .join('\n');
        
        const confirmed = await showConfirm(
          `The following matches are higher in priority:\n\n` +
          `${eligibleInfo}\n\n` +
          `Are you sure you want to skip them?`
        );
        if (!confirmed) {
          // Highlight eligible matches for 10 seconds
          const now = Date.now();
          const highlightedIds = {};
          eligibleLowerMatches.forEach(m => {
            highlightedIds[m.id] = now;
          });
          setHighlightedPriorityMatches(prev => ({ ...prev, ...highlightedIds }));
          return;
        }
      }
    }
    
    // Get player IDs being sent to court
    const playerIds = matchToMove.players.map(p => p.id);
    
    // Record wait times for average calculation
    const now = Date.now();
    // If this court was just released by largely the same group, their match
    // effectively never stopped — carry the original start time over.
    const previousOccupancy = lastCourtOccupancy.current[courtId];
    let resumedStartTime = null;
    if (previousOccupancy && Date.now() - previousOccupancy.releasedAt <= 5 * 60 * 1000) {
      const returning = matchToMove.players
        .filter(p => previousOccupancy.playerIds.includes(p.id)).length;
      if (returning >= Math.ceil(previousOccupancy.playerIds.length / 2)) {
        resumedStartTime = previousOccupancy.startTime;
      }
    }
    if (resumedStartTime) delete lastCourtOccupancy.current[courtId];

    // Each player walks onto the court, one after another
    flyPlayersToCourt(matchToMove.players, matchId, courtId, isDarkMode);

    const waitTimes = matchToMove.players
      .filter(p => p.joinedAt)
      .map(p => Math.round((now - p.joinedAt) / 60000)); // Convert to minutes
    
    if (waitTimes.length > 0) {
      setWaitTimeHistory(prev => {
        // Keep last 100 entries to avoid unlimited growth
        const updated = [...prev, ...waitTimes];
        return updated.slice(-100);
      });
    }
    
    // Check if match has both Advanced and Novice players
    const hasAdvanced = matchToMove.players.some(p => p.level === 'Advanced');
    const hasNovice = matchToMove.players.some(p => p.level === 'Novice');
    const hasIntermediate = matchToMove.players.some(p => p.level === 'Intermediate');
    const advancedWithNovice = hasAdvanced && hasNovice;
    const intermediateWithNovice = hasIntermediate && hasNovice;
    
    // Get IDs of Advanced, Intermediate, and Novice players in this match
    const advancedPlayerIds = matchToMove.players
      .filter(p => p.level === 'Advanced')
      .map(p => p.id);
    const intermediatePlayerIds = matchToMove.players
      .filter(p => p.level === 'Intermediate')
      .map(p => p.id);
    const novicePlayerIds = matchToMove.players
      .filter(p => p.level === 'Novice')
      .map(p => p.id);
    
    // Update pool players: track Advanced-Novice and Intermediate-Novice pairing history
    setPoolPlayers(prev => prev.map(p => {
      if (playerIds.includes(p.id)) {
        const updates = {};
        
        // For Advanced players matched with Novice
        if (p.level === 'Advanced' && advancedWithNovice) {
          // Track when they last matched with a Novice (using playCount)
          updates.lastNoviceMatchAt = p.playCount || 0;
          // Add the novice IDs to their pairedNovices list
          const newPairedNovices = [...(p.pairedNovices || [])];
          novicePlayerIds.forEach(noviceId => {
            if (!newPairedNovices.includes(noviceId)) {
              newPairedNovices.push(noviceId);
            }
          });
          updates.pairedNovices = newPairedNovices;
        }
        
        // For Intermediate players matched with Novice
        if (p.level === 'Intermediate' && intermediateWithNovice) {
          // Track when they last matched with a Novice
          updates.lastIntermediateNoviceMatchAt = p.playCount || 0;
          // Increment total novice match count
          updates.intermediateNoviceCount = (p.intermediateNoviceCount || 0) + 1;
          // Add the novice IDs to their pairedNovicesAsIntermediate list
          const newPairedNovices = [...(p.pairedNovicesAsIntermediate || [])];
          novicePlayerIds.forEach(noviceId => {
            if (!newPairedNovices.includes(noviceId)) {
              newPairedNovices.push(noviceId);
            }
          });
          updates.pairedNovicesAsIntermediate = newPairedNovices;
        }
        
        // For Novice players matched with Advanced
        if (p.level === 'Novice' && advancedWithNovice) {
          // Track when they last matched with an Advanced (using playCount)
          updates.lastAdvancedMatchAt = p.playCount || 0;
          // Add the advanced IDs to their pairedAdvanced list
          const newPairedAdvanced = [...(p.pairedAdvanced || [])];
          advancedPlayerIds.forEach(advId => {
            if (!newPairedAdvanced.includes(advId)) {
              newPairedAdvanced.push(advId);
            }
          });
          updates.pairedAdvanced = newPairedAdvanced;
        }
        
        if (Object.keys(updates).length > 0) {
          return { ...p, ...updates };
        }
      }
      return p;
    }));
    
    // Use smartMatchedPlayerIds stored on the match (not from smartMatchedPlayers state)
    const smartMatchedPlayerIds = matchToMove.smartMatchedPlayerIds || [];
    
    setCourts(prev => {
      return prev.map(c => 
        c.id === courtId ? { 
          ...c, 
          match: { ...matchToMove, smartMatchedPlayerIds }, 
          startTime: resumedStartTime || Date.now(),
          // Courts are ordered by this, oldest first. A resumed match keeps its
          // original time so it stays in place by how long it has been running,
          // rather than being sent to the bottom as a fresh assignment.
          sortOrder: resumedStartTime || Date.now()
        } : c
      );
    });
    
    // Scroll to the court only when this is a fresh assignment. A match that
    // went back to the same court keeps its timer and its position in the
    // order, so there is nothing at the bottom to scroll to.
    if (!resumedStartTime) {
      setScrollToCourtId(courtId);
      // Clear scroll trigger after a short delay
      setTimeout(() => setScrollToCourtId(null), 2000);
    }
    
    // Determine if we need to swap after removing this match
    const remainingMatches = matches.filter(m => m.id !== matchId);
    let swapTopMatchId = null;
    let swapWithMatchId = null;
    
    if (remainingMatches.length > 1) {
      const sorted = [...remainingMatches].sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
      const topMatch = sorted[0];
      const topMatchReservations = matchReservations[topMatch.id];
      const topHasReservations = topMatchReservations && Object.keys(topMatchReservations).length > 0;
      
      if (topHasReservations) {
        // First, try to find a match without reservations that has players
        for (let i = 1; i < sorted.length; i++) {
          const matchRes = matchReservations[sorted[i].id];
          const hasRes = matchRes && Object.keys(matchRes).length > 0;
          if (!hasRes && sorted[i].players.length > 0) {
            swapTopMatchId = topMatch.id;
            swapWithMatchId = sorted[i].id;
            break;
          }
        }
        
        // If no match with players found, find any empty match without reservations
        if (!swapWithMatchId) {
          for (let i = 1; i < sorted.length; i++) {
            const matchRes = matchReservations[sorted[i].id];
            const hasRes = matchRes && Object.keys(matchRes).length > 0;
            if (!hasRes) {
              swapTopMatchId = topMatch.id;
              swapWithMatchId = sorted[i].id;
              break;
            }
          }
        }
      }
    }
    
    // The queue also swaps a reserved match down the list here. That's a real
    // reorder, but animating it on top of the slide-up reads as a twitch, so
    // those two cards move instantly instead.
    if (swapTopMatchId && swapWithMatchId) {
      skipNextFlip([`m-${swapTopMatchId}`, `m-${swapWithMatchId}`]);
    }

    setMatches(prev => {
      const remaining = prev.filter(m => m.id !== matchId);
      
      // Swap players if needed
      if (swapTopMatchId && swapWithMatchId) {
        const topMatch = remaining.find(m => m.id === swapTopMatchId);
        const swapMatch = remaining.find(m => m.id === swapWithMatchId);
        if (topMatch && swapMatch) {
          return remaining.map(m => {
            if (m.id === swapTopMatchId) {
              return { ...m, players: swapMatch.players };
            }
            if (m.id === swapWithMatchId) {
              return { ...m, players: topMatch.players };
            }
            return m;
          });
        }
      }
      
      return remaining;
    });
    if (selectedMatchId === matchId) setSelectedMatchId(null);
    
    // Clear reservations for this match and swap reservations if needed
    setMatchReservations(prev => {
      const newReservations = { ...prev };
      delete newReservations[matchId];
      
      // Swap reservations if we swapped players
      if (swapTopMatchId && swapWithMatchId) {
        const topRes = newReservations[swapTopMatchId];
        const swapRes = newReservations[swapWithMatchId];
        
        delete newReservations[swapTopMatchId];
        delete newReservations[swapWithMatchId];
        
        if (swapRes && Object.keys(swapRes).length > 0) {
          newReservations[swapTopMatchId] = swapRes;
        }
        if (topRes && Object.keys(topRes).length > 0) {
          newReservations[swapWithMatchId] = topRes;
        }
      }
      
      return newReservations;
    });
  };

  const endMatch = (courtId) => {
    // Get court data first (outside of setState callback)
    const court = courts.find(c => c.id === courtId);
    if (!court || !court.match) return;
    
    const matchPlayerIds = court.match.players.map(p => p.id);
    const matchPlayers = court.match.players;

    // The four players fly off the court back into the pool, staggered slightly
    // so they read as a group leaving rather than one blur.
    flyPlayersToPool(matchPlayers, courtId, isDarkMode);
    
    // Save undo state before making any changes
    const previousPoolPlayersState = poolPlayers
      .filter(p => matchPlayerIds.includes(p.id))
      .map(p => ({ ...p }));
    
    setLastEndedMatch({
      courtId: court.id,
      courtName: court.name,
      match: { ...court.match },
      startTime: court.startTime,
      previousPoolPlayers: previousPoolPlayersState,
      matchHistoryLength: matchHistory.length,
      removedWhileOnCourtPlayers: [...removedWhileOnCourt].filter(id => matchPlayerIds.includes(id))
    });
    
    // Save match to history (only once)
    setMatchHistory(prevHistory => [...prevHistory, {
      ...court.match,
      status: 'completed',
      courtName: court.name,
      startTime: court.startTime,
      endedAt: Date.now()
    }]);
    
    // Filter out players who were removed from pool while on court
    const playersToReturn = matchPlayers.filter(p => !removedWhileOnCourt.has(p.id));
    const playerIdsToReturn = playersToReturn.map(p => p.id);
    
    // Update existing pool players: increment playCount and reset joinedAt
    setPoolPlayers(prevPool => {
      const updatedPool = prevPool.map(p => {
        if (playerIdsToReturn.includes(p.id)) {
          // Increment playCount and reset wait time for players returning from match
          return { ...p, joinedAt: Date.now(), playCount: (p.playCount || 0) + 1 };
        }
        return p;
      });
      
      // Add any players not already in pool (with incremented playCount), excluding removed players
      const existingIds = new Set(prevPool.map(p => p.id));
      const newPlayers = playersToReturn
        .filter(p => !existingIds.has(p.id))
        .map(p => ({ 
          ...p, 
          joinedAt: Date.now(), 
          playCount: (p.playCount || 0) + 1,
          // Preserve all tracking properties
          noviceMatchCount: p.noviceMatchCount || 0,
          lastNoviceMatchAt: p.lastNoviceMatchAt || 0,
          lastAdvancedMatchAt: p.lastAdvancedMatchAt || 0,
          pairedNovices: p.pairedNovices || [],
          pairedAdvanced: p.pairedAdvanced || [],
          lastMatchedNovice: p.lastMatchedNovice || false,
          intermediateNoviceCount: p.intermediateNoviceCount || 0,
          lastIntermediateNoviceMatchAt: p.lastIntermediateNoviceMatchAt || 0,
          pairedNovicesAsIntermediate: p.pairedNovicesAsIntermediate || []
        }));
      
      return [...updatedPool, ...newPlayers];
    });
    
    // Clear the removed players from tracking (they've been handled)
    setRemovedWhileOnCourt(prev => {
      const newSet = new Set(prev);
      matchPlayerIds.forEach(id => newSet.delete(id));
      return newSet;
    });
    
    // Clear court
    setCourts(prev => prev.map(c => 
      c.id === courtId ? { ...c, match: null, startTime: null } : c
    ));
  };

  // Undo the last ended match
  const undoEndMatch = () => {
    if (!lastEndedMatch) return;
    
    const { courtId, match, startTime, previousPoolPlayers, matchHistoryLength, removedWhileOnCourtPlayers } = lastEndedMatch;
    const matchPlayerIds = match.players.map(p => p.id);
    
    // Players fly from the pool back onto the court they came from
    if (match?.players?.length) {
      flyPlayerGroup(
        match.players,
        `[data-court-card="${courtId}"]`,
        () => `[data-court-card="${courtId}"]`,
        isDarkMode
      );
    }

    // Remove the match from history (it was the last one added)
    setMatchHistory(prev => prev.slice(0, matchHistoryLength));
    
    // Restore court with match
    setCourts(prev => prev.map(c => 
      c.id === courtId ? { ...c, match, startTime } : c
    ));
    
    // Restore pool players to their previous state
    setPoolPlayers(prev => {
      // Remove players who were added back when match ended
      let updated = prev.filter(p => !matchPlayerIds.includes(p.id));
      
      // Add back the previous state of players who were in pool before
      previousPoolPlayers.forEach(prevPlayer => {
        updated.push(prevPlayer);
      });
      
      return updated;
    });
    
    // Restore removed while on court tracking
    if (removedWhileOnCourtPlayers && removedWhileOnCourtPlayers.length > 0) {
      setRemovedWhileOnCourt(prev => {
        const newSet = new Set(prev);
        removedWhileOnCourtPlayers.forEach(id => newSet.add(id));
        return newSet;
      });
    }
    
    // Clear the undo state
    setLastEndedMatch(null);
  };

  const returnMatchToQueue = (courtId) => {
    // Remember who was on this court and since when, so if the same group goes
    // straight back their timer can continue instead of restarting.
    const leavingCourt = courts.find(c => c.id === courtId);
    if (leavingCourt?.match && leavingCourt.startTime) {
      lastCourtOccupancy.current[courtId] = {
        playerIds: leavingCourt.match.players.map(p => p.id),
        startTime: leavingCourt.startTime,
        releasedAt: Date.now(),
      };
    }

    // Bring the destination match into view first, then fly the players back to
    // it — otherwise the cards travel to a slot that's off screen.
    const returningMatchId = leavingCourt?.match?.id;
    if (returningMatchId) setScrollToMatchId(returningMatchId);

    if (leavingCourt?.match?.players?.length) {
      // Positions are captured now, while the players are still on the court;
      // only the flight itself waits for the scroll to finish.
      flyPlayerGroup(
        leavingCourt.match.players,
        `[data-court-card="${courtId}"]`,
        (p) => `[data-slot-player="${p.id}"]`,
        isDarkMode,
        420
      );
    }

    setCourts(prev => {
      const court = prev.find(c => c.id === courtId);
      if (court && court.match) {
        // Filter out players who were removed from pool while on court
        const filteredPlayers = court.match.players.filter(p => !removedWhileOnCourt.has(p.id));
        const matchWithFilteredPlayers = { ...court.match, players: filteredPlayers };
        
        // Add the match back to the matches queue at the correct position (by matchNumber)
        setMatches(prevMatches => {
          // Find the right position to insert based on matchNumber
          const insertIndex = prevMatches.findIndex(m => m.matchNumber > matchWithFilteredPlayers.matchNumber);
          if (insertIndex === -1) {
            // Insert before the last empty match if one exists, otherwise at end
            const lastMatch = prevMatches[prevMatches.length - 1];
            if (lastMatch && lastMatch.players && lastMatch.players.length === 0) {
              return [...prevMatches.slice(0, -1), matchWithFilteredPlayers, lastMatch];
            }
            return [...prevMatches, matchWithFilteredPlayers];
          }
          return [...prevMatches.slice(0, insertIndex), matchWithFilteredPlayers, ...prevMatches.slice(insertIndex)];
        });
        
        // Track that this match was returned (for pulsating highlight)
        setReturnedMatches(prev => ({
          ...prev,
          [court.match.id]: Date.now()
        }));
        
        // Clear the removed players from tracking
        const matchPlayerIds = court.match.players.map(p => p.id);
        setRemovedWhileOnCourt(prevRemoved => {
          const newSet = new Set(prevRemoved);
          matchPlayerIds.forEach(id => newSet.delete(id));
          return newSet;
        });
        
        return prev.map(c => 
          c.id === courtId ? { ...c, match: null, startTime: null } : c
        );
      }
      return prev;
    });
  };

  // Tidy reservations after any match change. Reservations keep whichever slot
  // they were made on (the queue lays players out around them), so this only
  // drops ones that no longer make sense: the reserved player has since joined
  // the match, the match is gone, or there are more reservations than free
  // seats.
  useEffect(() => {
    setMatchReservations(prev => {
      let changed = false;
      const next = {};

      Object.entries(prev).forEach(([matchId, slots]) => {
        const match = matches.find(m => String(m.id) === String(matchId));
        if (!match) { changed = true; return; }

        const inMatch = new Set(match.players.map(p => p.id));
        const kept = {};
        let seatsLeft = 4 - match.players.length;

        Object.entries(slots)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .forEach(([slotIndex, reserved]) => {
            const i = Number(slotIndex);
            if (inMatch.has(reserved.id) || i < 0 || i > 3 || seatsLeft <= 0) {
              changed = true;
              return;
            }
            kept[slotIndex] = reserved;
            seatsLeft -= 1;
          });

        if (Object.keys(kept).length > 0) next[matchId] = kept;
        else if (Object.keys(slots).length > 0) changed = true;
      });

      return changed ? next : prev;
    });
  }, [matches, setMatchReservations]);

  // Mirror the theme classes onto <body>. Dropdowns are rendered through a
  // portal into <body>, which sits outside the app's root element - without
  // this they'd miss the .dark / .neon scoped styling (scrollbars, glows).
  useEffect(() => {
    const body = document.body;
    body.classList.toggle('dark', isDarkMode);
    body.classList.toggle('neon', theme === 'neon');
    return () => {
      body.classList.remove('dark');
      body.classList.remove('neon');
    };
  }, [isDarkMode, theme]);

  // Typing anywhere on the main interface goes into the player pool search, so
  // you can just start typing a name without clicking the field first.
  useEffect(() => {
    const anyWindowOpen = isDbModalOpen || isHistoryModalOpen || isAboutModalOpen
      || isReportsModalOpen || isSettingsModalOpen;

    const onKeyDown = (e) => {
      if (anyWindowOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // An alert/confirm/prompt dialog is showing - don't type behind it.
      if (document.querySelector('[role="alertdialog"]')) return;

      // Don't hijack keys while the user is already typing in a field.
      const t = e.target;
      const tag = t?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || t?.isContentEditable) return;

      if (e.key === 'Backspace') {
        e.preventDefault();
        setPoolSearch(prev => prev.slice(0, -1));
        return;
      }
      if (e.key === 'Escape') {
        setPoolSearch('');
        return;
      }
      // Single printable characters only, so F1 and other shortcuts still work.
      if (e.key.length === 1 && /[a-zA-Z0-9 '.-]/.test(e.key)) {
        e.preventDefault();
        setPoolSearch(prev => prev + e.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDbModalOpen, isHistoryModalOpen, isAboutModalOpen, isReportsModalOpen, isSettingsModalOpen]);

  // When a pool search narrows to exactly one player, that player is pointed
  // out wherever they are on the courts or in the queue — so you can see at a
  // glance where someone actually is.
  const searchHighlightPlayerId = useMemo(() => {
    const q = poolSearch.trim().toLowerCase();
    if (!q) return null;
    const found = [...poolPlayers, ...notPresentPlayers]
      .filter(p => p.name.toLowerCase().includes(q));
    return found.length === 1 ? found[0].id : null;
  }, [poolSearch, poolPlayers, notPresentPlayers]);

  // ==================== Derived State ====================
  
  const selectedMatch = matches.find(m => m.id === selectedMatchId);

  // ==================== Render ====================
  
  // Theme classes
  const themeClasses = isDarkMode 
    ? 'bg-slate-950 text-white'
    : 'bg-slate-100 text-slate-900';

  // Show loading state while checking license
  if (isCheckingLicense) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-cyan-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏸</span>
          </div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show license entry modal if no valid license
  if (!isLicenseValid) {
    return (
      <LicenseEntryModal 
        onLicenseValid={handleLicenseValid}
        isExpired={isLicenseExpiredState}
      />
    );
  }
  
  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''} ${theme === 'neon' ? 'neon' : ''} ${themeClasses}`}>
      {/* Background Pattern */}
      <div className={`fixed inset-0 ${isDarkMode ? 'opacity-5' : 'opacity-[0.02]'} bg-pattern`} />

      {/* Ambient aurora wash (dark mode only) */}
      {isDarkMode && <div className="aurora-bg" aria-hidden="true" />}

      {/* Centred in-app alerts (replaces browser alert popups) */}
      <AlertDialog isDarkMode={isDarkMode} />

      {/* Header (z-40 so its dropdowns render above the panels below) */}
      <div className="relative z-40">
      <Header 
        onOpenDatabase={() => setIsDbModalOpen(true)} 
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenAbout={() => setIsAboutModalOpen(true)}
        onOpenReports={() => setIsReportsModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onResetData={resetAllData}
        isDarkMode={isDarkMode}
        theme={theme}
        toggleTheme={cycleTheme}
        playerCount={players.length}
        onClearTimers={confirmClearIdleTimes}
        canClearTimers={poolPlayers.length > 0}
        licenseInfo={licenseInfo}
        syncStatus={syncStatus}
        isOnline={isOnline}
        cloudSyncEnabled={cloudSyncEnabled}
      />
      </div>

      {/* Main Content */}
      <main className="relative max-w-[1920px] mx-auto p-6">
        <div ref={containerRef} className="flex items-stretch h-[calc(100vh-120px)]">
          {/* Left Panel - Player Pool */}
          <div style={{ width: panelWidths.playerPool }} className="flex-shrink-0">
            <PlayerPool
              poolPlayers={poolPlayers}
              notPresentPlayers={notPresentPlayers}
              poolSearch={poolSearch}
              setPoolSearch={setPoolSearch}
              poolLevelFilter={poolLevelFilter}
              setPoolLevelFilter={setPoolLevelFilter}
              isPlayerInMatch={isPlayerInMatch}
              isPlayerInQueue={isPlayerInQueue}
              isPlayerOnCourt={isPlayerOnCourt}
              removeFromPool={removeFromPool}
              moveToAvailable={moveToAvailable}
              moveToNotPresent={moveToNotPresent}
              selectedMatch={selectedMatch}
              addPlayerToMatch={addPlayerToMatch}
              selectedMatchId={selectedMatchId}
              onDropPlayerToPool={removePlayerFromMatch}
              onDropPlayerToNotPresent={movePlayerFromMatchToNotPresent}
              isDarkMode={isDarkMode}
              panelWidth={panelWidths.playerPool}
              allPlayers={players}
              onAddToPool={addToPool}
              onAddToAvailable={addToAvailable}
              onCreatePlayer={addPlayerReturningId}
              highlightPlayerId={searchHighlightPlayerId}
            />
          </div>

          {/* Left Resize Handle */}
          <div
            onMouseDown={() => setIsResizing('left')}
            className={`w-2 flex-shrink-0 cursor-col-resize group flex items-center justify-center mx-1 ${
              isResizing === 'left' ? 'bg-cyan-500/30' : ''
            }`}
          >
            <div className={`w-1 h-16 rounded-full transition-colors ${
              isDarkMode 
                ? 'bg-slate-700 group-hover:bg-cyan-500' 
                : 'bg-slate-300 group-hover:bg-cyan-400'
            } ${isResizing === 'left' ? (isDarkMode ? 'bg-cyan-500' : 'bg-cyan-400') : ''}`} />
          </div>

          {/* Middle Panel - Match Queue */}
          <div className="flex-1 min-w-[300px]" onClick={(e) => {
            // Deselect match when clicking on empty area (not on a match card)
            if (e.target === e.currentTarget) {
              setSelectedMatchId(null);
            }
          }}>
            <MatchQueue
              scrollToBottomToken={queueBottomToken}
              scrollToMatchId={scrollToMatchId}
              onScrolledToMatch={() => setScrollToMatchId(null)}
              highlightPlayerId={searchHighlightPlayerId}
              addExternalPlayerToMatch={addExternalPlayerToMatch}
              matches={matches}
              selectedMatchId={selectedMatchId}
              setSelectedMatchId={setSelectedMatchId}
              createMatch={createMatch}
              deleteMatch={deleteMatch}
              clearMatch={clearMatch}
              removePlayerFromMatch={removePlayerFromMatch}
              smartMatch={smartMatch}
              moveMatchToCourt={moveMatchToCourt}
              courts={courts}
              getAvailablePoolPlayers={getAvailablePoolPlayers}
              addPlayerToMatch={addPlayerToMatch}
              movePlayerBetweenMatches={movePlayerBetweenMatches}
              togglePreferredCourt={togglePreferredCourt}
              clearPreferredCourts={clearPreferredCourts}
              isDarkMode={isDarkMode}
              lastSmartMatch={lastSmartMatch}
              undoSmartMatch={undoSmartMatch}
              smartQueueAll={smartQueueAll}
              lastSmartQueueAll={lastSmartQueueAll}
              undoSmartQueueAll={undoSmartQueueAll}
              smartMatchedPlayers={smartMatchedPlayers}
              currentTime={currentTime}
              averageWaitTime={averageWaitTime}
              clearAllMatches={clearAllMatches}
              swapMatchPlayers={swapMatchPlayers}
              returnedMatches={returnedMatches}
              highlightedPriorityMatches={highlightedPriorityMatches}
              poolPlayers={poolPlayers}
              matchReservations={matchReservations}
              reservePlayerInMatch={reservePlayerInMatch}
              clearReservation={clearReservation}
            />
          </div>

          {/* Right Resize Handle */}
          <div
            onMouseDown={() => setIsResizing('right')}
            className={`w-2 flex-shrink-0 cursor-col-resize group flex items-center justify-center mx-1 ${
              isResizing === 'right' ? 'bg-cyan-500/30' : ''
            }`}
          >
            <div className={`w-1 h-16 rounded-full transition-colors ${
              isDarkMode 
                ? 'bg-slate-700 group-hover:bg-cyan-500' 
                : 'bg-slate-300 group-hover:bg-cyan-400'
            } ${isResizing === 'right' ? (isDarkMode ? 'bg-cyan-500' : 'bg-cyan-400') : ''}`} />
          </div>

          {/* Right Panel - Courts */}
          <div style={{ width: panelWidths.courts }} className="flex-shrink-0">
            <CourtsPanel
              highlightPlayerId={searchHighlightPlayerId}
              courts={courts}
              newCourtName={newCourtName}
              setNewCourtName={setNewCourtName}
              addCourt={addCourt}
              deleteCourt={deleteCourt}
              editingCourtId={editingCourtId}
              setEditingCourtId={setEditingCourtId}
              editingCourtName={editingCourtName}
              setEditingCourtName={setEditingCourtName}
              renameCourt={renameCourt}
              endMatch={endMatch}
              returnMatchToQueue={returnMatchToQueue}
              currentTime={currentTime}
              isDarkMode={isDarkMode}
              lastEndedMatch={lastEndedMatch}
              undoEndMatch={undoEndMatch}
              poolPlayers={poolPlayers}
              matches={matches}
              scrollToCourtId={scrollToCourtId}
              panelWidth={panelWidths.courts}
            />
          </div>
        </div>
      </main>

      {/* Player Database Modal */}
      <PlayerDatabaseModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        players={getVisiblePlayers()}
        onAddPlayer={addPlayer}
        onEditPlayer={editPlayer}
        onDeletePlayer={deletePlayer}
        onAddToPool={addToPool}
        onRemoveFromPool={removeFromPool}
        onRemoveAllFromPool={removeAllFromPool}
        poolPlayers={poolPlayers}
        notPresentPlayers={notPresentPlayers}
        onImportPlayers={importPlayers}
        isDarkMode={isDarkMode}
        licenseInfo={licenseInfo}
        totalPlayerCount={players.length}
        fingerprintIds={Object.entries(fingerprints)
          .filter(([, entry]) => (typeof entry === 'string' ? entry : entry?.template))
          .map(([id]) => Number(id))}
        fingerprints={fingerprints}
        onDeleteFingerprint={deletePlayerFingerprint}
        onResetAllFingerprints={resetAllFingerprints}
        onRemoveDuplicates={removeDuplicatePlayers}
      />

      {/* Match History Modal */}
      <MatchHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        matchHistory={matchHistory}
        clearHistory={clearMatchHistory}
        isDarkMode={isDarkMode}
      />

      {/* About Modal */}
      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
        isDarkMode={isDarkMode}
        licenseInfo={licenseInfo}
        onLicenseUpdate={handleLicenseUpdate}
        playerDatabaseCount={players.length}
        cloudSyncEnabled={cloudSyncEnabled}
        setCloudSyncEnabled={setCloudSyncEnabled}
        syncStatus={syncStatus}
        lastSyncDisplay={lastSyncDisplay}
        syncError={syncError}
        isOnline={isOnline}
        performSync={handleManualSync}
        isFirebaseConfigured={isFirebaseConfigured}
      />

      {/* Reports Modal */}
      <ReportsModal
        isOpen={isReportsModalOpen}
        onClose={() => setIsReportsModalOpen(false)}
        matchHistory={matchHistory}
        players={players}
        onClearReports={clearMatchHistory}
        isDarkMode={isDarkMode}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        isDarkMode={isDarkMode}
        warningSettings={warningSettings}
        onUpdateSettings={setWarningSettings}
      />

      {/* Fingerprint reader: listens for scans, checks in known players,
          and opens the assign flow for unknown fingers. */}
      <FingerprintController
        players={players}
        enrollments={fingerprints}
        enrolledPlayerIds={Object.keys(fingerprints).map(id => Number(id))}
        getPlayerById={(id) => players.find(p => p.id === id) || ((fingerprints[id] || fingerprints[String(id)] || {}).player) || null}
        onCheckIn={checkInPlayerById}
        onEnroll={handleFingerprintEnroll}
        onServiceEnrollments={handleServiceEnrollments}
        onAddPlayer={addPlayerReturningId}
        enabled={true}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

export default App;
