import React, { useState, useEffect, useRef, useMemo } from 'react';
import LevelBadge from './LevelBadge';
import GenderIcon from './GenderIcon';
import { formatWaitTime, getWaitTimeColor, getWaitTimeColorLight } from '../utils/formatters';

/**
 * Match queue section for creating and managing matches
 */
const MatchQueue = ({
  matches,
  selectedMatchId,
  setSelectedMatchId,
  createMatch,
  deleteMatch,
  clearMatch,
  removePlayerFromMatch,
  smartMatch,
  moveMatchToCourt,
  courts,
  getAvailablePoolPlayers,
  addPlayerToMatch,
  movePlayerBetweenMatches,
  togglePreferredCourt,
  clearPreferredCourts,
  isDarkMode = true,
  lastSmartMatch,
  undoSmartMatch,
  smartQueueAll,
  lastSmartQueueAll,
  undoSmartQueueAll,
  smartMatchedPlayers = {},
  currentTime,
  averageWaitTime = 20,
  clearAllMatches,
  swapMatchPlayers,
  returnedMatches = {},
  highlightedPriorityMatches = {},
  poolPlayers = [],
  matchReservations = {},
  reservePlayerInMatch,
  clearReservation
}) => {
  const [dragOverMatchId, setDragOverMatchId] = useState(null);
  const [openCourtDropdown, setOpenCourtDropdown] = useState(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [reservationDropdown, setReservationDropdown] = useState(null); // { matchId, slotIndex }
  const [reservationSearch, setReservationSearch] = useState('');
  const dropdownRef = useRef(null);
  const reservationDropdownRef = useRef(null);
  const matchRefs = useRef({});
  const scrollContainerRef = useRef(null);
  const matchListRef = useRef(null);
  const [lastScrolledMatchId, setLastScrolledMatchId] = useState(null);

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const container = matchListRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      setShowScrollToTop(container.scrollTop > 100);
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to top function
  const scrollToTop = () => {
    if (matchListRef.current) {
      matchListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Scroll to top when priority matches are highlighted
  useEffect(() => {
    const highlightedEntries = Object.entries(highlightedPriorityMatches);
    if (highlightedEntries.length === 0) return;
    
    // Sort by timestamp descending to get most recent
    const mostRecent = highlightedEntries.sort((a, b) => b[1] - a[1])[0];
    const [, timestamp] = mostRecent;
    
    // Only scroll if this is a new highlight (within last 500ms)
    const isRecent = Date.now() - timestamp < 500;
    if (isRecent) {
      scrollToTop();
    }
  }, [highlightedPriorityMatches]);

  // Scroll to recently returned match
  useEffect(() => {
    // Find the most recently returned match
    const returnedEntries = Object.entries(returnedMatches);
    if (returnedEntries.length === 0) return;
    
    // Sort by timestamp descending to get most recent
    const mostRecent = returnedEntries.sort((a, b) => b[1] - a[1])[0];
    const [matchId, timestamp] = mostRecent;
    
    // Only scroll if this is a new return (within last 500ms) and we haven't scrolled to it yet
    const isRecent = Date.now() - timestamp < 500;
    if (isRecent && matchId !== lastScrolledMatchId && matchRefs.current[matchId]) {
      matchRefs.current[matchId].scrollIntoView({ behavior: 'smooth', block: 'center' });
      setLastScrolledMatchId(matchId);
    }
  }, [returnedMatches, lastScrolledMatchId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenCourtDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close reservation dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (reservationDropdownRef.current && !reservationDropdownRef.current.contains(event.target)) {
        setReservationDropdown(null);
        setReservationSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute which players need alternate name format (LastName F.) due to duplicates
  const playersNeedingAltFormat = useMemo(() => {
    // Get all players from pool and matches
    const allPlayers = [...poolPlayers];
    matches.forEach(m => {
      m.players.forEach(p => {
        if (!allPlayers.find(ap => ap.id === p.id)) {
          allPlayers.push(p);
        }
      });
    });
    
    // Build map of "FirstName L." -> [player ids]
    const formatToIds = {};
    allPlayers.forEach(player => {
      const parts = player.name.split(' ');
      if (parts.length > 1) {
        const format = `${parts[0]} ${parts[parts.length - 1][0]}.`.toUpperCase();
        if (!formatToIds[format]) {
          formatToIds[format] = [];
        }
        formatToIds[format].push(player.id);
      }
    });
    
    // Return set of player IDs that have duplicates
    const needsAlt = new Set();
    Object.values(formatToIds).forEach(ids => {
      if (ids.length > 1) {
        ids.forEach(id => needsAlt.add(id));
      }
    });
    
    return needsAlt;
  }, [poolPlayers, matches]);

  // Format name - uses "LastName F." if there are duplicates with same "FirstName L."
  const formatName = (player) => {
    const parts = player.name.split(' ');
    let formatted;
    
    if (parts.length > 1) {
      if (playersNeedingAltFormat.has(player.id)) {
        // Use "LastName F." format for duplicates
        formatted = `${parts[parts.length - 1]} ${parts[0][0]}.`;
      } else {
        // Use normal "FirstName L." format
        formatted = `${parts[0]} ${parts[parts.length - 1][0]}.`;
      }
    } else {
      formatted = parts[0];
    }
    return formatted.toUpperCase();
  };

  // Check if player was smart matched within the last 30 seconds
  const isRecentlySmartMatched = (playerId) => {
    const matchedAt = smartMatchedPlayers[playerId];
    if (!matchedAt) return false;
    const thirtySeconds = 30 * 1000;
    return (currentTime - matchedAt) < thirtySeconds;
  };

  // Drag handlers for player cards in matches
  const handleDragStart = (e, player, matchId) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      player,
      sourceType: 'match',
      sourceMatchId: matchId
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, matchId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverMatchId(matchId);
  };

  const handleDragLeave = () => {
    setDragOverMatchId(null);
  };

  const handleDrop = (e, targetMatchId) => {
    e.preventDefault();
    setDragOverMatchId(null);
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const targetMatch = matches.find(m => m.id === targetMatchId);
      
      if (!targetMatch || targetMatch.players.length >= 4) return;
      
      // Check if player is already in target match
      if (targetMatch.players.some(p => p.id === data.player.id)) return;
      
      if (data.sourceType === 'pool') {
        // From pool to match
        addPlayerToMatch(targetMatchId, data.player);
      } else if (data.sourceType === 'match' && data.sourceMatchId !== targetMatchId) {
        // From one match to another
        movePlayerBetweenMatches(data.sourceMatchId, targetMatchId, data.player);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  return (
    <section className={`backdrop-blur-sm rounded-2xl border overflow-hidden h-full flex flex-col shadow-sm ${
      isDarkMode ? 'bg-slate-900/50 border-slate-700/50' : 'bg-white border-slate-300'
    }`}>
      <div className={`bg-gradient-to-r border-b px-4 py-3 ${
        isDarkMode 
          ? 'from-orange-600/20 to-red-600/20 border-slate-700/50' 
          : 'from-orange-100 to-red-100 border-slate-300'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isDarkMode ? 'bg-orange-500/20' : 'bg-orange-500/30'
            }`}>
              <svg className={`w-5 h-5 ${isDarkMode ? 'text-orange-500' : 'text-orange-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Match Queue</h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                {matches.length} pending · <span className={
                  averageWaitTime >= 60 
                    ? 'text-red-500 font-semibold' 
                    : averageWaitTime > 40 
                      ? 'text-red-500' 
                      : averageWaitTime > 30 
                        ? 'text-amber-500' 
                        : averageWaitTime >= 20 
                          ? 'text-emerald-500' 
                          : isDarkMode ? 'text-cyan-400' : 'text-cyan-600'
                }>Avg wait: {averageWaitTime >= 60 ? '1h+' : `${averageWaitTime}m`}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Smart Queue All Button */}
            <button
              onClick={smartQueueAll}
              disabled={getAvailablePoolPlayers().length === 0}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 text-white"
              title="Smart Match all incomplete matches"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Smart All
            </button>
            {/* Undo Smart Queue All Button */}
            {lastSmartQueueAll && (
              <button
                onClick={undoSmartQueueAll}
                className={`px-1.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-0.5 border ${
                  isDarkMode 
                    ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-400' 
                    : 'bg-amber-100 hover:bg-amber-200 border-amber-400 text-amber-700'
                }`}
                title={`Undo Smart Queue All (${lastSmartQueueAll.addedPlayers.length} players)`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                Undo All
              </button>
            )}
            {/* Clear All Matches Button */}
            {matches.length > 0 && matches.some(m => m.players.length > 0) && (
              <button
                onClick={() => {
                  const totalPlayers = matches.reduce((sum, m) => sum + m.players.length, 0);
                  if (window.confirm(`Clear all players from ${matches.length} matches?\n\nThis will remove ${totalPlayers} player(s) from all matches and return them to the pool.`)) {
                    clearAllMatches();
                  }
                }}
                className={`px-2 py-1 rounded text-xs font-medium transition-all flex items-center gap-1 border ${
                  isDarkMode 
                    ? 'bg-slate-700 hover:bg-red-500/20 border-slate-600 text-slate-300 hover:text-red-400 hover:border-red-500/50' 
                    : 'bg-slate-100 hover:bg-red-100 border-slate-300 text-slate-600 hover:text-red-600 hover:border-red-400'
                }`}
                title="Clear all players from all matches"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All
              </button>
            )}
            <button
              onClick={createMatch}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-400 hover:to-red-400 px-3 py-1.5 rounded-lg font-semibold transition-all shadow-lg shadow-orange-500/25 flex items-center gap-1 text-sm text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create
            </button>
          </div>
        </div>
      </div>
      
      <div ref={matchListRef} className="p-2 flex-1 overflow-y-auto custom-scrollbar relative">
        {/* Floating Scroll to Top Button */}
        {showScrollToTop && (
          <button
            onClick={scrollToTop}
            className={`sticky top-2 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full shadow-xl transition-all flex items-center gap-2 animate-bounce-subtle ${
              isDarkMode 
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-orange-500/30' 
                : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-orange-500/40'
            }`}
            title="Scroll to top"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
            </svg>
            <span className="text-sm font-semibold">Top</span>
          </button>
        )}
        
        {matches.length === 0 ? (
          <div className={`text-center py-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            <svg className="w-10 h-10 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            <p className="text-sm">No matches in queue</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(() => {
              const sortedMatches = [...matches].sort((a, b) => (a.matchNumber || 0) - (b.matchNumber || 0));
              return sortedMatches.map((match, matchIndex) => {
              const isComplete = match.players.length === 4;
              const isIncomplete = match.players.length > 0 && match.players.length < 4;
              const isDragOver = dragOverMatchId === match.id && !isComplete;
              const hasPreferredCourts = match.preferredCourts && match.preferredCourts.length > 0;
              const isFirstMatch = matchIndex === 0;
              const isLastMatch = matchIndex === sortedMatches.length - 1;
              
              // Calculate average wait time for players in this match
              // Look up each player's joinedAt from poolPlayers
              const playerWaitTimes = match.players.map(p => {
                const poolPlayer = poolPlayers.find(pp => pp.id === p.id);
                return poolPlayer?.joinedAt || p.joinedAt;
              }).filter(Boolean);
              
              const avgWaitTimeMs = playerWaitTimes.length > 0
                ? playerWaitTimes.reduce((sum, joinedAt) => sum + (Date.now() - joinedAt), 0) / playerWaitTimes.length
                : 0;
              const avgWaitTimeMinutes = Math.round(avgWaitTimeMs / 60000);
              
              // Check if match was recently returned from court (within 30 seconds)
              const returnedTime = returnedMatches[match.id];
              const isRecentlyReturned = returnedTime && (Date.now() - returnedTime) < 30000;
              
              // Check if match is highlighted as priority (within 10 seconds)
              const priorityTime = highlightedPriorityMatches[match.id];
              const isHighlightedPriority = priorityTime && (Date.now() - priorityTime) < 10000;
              
              // Determine background and border colors based on theme
              let bgClass, borderClass;
              if (isDragOver) {
                bgClass = isDarkMode ? 'bg-cyan-900/40' : 'bg-cyan-50';
                borderClass = isDarkMode ? 'border-cyan-400 shadow-lg shadow-cyan-500/20' : 'border-cyan-500 shadow-md shadow-cyan-500/20';
              } else if (isHighlightedPriority) {
                bgClass = isDarkMode ? 'bg-emerald-900/30' : 'bg-emerald-50/70';
                borderClass = 'border-emerald-500 animate-pulse-priority';
              } else if (isRecentlyReturned) {
                bgClass = isDarkMode ? 'bg-red-900/30' : 'bg-red-50/70';
                borderClass = 'border-red-500 animate-pulse-returned';
              } else if (hasPreferredCourts) {
                bgClass = isDarkMode ? 'bg-amber-900/30' : 'bg-amber-50/70';
                borderClass = isDarkMode ? 'border-amber-500/50' : 'border-amber-400';
              } else {
                // No special highlight for complete matches - same as incomplete
                bgClass = isDarkMode ? 'bg-slate-800/50' : 'bg-slate-50';
                borderClass = isDarkMode ? 'border-slate-700/50' : 'border-slate-300';
              }
              
              // Determine selected border
              let selectedClass = '';
              if (selectedMatchId === match.id) {
                if (hasPreferredCourts) {
                  selectedClass = isDarkMode ? 'border-amber-400 shadow-lg shadow-amber-500/20' : 'border-amber-500 shadow-md shadow-amber-500/20';
                } else {
                  selectedClass = isDarkMode ? 'border-orange-500 shadow-lg shadow-orange-500/10' : 'border-orange-500 shadow-md shadow-orange-500/20';
                }
              }
              
              return (
              <div
                key={match.id}
                ref={el => matchRefs.current[match.id] = el}
                onDragOver={(e) => handleDragOver(e, match.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, match.id)}
                className={`rounded-lg border transition-all ${bgClass} ${selectedClass || borderClass} ${
                  selectedMatchId !== match.id ? 'hover:border-slate-600' : ''
                }`}
              >
                {/* Preferred Courts Label */}
                {match.preferredCourts && match.preferredCourts.length > 0 && (
                  <div className={`border-b px-2 py-1 flex items-center gap-2 rounded-t-lg ${
                    isDarkMode 
                      ? 'bg-amber-500/20 border-amber-500/30' 
                      : 'bg-amber-100 border-amber-400'
                  }`}>
                    <svg className={`w-4 h-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
                      Waiting for: {match.preferredCourts.map(courtId => 
                        courts.find(c => c.id === courtId)?.name || 'Unknown'
                      ).join(', ')}
                    </span>
                    <button
                      onClick={() => clearPreferredCourts(match.id)}
                      className={`ml-auto text-xs ${isDarkMode ? 'text-amber-400 hover:text-amber-300' : 'text-amber-600 hover:text-amber-800'}`}
                      title="Clear all preferences"
                    >
                      ✕
                    </button>
                  </div>
                )}
                <div className="p-2">
                  {/* Header Row */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                        isDarkMode 
                          ? 'text-orange-300 bg-orange-500/20 border-orange-500/50' 
                          : 'text-orange-700 bg-orange-100 border-orange-400'
                      }`}>
                        #{match.matchNumber || '?'}
                      </span>
                      <button
                        onClick={() => setSelectedMatchId(selectedMatchId === match.id ? null : match.id)}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                          selectedMatchId === match.id
                            ? isComplete 
                              ? 'bg-emerald-500 text-white'
                              : 'bg-orange-500 text-white'
                            : isDarkMode 
                              ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' 
                              : 'bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300'
                        }`}
                      >
                        {selectedMatchId === match.id ? 'Selected' : 'Select'}
                      </button>
                      {/* Preferred Courts Multi-Select Dropdown */}
                      <div className="relative" ref={openCourtDropdown === match.id ? dropdownRef : null}>
                        <button
                          onClick={() => setOpenCourtDropdown(openCourtDropdown === match.id ? null : match.id)}
                          className={`border rounded px-1.5 py-0.5 text-xs focus:outline-none cursor-pointer flex items-center gap-0.5 ${
                            isDarkMode 
                              ? 'bg-slate-700 border-slate-600 text-slate-300 hover:border-teal-500' 
                              : 'bg-white border-slate-400 text-slate-700 hover:border-teal-500'
                          }`}
                          title="Select preferred courts"
                        >
                          <span>Courts ({match.preferredCourts?.length || 0})</span>
                          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {openCourtDropdown === match.id && (
                          <div className={`absolute top-full left-0 mt-1 border rounded-lg shadow-xl z-50 min-w-[150px] ${
                            isDarkMode 
                              ? 'bg-slate-800 border-slate-600' 
                              : 'bg-white border-slate-300'
                          }`}>
                            {courts.map(court => {
                              const isSelected = match.preferredCourts?.includes(court.id);
                              return (
                                <label
                                  key={court.id}
                                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm ${
                                    isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => togglePreferredCourt(match.id, court.id)}
                                    className="rounded border-slate-500 bg-slate-700 text-green-500 focus:ring-green-500"
                                  />
                                  <span className={
                                    isSelected 
                                      ? (isDarkMode ? 'text-green-400' : 'text-green-700 font-medium') 
                                      : (isDarkMode ? 'text-slate-300' : 'text-slate-700')
                                  }>
                                    {court.name}
                                  </span>
                                </label>
                              );
                            })}
                            {courts.length === 0 && (
                              <div className={`px-3 py-2 text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>No courts available</div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Average Wait Time */}
                      {match.players.length > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          avgWaitTimeMinutes >= 40
                            ? (isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')
                            : avgWaitTimeMinutes >= 30
                              ? (isDarkMode ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600')
                              : avgWaitTimeMinutes >= 20
                                ? (isDarkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-600')
                                : (isDarkMode ? 'bg-slate-600/50 text-slate-400' : 'bg-slate-200 text-slate-600')
                        }`} title="Average wait time for players in this match">
                          ⏱ {avgWaitTimeMinutes >= 60 ? '1h+' : `${avgWaitTimeMinutes}m`}
                        </span>
                      )}
                      <span className={`text-xs font-medium ${
                        isComplete 
                          ? (isDarkMode ? 'text-emerald-400' : 'text-emerald-600') 
                          : isIncomplete
                            ? 'text-red-500 font-bold'
                            : (isDarkMode ? 'text-slate-400' : 'text-slate-600')
                      }`}>
                        {match.players.length}/4 {isComplete ? '✓' : isIncomplete ? '✗' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Up/Down arrows for reordering */}
                      <div className="flex flex-col">
                        <button
                          onClick={() => swapMatchPlayers(match.id, 'up')}
                          disabled={isFirstMatch}
                          className={`p-0.5 rounded transition-colors ${
                            isFirstMatch 
                              ? 'opacity-30 cursor-not-allowed' 
                              : isDarkMode 
                                ? 'hover:bg-slate-600 text-slate-400 hover:text-slate-200' 
                                : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'
                          }`}
                          title="Move players up"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => swapMatchPlayers(match.id, 'down')}
                          disabled={isLastMatch}
                          className={`p-0.5 rounded transition-colors ${
                            isLastMatch 
                              ? 'opacity-30 cursor-not-allowed' 
                              : isDarkMode 
                                ? 'hover:bg-slate-600 text-slate-400 hover:text-slate-200' 
                                : 'hover:bg-slate-200 text-slate-500 hover:text-slate-700'
                          }`}
                          title="Move players down"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                      <button
                        onClick={() => smartMatch(match.id)}
                        disabled={match.players.length >= 4 || getAvailablePoolPlayers().length === 0}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed px-2 py-0.5 rounded text-xs font-medium transition-all flex items-center gap-1 text-white"
                        title="Smart Match"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Smart
                      </button>
                      {/* Undo button - shows when this match was last Smart Matched */}
                      {lastSmartMatch?.matchId === match.id && (
                        <button
                          onClick={undoSmartMatch}
                          className={`px-1.5 py-0.5 rounded text-xs font-medium transition-all flex items-center gap-0.5 border ${
                            isDarkMode 
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/50 text-amber-400' 
                              : 'bg-amber-100 hover:bg-amber-200 border-amber-400 text-amber-700'
                          }`}
                          title={`Undo Smart Match (${lastSmartMatch.addedPlayers.length} players)`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Undo
                        </button>
                      )}
                      {(match.players.length > 0 || (matchReservations[match.id] && Object.keys(matchReservations[match.id]).length > 0)) && (
                        <button
                          onClick={() => clearMatch(match.id)}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            isDarkMode 
                              ? 'bg-slate-600 hover:bg-slate-500 text-slate-200' 
                              : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                          }`}
                          title="Clear all players and reservations from match"
                        >
                          Clear
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const matchToDelete = matches.find(m => m.id === match.id);
                          const playerCount = matchToDelete?.players?.length || 0;
                          const playerNames = matchToDelete?.players?.map(p => p.name).join(', ') || 'No players';
                          if (window.confirm(`Delete Match #${match.matchNumber}?\n\nPlayers: ${playerCount > 0 ? playerNames : 'None'}\n\nThis will move the match to history.`)) {
                            deleteMatch(match.id);
                          }
                        }}
                        className="text-red-400 hover:text-red-300 p-0.5 rounded hover:bg-red-500/10 transition-colors"
                        title="Delete match"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  {/* Players - All 4 in a single horizontal line, each player single line */}
                  <div className="flex gap-1 mb-2">
                    {[0, 1, 2, 3].map(index => {
                      const player = match.players[index];
                      const isRecentSmart = player && isRecentlySmartMatched(player.id);
                      return (
                        <div
                          key={index}
                          draggable={!!player}
                          onDragStart={(e) => player && handleDragStart(e, player, match.id)}
                          className={`flex-1 rounded px-2 py-1.5 border ${
                            player 
                              ? isRecentSmart
                                ? player.gender === 'male'
                                  ? isDarkMode 
                                    ? 'bg-blue-900/60 border-amber-400 ring-2 ring-amber-400/70 animate-smart-match cursor-grab active:cursor-grabbing'
                                    : 'bg-blue-100 border-amber-500 ring-2 ring-amber-500/70 animate-smart-match cursor-grab active:cursor-grabbing'
                                  : isDarkMode 
                                    ? 'bg-pink-900/60 border-amber-400 ring-2 ring-amber-400/70 animate-smart-match cursor-grab active:cursor-grabbing'
                                    : 'bg-pink-100 border-amber-500 ring-2 ring-amber-500/70 animate-smart-match cursor-grab active:cursor-grabbing'
                                : player.gender === 'male'
                                  ? isDarkMode 
                                    ? 'bg-blue-900/60 border-blue-500/50 cursor-grab active:cursor-grabbing'
                                    : 'bg-blue-100 border-blue-400 cursor-grab active:cursor-grabbing'
                                  : isDarkMode 
                                    ? 'bg-pink-900/60 border-pink-500/50 cursor-grab active:cursor-grabbing'
                                    : 'bg-pink-100 border-pink-400 cursor-grab active:cursor-grabbing'
                              : isDarkMode 
                                ? 'bg-slate-800/30 border-dashed border-slate-700'
                                : 'bg-slate-100 border-dashed border-slate-300'
                          }`}
                        >
                          {player ? (
                            <div className="relative group flex items-center justify-between gap-1">
                              <span className={`truncate font-semibold text-base ${
                                player.gender === 'male' 
                                  ? (isDarkMode ? 'text-blue-200' : 'text-blue-800') 
                                  : (isDarkMode ? 'text-pink-200' : 'text-pink-800')
                              }`} title={player.name}>
                                {formatName(player)}
                              </span>
                              <div className="flex items-center gap-1 text-sm flex-shrink-0">
                                <span className={`${
                                  isDarkMode ? getWaitTimeColor(player.joinedAt) : getWaitTimeColorLight(player.joinedAt)
                                }`} title="Wait time">⏱{formatWaitTime(player.joinedAt)}</span>
                                <span className={isDarkMode ? 'text-emerald-400' : 'text-emerald-600'} title="Games played">🏸{player.playCount || 0}</span>
                                <span className={`px-1.5 py-0.5 rounded font-bold text-xs ${
                                  player.level === 'Expert' 
                                    ? (isDarkMode ? 'bg-purple-500/50 text-purple-200 border border-purple-400/50' : 'bg-purple-100 text-purple-700 border border-purple-400')
                                    : player.level === 'Advanced' 
                                      ? (isDarkMode ? 'bg-orange-500/50 text-orange-200 border border-orange-400/50' : 'bg-orange-100 text-orange-700 border border-orange-400')
                                      : player.level === 'Intermediate' 
                                        ? (isDarkMode ? 'bg-cyan-500/50 text-cyan-200 border border-cyan-400/50' : 'bg-cyan-100 text-cyan-700 border border-cyan-400')
                                        : (isDarkMode ? 'bg-green-500/50 text-green-200 border border-green-400/50' : 'bg-green-100 text-green-700 border border-green-400')
                                }`}>
                                  {player.level[0]}
                                </span>
                                <button
                                  onClick={() => removePlayerFromMatch(match.id, player.id)}
                                  className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                                    isDarkMode 
                                      ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20' 
                                      : 'text-red-500 hover:text-red-600 hover:bg-red-100'
                                  }`}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ) : (
                            (() => {
                              const reservation = matchReservations[match.id]?.[index];
                              const isDropdownOpen = reservationDropdown?.matchId === match.id && reservationDropdown?.slotIndex === index;
                              
                              // Get all player IDs that are already reserved in any match
                              const allReservedPlayerIds = new Set();
                              Object.values(matchReservations).forEach(matchRes => {
                                Object.values(matchRes).forEach(player => {
                                  if (player?.id) allReservedPlayerIds.add(player.id);
                                });
                              });
                              
                              // Get available players for reservation (in pool, not in this match, not reserved elsewhere)
                              const availableForReservation = poolPlayers
                                .filter(p => !match.players.some(mp => mp.id === p.id))
                                .filter(p => !allReservedPlayerIds.has(p.id))
                                .filter(p => p.name.toLowerCase().includes(reservationSearch.toLowerCase()))
                                .sort((a, b) => a.name.localeCompare(b.name));
                              
                              return reservation ? (
                                // Show reserved player
                                <div className="group flex items-center justify-between gap-1">
                                  <div className={`flex-1 truncate text-xs ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
                                    <span className="opacity-70">Waiting for:</span>{' '}
                                    <span className="font-medium">{(() => {
                                      const parts = reservation.name.split(' ');
                                      if (parts.length > 1) {
                                        return `${parts[0]} ${parts[parts.length - 1][0]}.`;
                                      }
                                      return parts[0];
                                    })()}</span>
                                  </div>
                                  <button
                                    onClick={() => clearReservation(match.id, index)}
                                    className={`p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                                      isDarkMode 
                                        ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20' 
                                        : 'text-red-500 hover:text-red-600 hover:bg-red-100'
                                    }`}
                                    title="Clear reservation"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                // Empty slot - clickable to reserve
                                <div className="relative">
                                  <button
                                    onClick={() => {
                                      setReservationDropdown({ matchId: match.id, slotIndex: index });
                                      setReservationSearch('');
                                    }}
                                    className={`w-full text-base text-center cursor-pointer hover:opacity-100 transition-opacity ${
                                      isDarkMode ? 'text-slate-600 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                    title="Click to reserve a player"
                                  >
                                    —
                                  </button>
                                  
                                  {/* Reservation dropdown */}
                                  {isDropdownOpen && (
                                    <div 
                                      ref={reservationDropdownRef}
                                      className={`absolute z-50 top-full left-0 mt-1 w-48 rounded-lg shadow-xl border ${
                                        isDarkMode 
                                          ? 'bg-slate-800 border-slate-600' 
                                          : 'bg-white border-slate-200'
                                      }`}
                                    >
                                      <div className="p-2">
                                        <input
                                          type="text"
                                          value={reservationSearch}
                                          onChange={(e) => setReservationSearch(e.target.value)}
                                          placeholder="Search player..."
                                          autoFocus
                                          className={`w-full px-2 py-1 text-sm rounded border ${
                                            isDarkMode 
                                              ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-400' 
                                              : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                                          }`}
                                        />
                                      </div>
                                      <div className="max-h-40 overflow-y-auto">
                                        {availableForReservation.length === 0 ? (
                                          <div className={`px-3 py-2 text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                            No players found
                                          </div>
                                        ) : (
                                          availableForReservation.slice(0, 10).map(player => (
                                            <button
                                              key={player.id}
                                              onClick={() => {
                                                reservePlayerInMatch(match.id, index, player);
                                                setReservationDropdown(null);
                                                setReservationSearch('');
                                              }}
                                              className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 ${
                                                isDarkMode 
                                                  ? 'hover:bg-slate-700 text-slate-200' 
                                                  : 'hover:bg-slate-100 text-slate-700'
                                              }`}
                                            >
                                              <span className={player.gender === 'male' ? 'text-blue-400' : 'text-pink-400'}>●</span>
                                              <span className="truncate">{player.name}</span>
                                            </button>
                                          ))
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Move to Court - Compact */}
                  {match.players.length > 0 && (() => {
                    // Get available (empty) courts
                    const availableCourts = courts.filter(c => !c.match);
                    
                    let filteredCourts;
                    if (hasPreferredCourts) {
                      // If match has preferences, only show preferred courts that are available
                      filteredCourts = availableCourts.filter(c => 
                        match.preferredCourts.includes(c.id)
                      );
                    } else {
                      // If no preferences, exclude courts that lower-numbered matches are waiting for
                      const courtsWaitedByLowerMatches = new Set();
                      matches.forEach(m => {
                        if (m.matchNumber < match.matchNumber && m.preferredCourts && m.preferredCourts.length > 0) {
                          m.preferredCourts.forEach(courtId => courtsWaitedByLowerMatches.add(courtId));
                        }
                      });
                      filteredCourts = availableCourts.filter(c => 
                        !courtsWaitedByLowerMatches.has(c.id)
                      );
                    }
                    
                    // Check which courts are wanted by higher matchID matches
                    const courtsWaitedByHigherMatches = new Set();
                    matches.forEach(m => {
                      if (m.matchNumber > match.matchNumber && m.preferredCourts && m.preferredCourts.length > 0) {
                        m.preferredCourts.forEach(courtId => courtsWaitedByHigherMatches.add(courtId));
                      }
                    });
                    
                    return (
                      <div className="flex gap-1">
                        {!isComplete ? (
                          <div className={`flex-1 text-center text-xs py-1 ${isDarkMode ? 'text-red-400' : 'text-red-500'}`}>
                            Need 4 players to assign court
                          </div>
                        ) : filteredCourts.map(court => {
                          const isWantedByHigher = courtsWaitedByHigherMatches.has(court.id);
                          let buttonClass;
                          if (hasPreferredCourts) {
                            buttonClass = isDarkMode 
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400' 
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-400';
                          } else if (isWantedByHigher) {
                            buttonClass = isDarkMode 
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-400' 
                              : 'bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-400';
                          } else {
                            buttonClass = isDarkMode 
                              ? 'bg-green-600/30 hover:bg-green-600/40 text-green-400' 
                              : 'bg-green-100 hover:bg-green-200 text-green-700 border border-green-500';
                          }
                          return (
                            <button
                              key={court.id}
                              onClick={() => moveMatchToCourt(match.id, court.id)}
                              className={`flex-1 ${buttonClass} text-xs py-1 rounded transition-colors flex items-center justify-center gap-0.5`}
                              title={isWantedByHigher && !hasPreferredCourts ? 'Other matches are waiting for this court' : ''}
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              {court.name}
                            </button>
                          );
                        })}
                        {isComplete && filteredCourts.length === 0 && (
                          <div className="flex-1 text-center text-slate-500 text-xs py-1">
                            {hasPreferredCourts ? 'Preferred courts busy' : 'No courts available'}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
              );
            });
            })()}
          </div>
        )}
      </div>
    </section>
  );
};

export default MatchQueue;
