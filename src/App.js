import React, { useState, useEffect, useRef } from 'react';
import { initialPlayers, initialCourts } from './data/initialData';
import useCurrentTime from './hooks/useCurrentTime';
import useLocalStorage from './hooks/useLocalStorage';
import useCloudSync, { SYNC_STATUS } from './hooks/useCloudSync';
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
  SettingsModal
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
function App() {
  // License State
  const [licenseInfo, setLicenseInfo] = useState(null);
  const [isLicenseValid, setIsLicenseValid] = useState(false);
  const [isLicenseExpiredState, setIsLicenseExpiredState] = useState(false);
  const [isCheckingLicense, setIsCheckingLicense] = useState(true);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useLocalStorage('baddixx_darkMode', true);
  
  // Persistent State (saved to localStorage)
  const [players, setPlayers] = useLocalStorage('baddixx_players', initialPlayers);
  const [poolPlayers, setPoolPlayers] = useLocalStorage('baddixx_pool', []);
  const [notPresentPlayers, setNotPresentPlayers] = useLocalStorage('baddixx_notPresent', []); // Players added but not yet available
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
    
    // If last match has at least 1 player, create a new empty match
    const lastMatch = matches[matches.length - 1];
    if (lastMatch && lastMatch.players && lastMatch.players.length > 0) {
      const newMatch = {
        id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        matchNumber: nextMatchNumber,
        players: [],
        createdAt: Date.now()
      };
      setMatches(prev => [...prev, newMatch]);
      setNextMatchNumber(prev => prev + 1);
    }
  }, [matches]);

  // ==================== Reset Function ====================
  
  const resetAllData = () => {
    if (window.confirm('Are you sure you want to reset all session data?\n\nThis will clear:\n• Player Pool (Available & Not Present)\n• All Matches\n• Courts\n\nMatch History and Player Database will be preserved.')) {
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
  
  const clearMatchHistory = () => {
    setMatchHistory([]);
  };

  // ==================== Player Database Functions ====================
  
  const addPlayer = (player) => {
    setPlayers(prev => [...prev, player]);
  };

  const importPlayers = (newPlayers) => {
    setPlayers(prev => {
      const existingNames = new Set(prev.map(p => p.name.toLowerCase()));
      const uniqueNewPlayers = newPlayers.filter(p => !existingNames.has(p.name.toLowerCase()));
      return [...prev, ...uniqueNewPlayers];
    });
  };

  const editPlayer = (updatedPlayer) => {
    // Update in players database
    setPlayers(prev => prev.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
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
    setMatches(prev => prev.map(m => ({
      ...m,
      players: m.players.filter(p => p.id !== playerId)
    })));
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
  const moveToAvailable = (playerId) => {
    const player = notPresentPlayers.find(p => p.id === playerId);
    if (!player) return;
    
    setNotPresentPlayers(prev => prev.filter(p => p.id !== playerId));
    setPoolPlayers(prev => [...prev, {
      ...player,
      joinedAt: Date.now(),
      playCount: 0
    }]);
  };

  // Move player from Available back to Not Present (with warning)
  const moveToNotPresent = (playerId) => {
    const player = poolPlayers.find(p => p.id === playerId);
    if (!player) return;
    
    if (!window.confirm(`Move ${player.name} back to "Not Present"?\n\nTheir idle time and game count will be reset.`)) {
      return;
    }
    
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
  };

  const deleteMatch = (matchId) => {
    // Save match to history before deleting
    const matchToDelete = matches.find(m => m.id === matchId);
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

  const addPlayerToMatch = (matchId, player) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.players.length >= 4 || match.players.find(p => p.id === player.id)) {
      return;
    }
    
    // Check if the next available slot is reserved for someone else
    const nextSlotIndex = match.players.length;
    const reservation = matchReservations[matchId]?.[nextSlotIndex];
    if (reservation && reservation.id !== player.id) {
      alert(`This slot is reserved for: ${reservation.name}`);
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
      const proceed = window.confirm(
        `⚠️ NOVICE OVER-MATCHING ⚠️\n\n${noviceAlertMessages.join('\n\n')}\n\nDo you still want to add ${player.name} to this match?`
      );
      if (!proceed) return;
    }
    
    // Show repeat pairings alert if any issues detected
    if (repeatAlertMessages.length > 0) {
      const proceed = window.confirm(
        `⚠️ REPEAT PAIRINGS ⚠️\n\n${repeatAlertMessages.join('\n\n')}\n\nDo you still want to add ${player.name} to this match?`
      );
      if (!proceed) return;
    }
    
    setMatches(prev => {
      const updatedMatches = prev.map(m => {
        if (m.id === matchId && m.players.length < 4 && !m.players.find(p => p.id === player.id)) {
          return { ...m, players: [...m.players, player] };
        }
        return m;
      });
      
      return updatedMatches;
    });
    
    // Clear any reservation for this player in this match
    clearReservationForPlayer(matchId, player.id);
  };

  const removePlayerFromMatch = (matchId, playerId) => {
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

  const movePlayerBetweenMatches = (sourceMatchId, targetMatchId, player) => {
    const targetMatch = matches.find(m => m.id === targetMatchId);
    if (!targetMatch || targetMatch.players.length >= 4) {
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
      const proceed = window.confirm(
        `⚠️ NOVICE OVER-MATCHING ⚠️\n\n${noviceAlertMessages.join('\n\n')}\n\nDo you still want to move ${player.name} to this match?`
      );
      if (!proceed) return;
    }
    
    // Show repeat pairings alert if any issues detected
    if (repeatAlertMessages.length > 0) {
      const proceed = window.confirm(
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
        return { ...m, players: [...m.players, playerToAdd] };
      }
      return m;
    }));
  };

  const clearMatch = (matchId) => {
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
  const clearAllMatches = () => {
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
    
    // Check if current match has reservations
    const currentMatchReservations = matchReservations[currentMatch.id];
    const currentHasReservations = currentMatchReservations && Object.keys(currentMatchReservations).length > 0;
    
    // Check if target match has reservations
    const targetMatchReservations = matchReservations[targetMatch.id];
    const targetHasReservations = targetMatchReservations && Object.keys(targetMatchReservations).length > 0;
    
    // If moving up and would become position 0 (top) and current has reservations, show error
    if (direction === 'up' && targetSortedIndex === 0 && currentHasReservations) {
      const reservedNames = Object.values(currentMatchReservations).map(p => p.name).join(', ');
      alert(`Cannot move to top of queue.\n\nThis match is waiting for: ${reservedNames}\n\nFill all reserved slots first.`);
      return;
    }
    
    // If moving down from position 0 and target has reservations, show error (target would become top)
    if (direction === 'down' && sortedIndex === 0 && targetHasReservations) {
      const reservedNames = Object.values(targetMatchReservations).map(p => p.name).join(', ');
      alert(`Cannot swap - the match below is waiting for: ${reservedNames}\n\nIt cannot be moved to top of queue until all reserved slots are filled.`);
      return;
    }
    
    // Swap players between the two matches
    setMatches(prev => {
      return prev.map(m => {
        if (m.id === currentMatch.id) {
          return { ...m, players: targetMatch.players };
        }
        if (m.id === targetMatch.id) {
          return { ...m, players: currentMatch.players };
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
    const neededPlayers = 4 - currentPlayers.length;
    
    // Track failure reasons
    let failureReasons = [];
    
    if (neededPlayers <= 0) {
      alert('⚠️ Smart Match Failed\n\nMatch is already full (4 players).');
      return;
    }
    
    if (availablePlayers.length === 0) {
      alert('⚠️ Smart Match Failed\n\nNo available players in the pool.');
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
      // Empty match - decide mode (60% regular, 40% mixed)
      // But if the longest-waiting player is an Expert, force Regular Doubles
      const longestWaiting = sortedPlayers[0];
      const isLongestWaitingExpert = longestWaiting && longestWaiting.level === 'Expert';
      
      const isMixed = !isLongestWaitingExpert && Math.random() < 0.40;
      if (isMixed) {
        targetGenderMode = 'mixed';
      } else {
        // Regular doubles - pick gender based on who has waited longest
        const longestWaitMale = sortedPlayers.find(p => p.gender === 'male');
        const longestWaitFemale = sortedPlayers.find(p => p.gender === 'female');
        
        if (longestWaitMale && longestWaitFemale) {
          targetGenderMode = longestWaitMale.joinedAt <= longestWaitFemale.joinedAt ? 'male' : 'female';
        } else if (longestWaitMale) {
          targetGenderMode = 'male';
        } else if (longestWaitFemale) {
          targetGenderMode = 'female';
        } else {
          targetGenderMode = 'mixed'; // Fallback
        }
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
    if (targetGenderMode === 'male' || hasAdvancedMaleInMatch) {
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
        
        alert(
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
      
      alert(
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
      let incompleteMatches = sortedMatches.filter(m => getMatchPlayerCount(m) < 4);
      
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
        const neededPlayers = 4 - currentPlayers.length;
        
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
        alert(`A court named "${trimmedName}" already exists.`);
        return;
      }
      setCourts(prev => [...prev, { id: Date.now(), name: trimmedName, match: null, startTime: null }]);
      setNewCourtName('');
    }
  };

  const deleteCourt = (courtId) => {
    const court = courts.find(c => c.id === courtId);
    const confirmMessage = court && court.match 
      ? `Are you sure you want to delete "${court.name}"? There is an active match on this court - the players will be returned to the pool.`
      : `Are you sure you want to delete "${court?.name || 'this court'}"?`;
    
    if (!window.confirm(confirmMessage)) return;
    
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
        alert(`A court named "${trimmedName}" already exists.`);
        return;
      }
      setCourts(prev => prev.map(c => c.id === courtId ? { ...c, name: trimmedName } : c));
    }
    setEditingCourtId(null);
    setEditingCourtName('');
  };

  const moveMatchToCourt = (matchId, courtId) => {
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
      const confirmed = window.confirm(
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
        
        const confirmed = window.confirm(
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
        const eligibleInfo = eligibleLowerMatches.map(m => {
          const playerNames = m.players.map(p => p.name).join(', ');
          return `• Match #${m.matchNumber}: ${playerNames}`;
        }).join('\n');
        
        const confirmed = window.confirm(
          `⚠️ Higher Priority Match Available\n\n` +
          `The following matches are higher in the queue and can also be assigned to "${targetCourt.name}":\n\n` +
          `${eligibleInfo}\n\n` +
          `Do you want to skip them and assign Match #${matchToMove.matchNumber} instead?`
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
          startTime: Date.now(),
          sortOrder: Date.now() // Used for sorting - only updates when match is assigned
        } : c
      );
    });
    
    // Trigger scroll to the court that received the match
    setScrollToCourtId(courtId);
    // Clear scroll trigger after a short delay
    setTimeout(() => setScrollToCourtId(null), 500);
    
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

  // ==================== Derived State ====================
  
  const selectedMatch = matches.find(m => m.id === selectedMatchId);

  // ==================== Render ====================
  
  // Theme classes
  const themeClasses = isDarkMode 
    ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white'
    : 'bg-gradient-to-br from-slate-100 via-white to-slate-100 text-slate-900';

  // Show loading state while checking license
  if (isCheckingLicense) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg mx-auto mb-4">
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
    <div className={`min-h-screen ${themeClasses}`}>
      {/* Background Pattern */}
      <div className={`fixed inset-0 ${isDarkMode ? 'opacity-5' : 'opacity-[0.02]'} bg-pattern`} />

      {/* Header */}
      <Header 
        onOpenDatabase={() => setIsDbModalOpen(true)} 
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenAbout={() => setIsAboutModalOpen(true)}
        onOpenReports={() => setIsReportsModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onResetData={resetAllData}
        isDarkMode={isDarkMode}
        toggleTheme={() => setIsDarkMode(!isDarkMode)}
        licenseInfo={licenseInfo}
        syncStatus={syncStatus}
        isOnline={isOnline}
        cloudSyncEnabled={cloudSyncEnabled}
      />

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
              clearIdleTimes={clearIdleTimes}
              onDropPlayerToPool={removePlayerFromMatch}
              onDropPlayerToNotPresent={movePlayerFromMatchToNotPresent}
              isDarkMode={isDarkMode}
              panelWidth={panelWidths.playerPool}
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
        performSync={performSync}
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
    </div>
  );
}

export default App;
