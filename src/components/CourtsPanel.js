import React, { useMemo, useRef, useEffect } from 'react';
import useFlipList from '../hooks/useFlipList';
import { formatCourtTime } from '../utils/formatters';

/**
 * Courts panel displaying all courts and their current status - Ultra compact
 */
const CourtsPanel = ({
  highlightPlayerId,
  courts,
  newCourtName,
  setNewCourtName,
  addCourt,
  deleteCourt,
  editingCourtId,
  setEditingCourtId,
  editingCourtName,
  setEditingCourtName,
  renameCourt,
  endMatch,
  returnMatchToQueue,
  currentTime,
  isDarkMode = true,
  lastEndedMatch,
  undoEndMatch,
  poolPlayers = [],
  matches = [],
  scrollToCourtId = null,
  panelWidth = 280
}) => {
  // Refs for each court element
  const courtRefs = useRef({});
  // Courts are ordered by when their match was assigned, so assigning one
  // genuinely reorders the panel - animate the cards to their new places.
  const courtGridRef = useRef(null);

  // Courts that have just appeared get an entrance animation.
  //
  // Freshness is worked out during the render itself, not in an effect. An
  // effect runs *after* the first paint, so the court would appear at full size
  // for one frame and only then jump to the start of its animation — that flash
  // is the flicker.
  const seenCourtIds = useRef(null);
  const freshCourtIds = useRef(new Set());
  const courtIds = courts.map(c => c.id);
  if (seenCourtIds.current === null) {
    seenCourtIds.current = new Set(courtIds);
  } else {
    const added = courtIds.filter(id => !seenCourtIds.current.has(id));
    if (added.length > 0) {
      added.forEach(id => freshCourtIds.current.add(id));
      seenCourtIds.current = new Set(courtIds);
    } else if (courtIds.length !== seenCourtIds.current.size) {
      seenCourtIds.current = new Set(courtIds);
    }
  }

  // Drop the marker once the animation has played, so it can't replay later.
  useEffect(() => {
    if (freshCourtIds.current.size === 0) return undefined;
    const t = setTimeout(() => freshCourtIds.current.clear(), 600);
    return () => clearTimeout(t);
  }, [courts]);
  // Hold the courts still while the players are walking on, then move them at a
  // more readable pace than the default.
  useFlipList(courtGridRef, { duration: 600, delay: 680 });
  
  // Determine grid columns based on panel width
  const useGrid = panelWidth >= 380;
  
  // A search that narrows to one player scrolls their court into view, so the
  // green highlight isn't off screen. Only scrolls when it's actually out of
  // sight, so the panel doesn't shift around while typing.
  useEffect(() => {
    if (!highlightPlayerId) return;
    const el = document.querySelector(`[data-court-player="${highlightPlayerId}"]`);
    const container = courtGridRef.current;
    if (!el || !container) return;
    const row = el.getBoundingClientRect();
    const view = container.getBoundingClientRect();
    if (row.top >= view.top && row.bottom <= view.bottom) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightPlayerId]);

  // A newly assigned court sorts to the end of the list, so follow it all the
  // way to the bottom. Waits for the reorder to begin so the scroll travels with
  // the card rather than arriving before it has moved.
  useEffect(() => {
    if (!scrollToCourtId) return undefined;
    const t = setTimeout(() => {
      const container = courtGridRef.current;
      if (container) {
        container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
      } else if (courtRefs.current[scrollToCourtId]) {
        courtRefs.current[scrollToCourtId].scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }, 700);
    return () => clearTimeout(t);
  }, [scrollToCourtId]);
  // Compute which players need alternate name format (LastName F.) due to duplicates
  const playersNeedingAltFormat = useMemo(() => {
    // Get all players from pool, matches, and courts
    const allPlayers = [...poolPlayers];
    matches.forEach(m => {
      m.players.forEach(p => {
        if (!allPlayers.find(ap => ap.id === p.id)) {
          allPlayers.push(p);
        }
      });
    });
    courts.forEach(c => {
      if (c.match?.players) {
        c.match.players.forEach(p => {
          if (!allPlayers.find(ap => ap.id === p.id)) {
            allPlayers.push(p);
          }
        });
      }
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
  }, [poolPlayers, matches, courts]);

  // Format name - uses "LastName F." if there are duplicates with same "FirstName L."
  const formatName = (player) => {
    const parts = player.name.split(' ');
    
    if (parts.length > 1) {
      if (playersNeedingAltFormat.has(player.id)) {
        // Use "LastName F." format for duplicates
        return `${parts[parts.length - 1]} ${parts[0][0]}.`;
      } else {
        // Use normal "FirstName L." format
        return `${parts[0]} ${parts[parts.length - 1][0]}.`;
      }
    }
    return parts[0];
  };

  // Get elapsed minutes for a court
  const getElapsedMinutes = (startTime) => {
    if (!startTime) return 0;
    return Math.floor((currentTime - startTime) / 1000 / 60);
  };

  // Get court status based on elapsed time
  const getCourtStatus = (startTime) => {
    const minutes = getElapsedMinutes(startTime);
    if (minutes >= 30) return 'red';
    if (minutes >= 20) return 'yellow';
    return 'normal';
  };

  return (
    <section className={`backdrop-blur-sm rounded-2xl border overflow-hidden h-full flex flex-col panel-depth ${
      isDarkMode ? 'bg-slate-900/50 border-slate-700/50' : 'bg-white border-slate-300'
    }`}>
      <div className={`border-b px-3 py-2 ${
        isDarkMode 
          ? 'bg-slate-800/60 border-slate-700/50' 
          : 'bg-slate-100 border-slate-300'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`panel-icon w-6 h-6 rounded flex items-center justify-center ${
              isDarkMode ? 'bg-cyan-500/20' : 'bg-cyan-100'
            }`}>
              <svg className={`w-4 h-4 ${isDarkMode ? 'text-cyan-500' : 'text-cyan-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Courts</span>
            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>({courts.filter(c => c.match).length}/{courts.length})</span>
          </div>
        </div>
        
        {/* Add Court - Inline */}
        <div className="flex gap-1">
          <input
            type="text"
            value={newCourtName}
            onChange={(e) => setNewCourtName(e.target.value)}
            placeholder="New court..."
            className={`flex-1 border rounded px-2 py-1 focus:outline-none transition-colors text-xs ${
              isDarkMode 
                ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-cyan-500' 
                : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400 focus:border-cyan-500'
            }`}
            onKeyPress={(e) => e.key === 'Enter' && addCourt()}
          />
          <button
            onClick={addCourt}
            disabled={!newCourtName.trim()}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-400 disabled:cursor-not-allowed px-2 py-1 rounded font-semibold transition-colors text-xs text-white"
          >
            +
          </button>
        </div>
      </div>
      
      <div
        ref={courtGridRef}
        className={`p-1.5 flex-1 overflow-y-auto custom-scrollbar ${
          useGrid ? 'grid grid-cols-2 gap-1.5 auto-rows-min' : 'space-y-1.5'
        }`}
      >
        {courts.length === 0 ? (
          <div className={`text-center py-4 ${useGrid ? 'col-span-2' : ''} ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            <p className="text-xs">No courts</p>
          </div>
        ) : (
          [...courts]
            .sort((a, b) => {
              // Sort by sortOrder (set when match is assigned) - oldest first
              // Courts without sortOrder go to the bottom
              const aOrder = a.sortOrder || 0;
              const bOrder = b.sortOrder || 0;
              
              if (aOrder && bOrder) {
                return aOrder - bOrder; // Older sortOrder = assigned earlier = comes first
              }
              if (aOrder) return -1; // a has sortOrder, b doesn't - a comes first
              if (bOrder) return 1;  // b has sortOrder, a doesn't - b comes first
              return 0; // Both have no sortOrder, keep original order
            })
            .map(court => {
            const courtStatus = court.match ? getCourtStatus(court.startTime) : 'empty';
            
            // Check if court was just assigned (within last 30 seconds)
            // How long a court keeps its "just assigned" green signal. The
            // pulse itself is unchanged — this only extends how long it runs.
            const NEWLY_ASSIGNED_MS = 30000;
            const isNewlyAssigned = court.match && court.startTime && (currentTime - court.startTime) < NEWLY_ASSIGNED_MS;
            
            // Determine court card styling based on status
            let cardClass, headerClass, timerClass;
            if (courtStatus === 'red') {
              cardClass = isDarkMode ? 'bg-red-900/30 border-red-500/50' : 'bg-red-50 border-red-400';
              headerClass = isDarkMode ? 'border-red-500/30 bg-red-500/10' : 'border-red-300 bg-red-100/50';
              timerClass = isDarkMode ? 'text-red-400 font-bold' : 'text-red-600 font-bold';
            } else if (courtStatus === 'yellow') {
              cardClass = isDarkMode ? 'bg-amber-900/30 border-amber-500/50' : 'bg-amber-50 border-amber-400';
              headerClass = isDarkMode ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-300 bg-amber-100/50';
              timerClass = isDarkMode ? 'text-amber-400' : 'text-amber-600';
            } else if (court.match) {
              // Normal status (under 20 min) - green timer
              cardClass = isDarkMode ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-50 border-slate-300';
              headerClass = isDarkMode ? 'border-slate-700/30' : 'border-slate-200';
              timerClass = isDarkMode ? 'text-cyan-400' : 'text-cyan-600';
            } else {
              cardClass = isDarkMode ? 'bg-slate-800/30 border-slate-700/50' : 'bg-slate-50 border-slate-300';
              headerClass = isDarkMode ? 'border-slate-700/30' : 'border-slate-200';
              timerClass = '';
            }
            
            // Add pulsating highlight for newly assigned courts.
            // '!' forces the yellow border to win over the status border color.
            const newlyAssignedClass = isNewlyAssigned 
              ? `animate-pulse-border ${isDarkMode ? '' : '!border-emerald-500'}` 
              : '';
            
            return (
            <div
              key={court.id}
              ref={(el) => courtRefs.current[court.id] = el}
              data-court-card={court.id}
              data-flip-key={`c-${court.id}`}
              className={`${freshCourtIds.current.has(court.id) ? 'animate-court-appear ' : ''}rounded border overflow-hidden card-depth ${cardClass} ${newlyAssignedClass}`}
            >
              {/* Status strip: cyan = live, amber = running long, red = overdue */}
              <div className={`court-strip h-[3px] ${
                isNewlyAssigned ? 'bg-cyan-500 animate-strip-assigned' :
                courtStatus === 'red' ? 'bg-red-500' :
                courtStatus === 'yellow' ? 'bg-amber-500' :
                court.match ? 'bg-cyan-500' : (isDarkMode ? 'bg-slate-700/60' : 'bg-slate-300')
              }`} />
              {/* Court Header - Single line */}
              <div className={`px-2 py-1.5 flex items-center justify-between gap-2 border-b ${headerClass}`}>
                {editingCourtId === court.id ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      type="text"
                      value={editingCourtName}
                      onChange={(e) => setEditingCourtName(e.target.value)}
                      className={`flex-1 min-w-0 border rounded px-1 py-0.5 text-xs ${
                        isDarkMode 
                          ? 'bg-slate-900 border-cyan-500 text-white' 
                          : 'bg-white border-cyan-500 text-slate-800'
                      }`}
                      autoFocus
                      onKeyPress={(e) => e.key === 'Enter' && renameCourt(court.id, editingCourtName)}
                    />
                    <button onClick={() => renameCourt(court.id, editingCourtName)} className={`text-xs flex-shrink-0 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>✓</button>
                    <button onClick={() => { setEditingCourtId(null); setEditingCourtName(''); }} className={`text-xs flex-shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>✕</button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        isNewlyAssigned ? 'bg-cyan-500 animate-pulse-dot-assigned' :
                        courtStatus === 'red' ? 'bg-red-500' :
                        courtStatus === 'yellow' ? 'bg-amber-500' :
                        court.match ? 'bg-cyan-500' : (isDarkMode ? 'bg-slate-600' : 'bg-slate-400')
                      }`} />
                      <span className={`font-medium text-[0.8rem] uppercase ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{court.name}</span>
                      {court.match && (
                        <span className={`neon-timer text-xs font-medium tabular inline-flex items-center gap-0.5 ml-auto ${timerClass}`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatCourtTime(court.startTime, currentTime)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => { setEditingCourtId(court.id); setEditingCourtName(court.name); }}
                        className={`p-0.5 ${isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => deleteCourt(court.id)}
                        className={`p-0.5 ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-500 hover:text-red-600'}`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
              
              {/* Court Content */}
              {court.match ? (
                <div className="px-2 pt-1.5 pb-2">
                  {/* Players - 2x2 */}
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {court.match.players.map((player) => (
                      <div
                        key={player.id}
                        data-court-player={player.id}
                        className={`rounded px-2 py-1 flex items-center justify-between h-7 border ${
                          player.id === highlightPlayerId ? 'card-search-found ' : ''
                        }${
                          isDarkMode ? 'bg-slate-900/70 border-slate-700' : 'bg-white border-slate-300'
                        }`}
                      >
                        <span className={`text-sm font-normal truncate ${
                          player.gender === 'male'
                            ? (isDarkMode ? 'text-blue-300' : 'text-blue-700')
                            : (isDarkMode ? 'text-pink-300' : 'text-pink-700')
                        }`}>{formatName(player)}</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Action Buttons - Return to Queue and Done */}
                  <div className="flex gap-1">
                    <button
                      onClick={() => returnMatchToQueue(court.id)}
                      className={`w-1/5 h-5 rounded text-[11px] font-medium flex items-center justify-center ${
                        isDarkMode 
                          ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                          : 'bg-amber-500 hover:bg-amber-400 text-white'
                      }`}
                      title="Return to queue"
                    >
                      <svg className="w-3 h-3 -scale-y-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => endMatch(court.id)}
                      className={`flex-1 h-5 rounded text-[11px] font-medium flex items-center justify-center gap-1 ${
                        isDarkMode 
                          ? 'bg-cyan-600 hover:bg-cyan-500 text-white' 
                          : 'bg-cyan-500 hover:bg-cyan-400 text-white'
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-2 pt-1.5 pb-2">
                  {/* Empty player slots - same layout as filled */}
                  <div className="grid grid-cols-2 gap-1 mb-2">
                    {[0, 1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className={`rounded px-2 py-1 h-7 flex items-center border border-dashed ${
                          isDarkMode 
                            ? 'bg-slate-900/50 border-slate-700/50' 
                            : 'bg-slate-100 border-slate-300'
                        }`}
                      >
                        <span className={`text-sm ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>—</span>
                      </div>
                    ))}
                  </div>
                  
                  {/* Show Undo button if this court just had a match ended, otherwise show Available */}
                  {lastEndedMatch?.courtId === court.id ? (
                    <button
                      onClick={undoEndMatch}
                      className={`w-full h-6 rounded text-xs font-medium flex items-center justify-center gap-1 ${
                        isDarkMode 
                          ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                          : 'bg-amber-500 hover:bg-amber-400 text-white'
                      }`}
                      title="Undo - Put players back on court"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                      Undo
                    </button>
                  ) : (
                    <div className="flex items-center justify-center text-slate-500 text-xs h-6">
                      Available
                    </div>
                  )}
                </div>
              )}
            </div>
          )})
        )}
      </div>
    </section>
  );
};

export default CourtsPanel;
