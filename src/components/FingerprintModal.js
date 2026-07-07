import React, { useState, useMemo } from 'react';

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
  onCancel = () => {},
  isDarkMode = true,
}) => {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const enrolledSet = useMemo(() => new Set(enrolledPlayerIds), [enrolledPlayerIds]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => !q || p.name.toLowerCase().includes(q)).slice(0, 100);
  }, [players, search]);

  if (!isOpen) return null;

  const capturing = phase === 'capturing';
  const canStart = selectedId != null;

  const handleStart = () => {
    if (!canStart) return;
    onStartEnroll(selectedId);
  };
  const handleCancel = () => {
    setSearch('');
    setSelectedId(null);
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
      <div className={`w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className={`px-5 py-4 border-b flex items-center gap-3 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11a5 5 0 0110 0c0 3-1 5-1 7M5 13a7 7 0 0113-3.5M12 11v3a6 6 0 001.5 4" />
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
          </div>
        )}

        {/* Footer */}
        <div className={`px-5 py-4 border-t flex gap-2 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            onClick={handleCancel}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Cancel
          </button>
          {!capturing && (
            <button
              onClick={handleStart}
              disabled={!canStart}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all ${canStart ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-md shadow-cyan-500/25' : isDarkMode ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              Start Enrollment
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FingerprintModal;
