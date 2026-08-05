import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';

/**
 * "+" button that opens a player picker, indexed A-Z.
 *
 * Every player in the database is listed, whether or not they're already in the
 * pool — a coloured dot shows where they currently sit.
 *
 * Hovering (or clicking) a letter reveals the players whose name starts with it;
 * clicking a player selects them. The menu stays open after a selection so
 * several players can be added in a row — the search box is cleared and
 * refocused each time, ready for the next name. When a search narrows to a
 * single match, Enter selects that player. It closes on an outside click or
 * Escape.
 *
 * The list is rendered through a portal into <body>, because the panels use a
 * backdrop-filter — which makes them the containing block for fixed-position
 * children and would otherwise trap and clip the dropdown.
 *
 * @param {Object} props
 * @param {boolean} props.isDarkMode - Theme mode
 * @param {Array} props.players - Candidate players to choose from
 * @param {Function} props.onSelect - Called with the chosen player
 * @param {string} props.title - Tooltip / heading for the menu
 * @param {string} [props.accent] - 'cyan' | 'red', for the button styling
 */
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const AddPlayerMenu = ({ isDarkMode = true, players = [], onSelect, title = 'Add player', accent = 'cyan', className = '', getStatus, onCreatePlayer, levels = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creatingClosing, setCreatingClosing] = useState(false);
  const defaultLevel = levels[1] || levels[0] || 'Intermediate';
  const [draft, setDraft] = useState({ name: '', level: defaultLevel, gender: 'male' });
  const nameRef = useRef(null);
  const [coords, setCoords] = useState(null);
  const [activeLetter, setActiveLetter] = useState(null);
  const [search, setSearch] = useState('');
  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const hoverTimer = useRef(null);
  const searchRef = useRef(null);

  // Group the candidates by first letter.
  const byLetter = useMemo(() => {
    const map = {};
    players.forEach((p) => {
      const first = (p.name || '?').trim().charAt(0).toUpperCase();
      const key = LETTERS.includes(first) ? first : '#';
      if (!map[key]) map[key] = [];
      map[key].push(p);
    });
    Object.values(map).forEach(list => list.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [players]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return players
      .filter(p => p.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [players, search]);

  // The panel is a fixed size (search + A-Z index + legend + six player rows),
  // so its height is known up front and the position can always be resolved to
  // something fully on screen.
  const BASE_WIDTH = 260;
  const CREATE_WIDTH = 210;
  const PANEL_HEIGHT = 336;
  const MARGIN = 10;
  const panelWidth = BASE_WIDTH + (showCreate ? CREATE_WIDTH : 0);

  // Opening and closing the create column are separate steps so the panel can
  // shrink only after the column has finished fading out.
  const openCreate = () => {
    setCreatingClosing(false);
    setShowCreate(true);
    setTimeout(() => nameRef.current?.focus(), 80);
  };

  const closeCreate = () => {
    setCreatingClosing(true);
    setTimeout(() => {
      setShowCreate(false);
      setCreatingClosing(false);
      setDraft({ name: '', level: defaultLevel, gender: 'male' });
    }, 160);
  };

  const position = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();

    // Preferred: just below the button, otherwise just above it.
    let top;
    if (r.bottom + 4 + PANEL_HEIGHT <= window.innerHeight - MARGIN) {
      top = r.bottom + 4;
    } else if (r.top - 4 - PANEL_HEIGHT >= MARGIN) {
      top = r.top - 4 - PANEL_HEIGHT;
    } else {
      top = window.innerHeight - MARGIN - PANEL_HEIGHT;
    }

    // Then clamp unconditionally. Scrolling the pool moves the button — it can
    // even leave the viewport entirely, giving a negative rect — so the chosen
    // position has to be pinned inside the screen every time this runs.
    const maxTop = Math.max(MARGIN, window.innerHeight - MARGIN - PANEL_HEIGHT);
    top = Math.min(Math.max(top, MARGIN), maxTop);

    setCoords({
      top,
      left: Math.max(MARGIN, Math.min(r.left, window.innerWidth - panelWidth - MARGIN)),
      width: panelWidth,
      height: PANEL_HEIGHT,
      openedUp: top < r.top,
    });
  }, [panelWidth]);

  // Re-place the panel when the create column opens or closes, since it changes
  // the width and could otherwise push the panel off the edge of the screen.
  useLayoutEffect(() => {
    if (isOpen) position();
  }, [showCreate, isOpen, position]);

  // Keep the panel mounted for the length of its exit animation.
  const close = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setIsClosing(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
      setActiveLetter(null);
      setSearch('');
      setShowCreate(false);
      setCreatingClosing(false);
      setDraft({ name: '', level: defaultLevel, gender: 'male' });
    }, 140);
  }, []);

  // Letters only switch after a short dwell, so sliding the mouse down to the
  // player list doesn't change the selection as it passes over other letters.
  const HOVER_DELAY_MS = 200;
  const hoverLetter = (letter) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setActiveLetter(letter), HOVER_DELAY_MS);
  };
  const cancelHover = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  };
  const selectLetter = (letter) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setActiveLetter(letter);
  };

  // Clear any pending switch when the menu unmounts
  useEffect(() => () => { if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onDown = (e) => {
      if (!buttonRef.current?.contains(e.target) && !panelRef.current?.contains(e.target)) close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const onReflow = () => position();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [isOpen, close, position]);

  // Selecting a player does NOT close the menu, so several can be added in a
  // row. The chosen player drops out of the candidate list as confirmation.
  // The menu closes on an outside click or Escape.
  // Create the player in the database, then drop them straight into whichever
  // section this picker belongs to.
  const createPlayer = () => {
    const name = draft.name.trim();
    if (!name || !onCreatePlayer) return;
    const created = onCreatePlayer({ name, level: draft.level, gender: draft.gender });
    const player = created && typeof created === 'object'
      ? created
      : { id: created, name, level: draft.level, gender: draft.gender };
    onSelect?.(player);
    setDraft({ name: '', level: defaultLevel, gender: 'male' });
    setTimeout(() => nameRef.current?.focus(), 0);
  };

  const pick = (player) => {
    onSelect?.(player);
    // Clear the search and put the cursor back in it, ready for the next name.
    setSearch('');
    setTimeout(() => searchRef.current?.focus(), 0);
  };

  const btnAccent = accent === 'blue'
    ? (isDarkMode
        ? 'bg-blue-500/25 hover:bg-blue-500/40 text-blue-200'
        // Same cyan as the Done button on a court
        : 'bg-cyan-500 hover:bg-cyan-400 text-white')
    : accent === 'slate'
    ? (isDarkMode
        ? 'bg-slate-600/40 hover:bg-slate-600/60 text-slate-300'
        : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-400')
    : accent === 'red'
    ? (isDarkMode
        ? 'bg-red-500/20 hover:bg-red-500/35 text-red-300'
        : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-400')
    : (isDarkMode
        ? 'bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300'
        : 'bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border border-cyan-400');

  const shown = searchResults !== null ? searchResults : (activeLetter ? (byLetter[activeLetter] || []) : null);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          if (isOpen) { close(); } else { setIsClosing(false); position(); setIsOpen(true); }
        }}
        title={title}
        className={`${accent === 'red' ? 'neon-add-btn-red' : accent === 'slate' ? 'neon-add-btn-slate' : accent === 'blue' ? 'neon-check-btn-blue' : 'neon-add-btn'} ${className} w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${btnAccent}`}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {isOpen && coords && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: panelWidth,
            height: coords.height,
            zIndex: 70,
          }}
          className={`picker-panel ${
            isClosing
              ? (coords.openedUp ? 'animate-panel-close-up' : 'animate-panel-close')
              : (coords.openedUp ? 'animate-panel-open-up' : 'animate-panel-open')
          } rounded-lg shadow-xl border overflow-hidden flex flex-col ${
            isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex flex-1 min-h-0 overflow-hidden">
          <div className="flex flex-col min-h-0 flex-shrink-0" style={{ width: BASE_WIDTH }}>
          <div className={`flex-shrink-0 px-2.5 py-2 border-b flex items-center gap-1.5 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <input
              ref={searchRef}
              autoFocus
              value={search}
              onChange={(e) => { setSearch(e.target.value); setActiveLetter(null); }}
              onKeyDown={(e) => {
                // Enter picks the player when the search narrows to exactly one.
                if (e.key === 'Enter' && searchResults?.length === 1) {
                  e.preventDefault();
                  pick(searchResults[0]);
                }
              }}
              placeholder="Search or pick a letter..."
              className={`w-full rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500'
                  : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
              }`}
            />
            {onCreatePlayer && (
              <button
                onClick={() => (showCreate ? closeCreate() : openCreate())}
                title={showCreate ? 'Close new player' : 'Create a new player'}
                className={`neon-check-btn-blue flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors ${
                  showCreate
                    ? (isDarkMode ? 'bg-blue-500/40 text-blue-100' : 'bg-cyan-600 text-white')
                    : (isDarkMode ? 'bg-blue-500/25 hover:bg-blue-500/40 text-blue-200' : 'bg-cyan-500 hover:bg-cyan-400 text-white')
                }`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
          </div>

          {/* A-Z index (always shown, so the panel keeps a constant height) */}
          <div
              onMouseLeave={cancelHover}
              className={`flex-shrink-0 grid grid-cols-9 gap-0.5 p-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}
            >
              {LETTERS.map((letter) => {
                const count = byLetter[letter]?.length || 0;
                const isActive = activeLetter === letter;
                return (
                  <button
                    key={letter}
                    disabled={count === 0}
                    onMouseEnter={() => count > 0 && hoverLetter(letter)}
                    onMouseLeave={cancelHover}
                    onClick={() => count > 0 && selectLetter(letter)}
                    className={`text-[10px] leading-none py-1 rounded transition-colors ${
                      count === 0
                        ? (isDarkMode ? 'text-slate-600 cursor-default' : 'text-slate-300 cursor-default')
                        : isActive
                          ? 'bg-cyan-600 text-white'
                          : (isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-100')
                    }`}
                  >
                    {letter}
                  </button>
                );
              })}
            </div>

          <div className={`flex-shrink-0 flex items-center gap-3 px-2.5 py-1.5 border-b text-[10px] ${
            isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-500'
          }`}>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />Available</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />Not Present</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-400" />In match</span>
          </div>

          {/* Players for the hovered letter, or search results */}
          <div className="h-[192px] flex-shrink-0 overflow-y-auto custom-scrollbar">
            {shown === null ? (
              <div className={`px-3 py-4 text-center text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Hover a letter to see players
              </div>
            ) : shown.length === 0 ? (
              <div className={`px-3 py-4 text-center text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                No players found
              </div>
            ) : (
              shown.map((player) => (
                <button
                  key={player.id}
                  onClick={() => pick(player)}
                  className={`w-full text-left px-3 py-1 text-xs flex items-center justify-between gap-2 transition-colors ${
                    isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    {(() => {
                      const status = getStatus?.(player);
                      if (!status) return <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-transparent" />;
                      const dot = status === 'available' ? 'bg-cyan-400'
                        : status === 'notPresent' ? 'bg-red-400'
                          : 'bg-amber-400';
                      const label = status === 'available' ? 'In Available'
                        : status === 'notPresent' ? 'In Not Present'
                          : 'In a match';
                      return <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} title={label} />;
                    })()}
                    <span className={`truncate ${
                      player.gender === 'male'
                        ? (isDarkMode ? 'text-blue-300' : 'text-blue-700')
                        : (isDarkMode ? 'text-pink-300' : 'text-pink-700')
                    }`}>{player.name}</span>
                  </span>
                  <span className={`flex-shrink-0 w-3.5 leading-none py-[3px] rounded font-bold text-[9px] text-center ${
                    player.level === 'Expert'
                      ? (isDarkMode ? 'bg-purple-500/50 text-purple-200 border border-purple-400/50' : 'bg-purple-100 text-purple-700 border border-purple-400')
                      : player.level === 'Advanced'
                        ? (isDarkMode ? 'bg-orange-500/50 text-orange-200 border border-orange-400/50' : 'bg-orange-100 text-orange-700 border border-orange-400')
                        : player.level === 'Intermediate'
                          ? (isDarkMode ? 'bg-cyan-500/50 text-cyan-200 border border-cyan-400/50' : 'bg-cyan-100 text-cyan-700 border border-cyan-400')
                          : (isDarkMode ? 'bg-green-500/50 text-green-200 border border-green-400/50' : 'bg-green-100 text-green-700 border border-green-400')
                  }`}>
                    {player.level?.[0]}
                  </span>
                </button>
              ))
            )}
          </div>
          </div>

          {showCreate && onCreatePlayer && (
            <div
              className={`flex flex-col border-l flex-shrink-0 ${creatingClosing ? 'animate-create-out' : 'animate-create-in'} ${
                isDarkMode ? 'border-slate-700' : 'border-slate-200'
              }`}
              style={{ width: CREATE_WIDTH }}
            >
              <div className={`px-2.5 py-2 border-b text-xs font-semibold flex items-center justify-between gap-2 ${
                isDarkMode ? 'border-slate-700 text-white' : 'border-slate-200 text-slate-800'
              }`}>
                New player
                <button
                  onClick={closeCreate}
                  title="Close"
                  className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                    isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-2.5 flex flex-col gap-2">
                <input
                  ref={nameRef}
                  value={draft.name}
                  onChange={(e) => setDraft(d => ({ ...d, name: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') createPlayer(); }}
                  placeholder="Name"
                  className={`w-full rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                    isDarkMode
                      ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500'
                      : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                  }`}
                />

                <div className="grid grid-cols-2 gap-1">
                  {['male', 'female'].map(g => (
                    <button
                      key={g}
                      onClick={() => setDraft(d => ({ ...d, gender: g }))}
                      className={`rounded-md py-1 text-xs capitalize border transition-colors ${
                        draft.gender === g
                          ? (g === 'male'
                              ? (isDarkMode ? 'bg-blue-500/25 border-blue-400 text-blue-200' : 'bg-blue-100 border-blue-400 text-blue-800')
                              : (isDarkMode ? 'bg-pink-500/25 border-pink-400 text-pink-200' : 'bg-pink-100 border-pink-400 text-pink-800'))
                          : (isDarkMode ? 'border-slate-600 text-slate-400 hover:bg-slate-700' : 'border-slate-300 text-slate-500 hover:bg-slate-100')
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-1">
                  {levels.map(level => (
                    <button
                      key={level}
                      onClick={() => setDraft(d => ({ ...d, level }))}
                      className={`rounded-md py-1 text-xs border transition-colors ${
                        draft.level === level
                          ? (isDarkMode ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200' : 'bg-cyan-100 border-cyan-400 text-cyan-800')
                          : (isDarkMode ? 'border-slate-600 text-slate-400 hover:bg-slate-700' : 'border-slate-300 text-slate-500 hover:bg-slate-100')
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>

                <button
                  onClick={createPlayer}
                  disabled={!draft.name.trim()}
                  className={`mt-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                    draft.name.trim()
                      ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      : (isDarkMode ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-slate-200 text-slate-400 cursor-not-allowed')
                  }`}
                >
                  Add player
                </button>
              </div>
            </div>
          )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default AddPlayerMenu;
