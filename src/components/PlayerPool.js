import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { showConfirm } from '../utils/appAlert';
import { SKILL_LEVELS } from '../data/initialData';
import { formatWaitTime, getWaitTimeColor, getWaitTimeColorLight } from '../utils/formatters';
import LevelBadge from './LevelBadge';
import AddPlayerMenu from './AddPlayerMenu';
import useFlipList from '../hooks/useFlipList';
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
  onDropPlayerToPool,
  onDropPlayerToNotPresent,
  isDarkMode = true,
  panelWidth = 450,
  allPlayers = [],
  onAddToPool,
  onAddToAvailable,
  onCreatePlayer,
  highlightPlayerId
}) => {
  const searchInputRef = useRef(null);
  const [dragOverSection, setDragOverSection] = useState(null);
  const [inQueueCollapsed, setInQueueCollapsed] = useState(true); // Collapsed by default
  const [onCourtCollapsed, setOnCourtCollapsed] = useState(true); // Collapsed by default

  // Determine grid columns based on panel width
  // Two columns only while a card is still wide enough for its stats row.
  // Below that the level badge, wait time and games counter start wrapping
  // (the count dropping under its own icon), so drop to a single column.
  const gridCols = panelWidth < 375 ? 'grid-cols-1' : 'grid-cols-2';

  // Filter pool players based on search and level filter
  const filteredPoolPlayers = poolPlayers
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(poolSearch.trim().toLowerCase());
      const matchesLevel = poolLevelFilter === 'All' || p.level === poolLevelFilter;
      return matchesSearch && matchesLevel;
    });

  // Filter not present players and sort alphabetically
  const filteredNotPresent = notPresentPlayers
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(poolSearch.trim().toLowerCase());
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
  
  // The "+" pickers list every player in the database - nobody is removed once
  // added - and report where each one currently sits so it's obvious at a glance.
  const pickerPlayers = allPlayers;
  const playerSectionStatus = (player) => {
    if (notPresentPlayers.some(p => p.id === player.id)) return 'notPresent';
    const inPool = poolPlayers.some(p => p.id === player.id);
    if (!inPool) return null;
    const busy = isPlayerInQueue?.(player.id) || isPlayerOnCourt?.(player.id);
    return busy ? 'inMatch' : 'available';
  };

  // Players in the database who aren't in the pool at all. Only surfaced while
  // searching, so the section stays out of the way during normal use.
  const notInPoolMatches = (() => {
    const q = poolSearch.trim().toLowerCase();
    if (!q) return [];
    const inPoolIds = new Set(poolPlayers.map(p => p.id));
    const notPresentIds = new Set(notPresentPlayers.map(p => p.id));
    return allPlayers
      .filter(p => !inPoolIds.has(p.id) && !notPresentIds.has(p.id))
      .filter(p => p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

  // Players that have just appeared in the pool or Not Present get a settle-in
  // animation.
  //
  // Worked out during the render, not in an effect: an effect runs after the
  // first paint, so the card would show at full size for a frame before jumping
  // back to the start of its animation.
  const seenPlayerIds = useRef(null);
  const freshIds = useRef(new Set());
  const presentIds = [...poolPlayers, ...notPresentPlayers].map(p => p.id);
  if (seenPlayerIds.current === null) {
    seenPlayerIds.current = new Set(presentIds);
  } else {
    const added = presentIds.filter(id => !seenPlayerIds.current.has(id));
    if (added.length > 0) {
      added.forEach(id => freshIds.current.add(id));
      seenPlayerIds.current = new Set(presentIds);
    } else if (presentIds.length !== seenPlayerIds.current.size) {
      seenPlayerIds.current = new Set(presentIds);
    }
  }

  useEffect(() => {
    if (freshIds.current.size === 0) return undefined;
    const t = setTimeout(() => freshIds.current.clear(), 500);
    return () => clearTimeout(t);
  }, [poolPlayers, notPresentPlayers]);

  // Remaining cards glide when the list reorders (tier 3)
  const inQueueSectionRef = useRef(null);
  const onCourtSectionRef = useRef(null);

  // Expanding a section scrolls it into view, so its contents aren't left
  // below the fold. Waits a frame for the section to actually open first.
  const revealSection = (ref) => {
    requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  // Grow a section smoothly when its contents change size, instead of the list
  // snapping to its new height as cards are added or removed.
  const useHeightTransition = (ref) => {
    const previousHeight = useRef(null);
    useLayoutEffect(() => {
      const el = ref.current;
      if (!el) return;
      const height = el.offsetHeight;
      const before = previousHeight.current;
      previousHeight.current = height;
      if (before === null || before === height) return;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      el.animate(
        [{ height: `${before}px` }, { height: `${height}px` }],
        { duration: 300, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' }
      );
    });
  };

  const availableGridRef = useRef(null);
  const notPresentGridRef = useRef(null);
  useHeightTransition(availableGridRef);
  useHeightTransition(notPresentGridRef);
  useFlipList(availableGridRef);

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

  // Drag handlers for available players
  const handleDragStart = (e, player, section) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      player,
      sourceType: section // 'pool' | 'notPresent' | 'notInPool' | 'match'
    }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, section) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Only update when it actually changes, so dragging across a section's
    // cards doesn't set state on every dragover event.
    setDragOverSection(prev => (prev === section ? prev : section));
  };

  // dragleave also fires when the cursor moves from a section onto one of the
  // cards inside it, which cleared the highlight a moment before dragover set it
  // again — that back-and-forth is the flicker. Ignore the event unless the
  // cursor has genuinely left the section.
  const handleDragLeave = (e) => {
    const leavingTo = e.relatedTarget;
    if (leavingTo && e.currentTarget.contains(leavingTo)) return;
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
      } else if (data.sourceType === 'notInPool' && data.player) {
        onAddToAvailable?.(data.player);
        setPoolSearch('');
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
      } else if (data.sourceType === 'notInPool' && data.player) {
        onAddToPool?.(data.player);
        setPoolSearch('');
      }
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  // Player card component for Available/In Match sections
  // Wait-time band for a player: drives a static border colour on their card
  // (green from 5 min, yellow from 10, red from 15). Neon mode turns the same
  // band into a fading gradient border.
  const getWaitState = (joinedAt) => {
    if (!joinedAt) return null;
    const diff = Math.floor((Date.now() - joinedAt) / 1000 / 60);
    if (diff < 5) return null;
    if (diff < 10) return 'green';
    if (diff < 15) return 'yellow';
    return 'red';
  };

  const WAIT_BORDER_DARK = {
    green: 'border-emerald-500/70',
    yellow: 'border-yellow-500/70',
    red: 'border-red-500/70'
  };
  const WAIT_BORDER_LIGHT = {
    green: 'border-emerald-500',
    yellow: 'border-yellow-500',
    red: 'border-red-500'
  };

  const renderPlayerCard = (player, inMatch, section) => {
    const wait = !inMatch ? getWaitState(player.joinedAt) : null;
    const waitHook = wait ? `wait-border wait-border-${wait}` : '';

    // Players in a match or on court can't be acted on, so their cards are
    // washed out. The hook classes also let Neon tint the border per section.
    const playHook = inMatch
      ? `card-in-play ${section === 'court' ? 'card-in-court' : 'card-in-queue'}`
      : (player.id === highlightPlayerId ? 'card-search-found' : '');

    const inPlayBorderDark = section === 'court'
      ? 'border-emerald-500/40'
      : 'border-yellow-500/40';
    const inPlayBorderLight = section === 'court'
      ? 'border-emerald-500'
      : 'border-yellow-500';

    const borderDark = wait
      ? WAIT_BORDER_DARK[wait]
      : (inMatch ? inPlayBorderDark : 'border-slate-700/50 hover:border-cyan-500/50');
    const borderLight = wait
      ? WAIT_BORDER_LIGHT[wait]
      : (inMatch ? inPlayBorderLight : 'border-slate-300 hover:border-cyan-600 hover:shadow-md');

    return (
    <div
      key={player.id}
      draggable={!inMatch}
      onDragStart={(e) => !inMatch && handleDragStart(e, player, 'pool')}
      data-player-card={player.id}
      data-flip-key={`p-${player.id}`}
      className={`pool-card group rounded-lg p-2 border transition-all ${waitHook} ${playHook} ${
        freshIds.current.has(player.id) ? 'animate-card-settle ' : ''
      }${
        isDarkMode
          ? `bg-slate-800/50 ${borderDark}`
          : `bg-white shadow-sm ${borderLight}`
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
      <div className="flex items-center justify-between gap-1 flex-nowrap">
        <LevelBadge level={player.level} isDarkMode={isDarkMode} />
        <div className="flex items-center gap-2 text-xs flex-shrink-0 whitespace-nowrap">
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
  const renderNotPresentCard = (player) => (
    <div
      key={player.id}
      draggable={true}
      data-player-card={player.id}
      onDragStart={(e) => handleDragStart(e, player, 'notPresent')}
      className={`pool-card card-not-present group rounded-lg px-2 py-1.5 border transition-all cursor-grab active:cursor-grabbing ${
        freshIds.current.has(player.id) ? 'animate-card-settle ' : ''
      }${
        player.id === highlightPlayerId ? 'card-search-found ' : ''
      }${
        isDarkMode 
          ? 'bg-slate-800/30 border-slate-600/50 hover:border-slate-500' 
          : 'bg-white border-slate-300 hover:border-slate-400 shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={`font-light text-sm truncate flex-1 ${
          isDarkMode ? 'text-slate-300' : 'text-slate-800'
        }`}>{player.name}</span>
        <button
          onClick={() => moveToAvailable(player.id)}
          title={`Check ${player.name} in to Available`}
          className={`neon-check-btn flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors ${
            isDarkMode
              ? 'bg-emerald-500/30 hover:bg-emerald-500/45 text-emerald-200'
              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-400'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          onClick={() => removeFromPool(player.id)}
          className={`neon-remove-btn flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors ${
            isDarkMode
              ? 'bg-red-500/30 hover:bg-red-500/45 text-red-200'
              : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-400'
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
            <div className={`panel-icon w-8 h-8 rounded-lg flex items-center justify-center ${
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
            className="w-28 flex-none"
            compact
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
        {(
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
              <div className="head-available flex items-center gap-2 mb-2">
                <div className="head-dot w-2 h-2 bg-blue-500 rounded-full"></div>
                <h3 className={`text-sm font-semibold uppercase tracking-wider ${
                  isDarkMode ? 'text-blue-400' : 'text-blue-600'
                }`}>
                  Available
                </h3>
                <span className={`count-pill text-[9px] leading-none px-1.5 py-[3px] rounded-full ${isDarkMode ? 'bg-cyan-500/15 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>{availablePlayers.length}</span>
                <AddPlayerMenu
                  isDarkMode={isDarkMode}
                  players={pickerPlayers}
                  getStatus={playerSectionStatus}
                  onSelect={(player) => onAddToAvailable?.(player)}
                  onCreatePlayer={onCreatePlayer}
                  levels={SKILL_LEVELS}
                  title="Add a player to Available"
                  className="ml-auto"
                  accent="blue"
                />
              </div>
              {availablePlayers.length === 0 ? (
                <div className={`text-center py-4 text-sm rounded-lg ${
                  isDarkMode ? 'text-slate-500 bg-slate-800/30' : 'text-slate-400 bg-slate-100'
                }`}>
                  No available players
                </div>
              ) : (
                <div ref={availableGridRef} className={`grid ${gridCols} gap-2`}>
                  {availablePlayers.map(player => (
                    renderPlayerCard(player, false)
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
              <div className={`head-notpresent flex items-center gap-2 mb-2 pt-2 border-t ${
                isDarkMode ? 'border-slate-700/50' : 'border-slate-200'
              }`}>
                <div className={`head-dot w-2 h-2 rounded-full ${isDarkMode ? 'bg-slate-500' : 'bg-slate-400'}`}></div>
                <h3 className={`head-notpresent-title text-sm font-semibold uppercase tracking-wider ${
                  isDarkMode ? 'text-slate-400' : 'text-slate-500'
                }`}>
                  Not Present
                </h3>
                <span className={`count-pill text-[9px] leading-none px-1.5 py-[3px] rounded-full ${isDarkMode ? 'bg-slate-500/15 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>{filteredNotPresent.length}</span>
                <AddPlayerMenu
                  isDarkMode={isDarkMode}
                  players={pickerPlayers}
                  getStatus={playerSectionStatus}
                  onSelect={(player) => onAddToPool?.(player)}
                  onCreatePlayer={onCreatePlayer}
                  levels={SKILL_LEVELS}
                  title="Add a player to Not Present"
                  className="ml-auto"
                  accent="slate"
                />
              </div>
              {filteredNotPresent.length === 0 ? (
                <div className={`text-center py-4 text-sm rounded-lg ${
                  isDarkMode ? 'text-slate-600 bg-slate-800/20' : 'text-slate-400 bg-slate-50'
                }`}>
                  No players waiting to arrive
                </div>
              ) : (
                <div ref={notPresentGridRef} className="flex flex-col gap-2">
                  {sortedLetters.map(letter => (
                    <div key={letter}>
                      <div className={`text-xs font-bold px-1 py-0.5 mb-1 ${
                        isDarkMode ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        {letter}
                      </div>
                      <div className={`grid ${gridCols} gap-1`}>
                        {groupedNotPresent[letter].map(player => (
                          renderNotPresentCard(player)
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Players In Match Queue Section - Collapsible */}
            {playersInQueue.length > 0 && (
              <div ref={inQueueSectionRef}>
                <button
                  onClick={() => {
                    const opening = inQueueCollapsed;
                    setInQueueCollapsed(!inQueueCollapsed);
                    if (opening) revealSection(inQueueSectionRef);
                  }}
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
                    <span className={`count-pill text-[9px] leading-none px-1.5 py-[3px] rounded-full ${isDarkMode ? 'bg-yellow-500/15 text-yellow-300' : 'bg-yellow-100 text-yellow-700'}`}>{playersInQueue.length}</span>
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
                      renderPlayerCard(player, true, 'queue')
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Players On Court Section - Collapsible */}
            {playersOnCourt.length > 0 && (
              <div ref={onCourtSectionRef}>
                <button
                  onClick={() => {
                    const opening = onCourtCollapsed;
                    setOnCourtCollapsed(!onCourtCollapsed);
                    if (opening) revealSection(onCourtSectionRef);
                  }}
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
                    <span className={`count-pill text-[9px] leading-none px-1.5 py-[3px] rounded-full ${isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>{playersOnCourt.length}</span>
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
                      renderPlayerCard(player, true, 'court')
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* Not In Pool - database players matching the search that aren't
            in the pool yet, with a shortcut to add them. */}
        {notInPoolMatches.length > 0 && (
          <div className={`mt-4 pt-3 border-t ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`head-notinpool-dot w-2 h-2 rounded-full ${isDarkMode ? 'bg-red-500' : 'bg-red-400'}`}></div>
              <h3 className={`head-notinpool-title text-sm font-semibold uppercase tracking-wider ${
                isDarkMode ? 'text-red-400' : 'text-red-500'
              }`}>
                Not In Pool
              </h3>
              <span className={`count-pill text-[9px] leading-none px-1.5 py-[3px] rounded-full ${
                isDarkMode ? 'bg-red-500/15 text-red-300' : 'bg-red-100 text-red-600'
              }`}>{notInPoolMatches.length}</span>
            </div>
            <div className={`grid ${gridCols} gap-2`}>
              {notInPoolMatches.map(player => (
                <div
                  key={player.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, player, 'notInPool')}
                  className={`pool-card group rounded-lg px-2 py-1.5 border flex items-center justify-between gap-2 cursor-grab active:cursor-grabbing ${
                    isDarkMode
                      ? 'bg-slate-800/40 border-slate-700/50 hover:border-slate-500'
                      : 'bg-white border-slate-300 hover:border-slate-400 shadow-sm'
                  }`}
                >
                  <span className={`font-normal text-sm truncate ${
                    player.gender === 'male'
                      ? (isDarkMode ? 'text-blue-300' : 'text-blue-700')
                      : (isDarkMode ? 'text-pink-300' : 'text-pink-700')
                  }`}>{player.name}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { onAddToAvailable?.(player); setPoolSearch(''); }}
                    title={`Check ${player.name} in to Available`}
                    className={`neon-check-btn-blue flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors ${
                      isDarkMode
                        ? 'bg-blue-500/25 hover:bg-blue-500/40 text-blue-200'
                        : 'bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-400'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => { onAddToPool?.(player); setPoolSearch(''); }}
                    title={`Add ${player.name} to Not Present`}
                    className={`neon-add-btn-slate flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors ${
                      isDarkMode
                        ? 'bg-slate-600/40 hover:bg-slate-600/60 text-slate-200'
                        : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-400'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default PlayerPool;
