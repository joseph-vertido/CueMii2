import React, { useState, useMemo, useEffect } from 'react';
import { showAlert } from '../utils/appAlert';
import ThemedSelect from './ThemedSelect';
import { SKILL_LEVELS } from '../data/initialData';

/**
 * FingerprintModal (direct-capture)
 * ---------------------------------
 * Two phases:
 *   'select'    - unknown finger scanned; pick which player to enroll it to.
 *   'capturing' - service is capturing enrollment scans; show progress. Keep
 *                 scanning the SAME finger until the bar fills.
 */
const FingerprintModal = ({
  isOpen,
  phase = 'select',
  players = [],
  enrolledPlayerIds = [],
  capturedCount = 0,
  requiredCount = 4,
  onStartEnroll = () => {},
  onAddPlayer = () => 0,
  onCancel = () => {},
  isDarkMode = true,
}) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [mode, setMode] = useState('existing'); // 'existing' | 'new'
  const [newPlayer, setNewPlayer] = useState({ name: '', gender: 'male', level: 'Intermediate' });

  const toTitleCase = (s) =>
    s.trim().replace(/\s+/g, ' ').split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  const enrolledSet = useMemo(() => new Set(enrolledPlayerIds), [enrolledPlayerIds]);

  // Reset to a clean state whenever the dialog closes.
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedId(null);
      setMode('existing');
      setNewPlayer({ name: '', gender: 'male', level: 'Intermediate' });
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 100);
  }, [players, search]);

  if (!isOpen) return null;

  const capturing = phase === 'capturing';
  const canStart = mode === 'new' ? newPlayer.name.trim() !== '' : selectedId != null;

  const handleStart = () => {
    if (mode === 'new') {
      const name = newPlayer.name.trim();
      if (!name) return;
      if (players.some(p => p.name.trim().toLowerCase() === name.toLowerCase())) {
        showAlert(`A player named "${name}" already exists. Pick them from the Existing list instead.`);
        return;
      }
      const id = onAddPlayer({ ...newPlayer, name: toTitleCase(name) });
      if (id != null) onStartEnroll(id);
      return;
    }
    if (selectedId != null) onStartEnroll(selectedId);
  };
  const handleCancel = () => {
    setSearch('');
    setSelectedId(null);
    setMode('existing');
    setNewPlayer({ name: '', gender: 'male', level: 'Intermediate' });
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60">
      <div className={`neon-panel w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center gap-3 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="fp-badge w-9 h-9 rounded-lg bg-cyan-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3" />
              <path d="M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6" />
              <path d="M12 11v2a14 14 0 0 0 2.5 8" />
              <path d="M8 15a18 18 0 0 0 1.8 6" />
              <path d="M4.9 19a22 22 0 0 1 -.9 -7v-1a8 8 0 0 1 12 -6.95" />
            </svg>
          </div>
          <div>
            <h2 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Assign Fingerprint</h2>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {capturing ? 'Keep scanning the same finger…' : "This finger isn't assigned. Pick a player."}
            </p>
          </div>
        </div>

        {capturing ? (
          /* Capturing phase */
          <div className="px-5 py-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                Scanning finger
              </span>
              <span className="text-xs font-mono text-cyan-400">
                {Math.min(capturedCount, requiredCount)}/{requiredCount}
              </span>
            </div>
            <div className="flex gap-1.5">
              {Array.from({ length: requiredCount }).map((_, i) => (
                <div key={i} className={`h-2 flex-1 rounded-full transition-colors ${i < capturedCount ? 'bg-emerald-500' : isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`} />
              ))}
            </div>
            <p className={`text-xs mt-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Lift and place the same finger on the reader {requiredCount} times.
            </p>
          </div>
        ) : (
          /* Select phase */
          <div className="px-5 py-4">
            {/* Mode tabs */}
            <div className="flex gap-1 mb-3">
              <button
                onClick={() => setMode('existing')}
                className={`fp-btn flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'existing' ? (isDarkMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-600 text-white shadow-sm') : (isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}`}
              >
                Existing Player
              </button>
              <button
                onClick={() => setMode('new')}
                className={`fp-btn flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mode === 'new' ? (isDarkMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-600 text-white shadow-sm') : (isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}`}
              >
                + New Player
              </button>
            </div>

            {mode === 'existing' ? (
              <>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players…"
                  className={`w-full px-3 py-2 rounded-lg text-sm outline-none border mb-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`}
                />
                <div className={`max-h-56 overflow-y-auto rounded-lg border ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                  {filtered.length === 0 ? (
                    <p className={`text-sm text-center py-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>No players found</p>
                  ) : (
                    filtered.map((p) => {
                      const isSelected = selectedId === p.id;
                      const alreadyEnrolled = enrolledSet.has(p.id);
                      return (
                        <button
                          key={p.id}
                          onClick={() => setSelectedId(p.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors ${isSelected ? 'bg-cyan-500/15 text-cyan-300' : isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'}`}
                        >
                          <span className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${p.gender === 'female' ? 'bg-pink-400' : 'bg-blue-400'}`} />
                            {p.name}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{p.level}</span>
                            {alreadyEnrolled && <span className="text-xs text-emerald-400" title="Already enrolled">●</span>}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              /* New player form */
              <div className="space-y-3">
                <div>
                  <label className={`block text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Name</label>
                  <input
                    type="text"
                    value={newPlayer.name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                    placeholder="Player name"
                    autoFocus
                    className={`w-full px-3 py-2 rounded-lg text-sm outline-none border ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-800 placeholder-slate-400'}`}
                  />
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Gender</label>
                  <div className="flex gap-2">
                    {['male', 'female'].map(g => (
                      <button
                        key={g}
                        onClick={() => setNewPlayer({ ...newPlayer, gender: g })}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${newPlayer.gender === g ? (g === 'female' ? 'bg-pink-500/20 text-pink-300' : 'bg-blue-500/20 text-blue-300') : isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Level</label>
                  <ThemedSelect
                    className="w-full"
                    value={newPlayer.level}
                    onChange={(e) => setNewPlayer({ ...newPlayer, level: e.target.value })}
                    isDarkMode={isDarkMode}
                  >
                    {SKILL_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </ThemedSelect>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={`px-5 py-4 border-t flex gap-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            onClick={handleCancel}
            className={`fp-btn flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Cancel
          </button>
          {!capturing && (
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${canStart ? 'bg-cyan-700 hover:bg-cyan-600 text-white' : isDarkMode ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              {mode === 'new' ? 'Add & Enroll' : 'Start Enrollment'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FingerprintModal;
