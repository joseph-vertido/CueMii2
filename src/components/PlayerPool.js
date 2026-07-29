import React, { useState, useEffect, useRef } from 'react';
import { showConfirm } from '../utils/appAlert';
import { SKILL_LEVELS } from '../data/initialData';
import { formatWaitTime, getWaitTimeColor, getWaitTimeColorLight } from '../utils/formatters';
import LevelBadge from './LevelBadge';
import ThemedSelect from './ThemedSelect';

/**
 * Player pool section displaying all players waiting to be matched
 */
const PlayerPool = ({ 
  poolPlayers,
  notPresentPlayers = [],
  poolSearch,
  setPoolSearch,
  poolLevelFilter,
  setPoolLevelFilter,
  isPlayerInMatch,
  isPlayerInQueue,
  isPlayerOnCourt,
  removeFromPool,
  moveToAvailable,
  moveToNotPresent,
  selectedMatch,
  addPlayerToMatch,
  selectedMatchId,
  clearIdleTimes,
  onDropPlayerToPool,
  onDropPlayerToNotPresent,
  isDarkMode = true,
  panelWidth = 450
}) => {
  const searchInputRef = useRef(null);
  const [dragOverSection, setDragOverSection] = useState(null);
  const [inQueueCollapsed, setInQueueCollapsed] = useState(true); // Collapsed by default
  const [onCourtCollapsed, setOnCourtCollapsed] = useState(true); // Collapsed by default

  // Determine grid columns based on panel width
  const gridCols = panelWidth < 350 ? 'grid-cols-1' : 'grid-cols-2';

  // Filter pool players based on search and level filter
  const filteredPoolPlayers = poolPlayers
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(poolSearch.toLowerCase());
      const matchesLevel = poolLevelFilter === 'All' || p.level === poolLevelFilter;
      return matchesSearch && matchesLevel;
    });

  // Filter not present players and sort alphabetically
  const filteredNotPresent = notPresentPlayers
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(poolSearch.toLowerCase());
      const matchesLevel = poolLevelFilter === 'All' || p.level === poolLevelFilter;
      return matchesSearch && matchesLevel;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // Split into available, in-queue, and on-court players
  const availablePlayers = filteredPoolPlayers
    .filter(p => !isPlayerInMatch(p.id))
    .sort((a, b) => a.joinedAt - b.joinedAt); // Longest wait first
  
  const playersInQueue = filteredPoolPlayers
    .filter(p => isPlayerInQueue(p.id))
    .sort((a, b) => a.joinedAt - b.joinedAt);
  
  const playersOnCourt = filteredPoolPlayers
    .filter(p => isPlayerOnCourt(p.id))
    .sort((a, b) => a.joinedAt - b.joinedAt);

  // Auto-expand/collapse based on search
  useEffect(() => {
    if (poolSearch.trim()) {
      // Expand sections that have matching players
      if (playersInQueue.length > 0) setInQueueCollapsed(false);
      if (playersOnCourt.length > 0) setOnCourtCollapsed(false);
    } else {
      // Collapse when search is cleared
      setInQueueCollapsed(true);
      setOnCourtCollapsed(true);
    }
  }, [poolSearch, playersInQueue.length, playersOnCourt.length]);

  // Clear search on mouseup outside search input, or when a drag finishes.
  // HTML5 drag-and-drop suppresses mouseup, so 'dragend' is needed for the
  // drag case (dragging a card out of a filtered list should reset the search).
  useEffect(() => {
    const handleMouseUp = (e) => {
      if (searchInputRef.current && !searchInputRef.current.contains(e.target)) {
        // Deferred: clearing the search re-renders (and re-filters) the list.
        // Doing that synchronously on mouseup would move or unmount the card
        // before the browser dispatches the following 'click', so button
        // clicks (e.g. the ✕ remove button) would be lost or hit the wrong row.
        setTimeout(() => setPoolSearch(''), 0);
      }
    };

    const handleDragEnd = () => setPoolSearch('');
    // A successful drop can unmount the dragged card before 'dragend' reaches
    // the document, so listen for the drop too (capture phase, deferred so the
    // drop is fully processed first).
    const handleDrop = () => setTimeout(() => setPoolSearch(''), 0);

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('dragend', handleDragEnd);
    document.addEventListener('drop', handleDrop, true);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('dragend', handleDragEnd);
      document.removeEventListener('drop', handleDrop, true);
    };
  }, [setPoolSearch]);

  // Handle Clear Timers with confirmation
  const handleClearTimers = async () => {
    if (await showConfirm('Are you sure you want to clear all player idle times? This will reset everyone\'s wait time to now.')) {
      clearIdleTimes();
    }
  };

  // Drag handlers for available players
  const handleDragStart = (e, player, section) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      player,
      sourceType: section // 'pool' or 'notPresent'
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, section) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSection(section);
  };

  const handleDragLeave = () => {
    setDragOverSection(null);
  };

  const handleDropToAvailable = (e) => {
    e.preventDefault();
    setDragOverSection(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.sourceType === 'match' && data.sourceMatchId && data.player) {
        onDropPlayerToPool(data.sourceMatchId, data.player.id);
      } else if (data.sourceType === 'notPresent' && data.player) {
        moveToAvailable(data.player.id);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  const handleDropToNotPresent = (e) => {
    e.preventDefault();
    setDragOverSection(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.sourceType === 'pool' && data.player) {
        moveToNotPresent(data.player.id);
      } else if (data.sourceType === 'match' && data.sourceMatchId && data.player) {
        onDropPlayerToNotPresent(data.sourceMatchId, data.player.id);
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  // Player card component for Available/In Match sections
  // Get pulsing glow class based on wait time (only for players waiting 5+ minutes)
  const getWaitGlowClass = (joinedAt) => {
    if (!joinedAt) return '';
    const diff = Math.floor((Date.now() - joinedAt) / 1000 / 60);
    if (diff < 5) return '';
    if (diff < 10) return 'animate-pulse-glow-green';
    if (diff < 15) return 'animate-pulse-glow-yellow';
    return 'animate-pulse-glow-red';
  };

  const PlayerCard = ({ player, inMatch }) => {
    const glowClass = !inMatch ? getWaitGlowClass(player.joinedAt) : '';
    
    return (
    <div
      draggable={!inMatch}
      onDragStart={(e) => !inMatch && handleDragStart(e, player, 'pool')}
      className={`pool-card group rounded-lg p-2 border transition-all ${glowClass} ${
        isDarkMode 
          ? `bg-slate-800/50 ${inMatch ? 'border-yellow-500/30 opacity-70' : 'border-slate-700/50 hover:border-cyan-500/50'}` 
          : `bg-white shadow-sm ${inMatch ? 'border-yellow-500 opacity-70' : 'border-slate-300 hover:border-cyan-600 hover:shadow-md'}`
      } ${!inMatch ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`font-normal text-sm truncate ${player.gender === 'male' ? (isDarkMode ? 'text-blue-300' : 'text-blue-700') : (isDarkMode ? 'text-pink-300' : 'text-pink-700')}`}>{player.name}</span>
        </div>
        {!inMatch && (
          <button
            onClick={() => removeFromPool(player.id)}
            className={`p-0.5 rounded transition-all flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 ${
              isDarkMode 
                ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20' 
                : 'text-red-600 hover:text-red-700 hover:bg-red-100'
            }`}
            title="Remove from pool"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-1">
        <LevelBadge level={player.level} isDarkMode={isDarkMode} />
        <div className="flex items-center gap-2 text-xs">
          <span className={`inline-flex items-center gap-0.5 leading-none tabular ${isDarkMode ? getWaitTimeColor(player.joinedAt) : getWaitTimeColorLight(player.joinedAt)}`} title="Wait time">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatWaitTime(player.joinedAt)}
          </span>
          <span className={`inline-flex items-center gap-0.5 leading-none ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`} title="Games played">
            🏸{player.playCount || 0}
          </span>
        </div>
      </div>
      {selectedMatch && !inMatch && selectedMatch.players.length < 4 && (
        <button
          onClick={() => addPlayerToMatch(selectedMatchId, player)}
          className={`mt-1.5 w-full text-xs py-1 rounded transition-colors ${
            isDarkMode 
              ? 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-500' 
              : 'bg-cyan-100 hover:bg-cyan-200 text-cyan-700 border border-cyan-400'
          }`}
        >
          + Add to Match
        </button>
      )}
    </div>
  )};

  // Not Present player card - simpler, single line
  const NotPresentCard = ({ player }) => (
    <div
      draggable={true}
      onDragStart={(e) => handleDragStart(e, player, 'notPresent')}
      className={`pool-card group rounded-lg px-2 py-1.5 border transition-all cursor-grab active:cursor-grabbing ${
        isDarkMode 
          ? 'bg-slate-800/30 border-red-500/30 hover:border-red-500/50' 
          : 'bg-red-50/30 border-red-300/50 hover:border-red-400 shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`font-normal text-sm truncate flex-1 ${
          isDarkMode ? 'text-slate-200' : 'text-slate-700'
        }`}>{player.name}</span>
        <button
          onClick={() => moveToAvailable(player.id)}
          className={`text-xs px-2 py-0.5 rounded transition-colors flex-shrink-0 ${
            isDarkMode 
              ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400' 
              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-300'
          }`}
        >
          ✓-In
        </button>
        <button
          onClick={() => removeFromPool(player.id)}
          className={`p-0.5 rounded transition-all flex-shrink-0 ${
            isDarkMode 
              ? 'text-red-400 hover:text-red-300 hover:bg-red-500/20' 
              : 'text-red-500 hover:text-red-600 hover:bg-red-100'
          }`}
          title="Remove from pool"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );

  // Group not present players by first letter
  const groupedNotPresent = filteredNotPresent.reduce((groups, player) => {
    const firstLetter = player.name.charAt(0).toUpperCase();
    if (!groups[firstLetter]) {
      groups[firstLetter] = [];
    }
    groups[firstLetter].push(player);
    return groups;
  }, {});
  
  const sortedLetters = Object.keys(groupedNotPresent).sort();

  const totalPlayers = poolPlayers.length + notPresentPlayers.length;

  return (
    <section 
      className={`backdrop-blur-sm rounded-2xl border overflow-hidden h-full flex flex-col panel-depth ${
        isDarkMode 
          ? 'bg-slate-900/50 border-slate-700/50' 
          : 'bg-white border-slate-300'
      }`}
    >
      <div className={`border-b px-4 py-3 ${
        isDarkMode 
          ? 'bg-slate-800/60 border-slate-700/50' 
          : 'bg-slate-100 border-slate-300'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100'
            }`}>
              <svg className={`w-5 h-5 ${isDarkMode ? 'text-cyan-500' : 'text-cyan-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Player Pool</h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{totalPlayers} players total</p>
            </div>
          </div>
          {/* Clear Timers Button */}
          <button
            onClick={handleClearTimers}
            disabled={poolPlayers.length === 0}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              isDarkMode 
                ? 'bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-300 hover:text-white disabled:text-slate-500' 
                : 'bg-white hover:bg-slate-100 disabled:bg-slate-50 text-slate-700 hover:text-slate-900 disabled:text-slate-400 border border-slate-300'
            } disabled:cursor-not-allowed`}
            title="Reset all idle times to now"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Clear Timers
          </button>
        </div>
        
        {/* Search and Filter */}
        <div className="mt-2 flex gap-2">
          <div className="flex-1 min-w-0 relative">
            <svg className={`w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={poolSearch}
              onChange={(e) => setPoolSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredNotPresent.length === 1) {
                  moveToAvailable(filteredNotPresent[0].id);
                  setPoolSearch('');
                }
              }}
              placeholder="Search..."
              className={`w-full border rounded-full pl-8 pr-7 py-1 text-sm focus:outline-none transition-colors ${
                isDarkMode 
                  ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500' 
                  : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-cyan-400'
              }`}
            />
            {poolSearch && (
              <button
                onClick={() => setPoolSearch('')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}
                title="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <ThemedSelect
            className="w-32 flex-none"
            value={poolLevelFilter}
            onChange={(e) => setPoolLevelFilter(e.target.value)}
            isDarkMode={isDarkMode}
          >
            <option value="All">All Levels</option>
            {SKILL_LEVELS.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </ThemedSelect>
        </div>
      </div>
      
      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
        {totalPlayers === 0 ? (
          <div className={`text-center py-8 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p>No players in pool</p>
            <p className="text-sm mt-1">Add players from the database</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Available Players Section */}
            <div
              onDragOver={(e) => handleDragOver(e, 'available')}
              onDragLeave={handleDragLeave}
              onDrop={handleDropToAvailable}
              className={`rounded-lg transition-colors ${
                dragOverSection === 'available' 
                  ? (isDarkMode ? 'bg-cyan-500/10 ring-2 ring-cyan-500/50' : 'bg-cyan-100/50 ring-2 ring-cyan-400/50')
                  : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <h3 className={`text-sm font-semibold uppercase tracking-wider ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  Available
                </h3>
                <span className={`count-pill text-[11px] px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>{availablePlayers.length}</span>
              </div>
              {availablePlayers.length === 0 ? (
                <div className={`text-center py-4 text-sm rounded-lg ${
                  isDarkMode ? 'text-slate-500 bg-slate-800/30' : 'text-slate-400 bg-slate-100'
                }`}>
                  No available players
                </div>
              ) : (
                <div className={`grid ${gridCols} gap-2`}>
                  {availablePlayers.map(player => (
                    <PlayerCard key={player.id} player={player} inMatch={false} />
                  ))}
                </div>
              )}
            </div>
            
            {/* Not Present Section */}
            <div
              onDragOver={(e) => handleDragOver(e, 'notPresent')}
              onDragLeave={handleDragLeave}
              onDrop={handleDropToNotPresent}
              className={`rounded-lg transition-colors ${
                dragOverSection === 'notPresent' 
                  ? (isDarkMode ? 'bg-slate-500/10 ring-2 ring-slate-500/50' : 'bg-slate-200/50 ring-2 ring-slate-400/50')
                  : ''
              }`}
            >
              <div className={`flex items-center gap-2 mb-2 pt-2 border-t ${
                isDarkMode ? 'border-slate-700/50' : 'border-slate-200'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isDarkMode ? 'bg-red-500' : 'bg-red-400'}`}></div>
                <h3 className={`text-sm font-semibold uppercase tracking-wider ${
                  isDarkMode ? 'text-red-400' : 'text-red-500'
                }`}>
                  Not Present
                </h3>
                <span className={`count-pill text-[11px] px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-red-500/15 text-red-300' : 'bg-red-100 text-red-600'}`}>{filteredNotPresent.length}</span>
              </div>
              {filteredNotPresent.length === 0 ? (
                <div className={`text-center py-4 text-sm rounded-lg ${
                  isDarkMode ? 'text-slate-600 bg-slate-800/20' : 'text-slate-400 bg-slate-50'
                }`}>
                  No players waiting to arrive
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {sortedLetters.map(letter => (
                    <div key={letter}>
                      <div className={`text-xs font-bold px-1 py-0.5 mb-1 ${
                        isDarkMode ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {letter}
                      </div>
                      <div className={`grid ${gridCols} gap-1`}>
                        {groupedNotPresent[letter].map(player => (
                          <NotPresentCard key={player.id} player={player} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Players In Match Queue Section - Collapsible */}
            {playersInQueue.length > 0 && (
              <div>
                <button
                  onClick={() => setInQueueCollapsed(!inQueueCollapsed)}
                  className={`w-full flex items-center justify-between gap-2 mb-2 pt-2 border-t ${
                    isDarkMode ? 'border-slate-700/50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <h3 className={`text-sm font-semibold uppercase tracking-wider ${
                      isDarkMode ? 'text-yellow-500' : 'text-yellow-600'
                    }`}>
                      In Match Queue
                    </h3>
                    <span className={`count-pill text-[11px] px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-yellow-500/15 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`}>{playersInQueue.length}</span>
                  </div>
                  <svg 
                    className={`w-4 h-4 transition-transform ${inQueueCollapsed ? '' : 'rotate-180'} ${
                      isDarkMode ? 'text-yellow-500' : 'text-yellow-600'
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {!inQueueCollapsed && (
                  <div className={`grid ${gridCols} gap-2`}>
                    {playersInQueue.map(player => (
                      <PlayerCard key={player.id} player={player} inMatch={true} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Players On Court Section - Collapsible */}
            {playersOnCourt.length > 0 && (
              <div>
                <button
                  onClick={() => setOnCourtCollapsed(!onCourtCollapsed)}
                  className={`w-full flex items-center justify-between gap-2 mb-2 pt-2 border-t ${
                    isDarkMode ? 'border-slate-700/50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <h3 className={`text-sm font-semibold uppercase tracking-wider ${
                      isDarkMode ? 'text-emerald-500' : 'text-emerald-600'
                    }`}>
                      In Court
                    </h3>
                    <span className={`count-pill text-[11px] px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>{playersOnCourt.length}</span>
                  </div>
                  <svg 
                    className={`w-4 h-4 transition-transform ${onCourtCollapsed ? '' : 'rotate-180'} ${
                      isDarkMode ? 'text-emerald-500' : 'text-emerald-600'
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {!onCourtCollapsed && (
                  <div className={`grid ${gridCols} gap-2`}>
                    {playersOnCourt.map(player => (
                      <PlayerCard key={player.id} player={player} inMatch={true} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default PlayerPool;
