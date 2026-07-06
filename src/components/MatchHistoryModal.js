import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';

/**
 * Modal for displaying match history (completed and deleted matches)
 */
const MatchHistoryModal = ({ isOpen, onClose, matchHistory, clearHistory, isDarkMode = true }) => {
  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURN
  const [dateFilter, setDateFilter] = useState('all');
  const [nameFilter, setNameFilter] = useState('');

  // Auto-select today's date if data exists when modal opens
  useEffect(() => {
    if (isOpen && matchHistory) {
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const hasTodayData = matchHistory.some(match => {
        if (!match.endedAt) return false;
        return new Date(match.endedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) === today;
      });
      setDateFilter(hasTodayData ? today : 'all');
    }
  }, [isOpen, matchHistory]);

  // Get unique dates from match history
  const availableDates = useMemo(() => {
    if (!matchHistory || matchHistory.length === 0) return [];
    const dates = new Set();
    matchHistory.forEach(match => {
      if (match.endedAt) {
        const date = new Date(match.endedAt);
        dates.add(date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
      }
    });
    return Array.from(dates).sort((a, b) => new Date(b) - new Date(a));
  }, [matchHistory]);

  // Filter by date and name
  const filteredHistory = useMemo(() => {
    if (!matchHistory) return [];
    return matchHistory.filter(match => {
      // Date filter
      if (dateFilter !== 'all') {
        if (!match.endedAt) return false;
        const matchDate = new Date(match.endedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        if (matchDate !== dateFilter) return false;
      }
      // Name filter
      if (nameFilter.trim()) {
        const searchLower = nameFilter.toLowerCase().trim();
        const hasPlayer = match.players?.some(p => 
          p.name.toLowerCase().includes(searchLower)
        );
        if (!hasPlayer) return false;
      }
      return true;
    });
  }, [matchHistory, dateFilter, nameFilter]);

  // Sort by endedAt (most recent first)
  const sortedHistory = useMemo(() => {
    return [...filteredHistory].sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
  }, [filteredHistory]);

  // Export to Excel function
  const exportToExcel = () => {
    if (!matchHistory || matchHistory.length === 0) {
      alert('No match history to export.');
      return;
    }

    // Group matches by date
    const matchesByDate = {};
    matchHistory.forEach(match => {
      if (match.endedAt) {
        const date = new Date(match.endedAt);
        const dateKey = date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const dateLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        if (!matchesByDate[dateKey]) {
          matchesByDate[dateKey] = { label: dateLabel, matches: [] };
        }
        matchesByDate[dateKey].matches.push(match);
      }
    });

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Sort dates (most recent first)
    const sortedDates = Object.keys(matchesByDate).sort((a, b) => new Date(b) - new Date(a));

    sortedDates.forEach(dateKey => {
      const { label, matches } = matchesByDate[dateKey];
      
      // Sort matches by endedAt within each date
      const sortedMatches = [...matches].sort((a, b) => (a.endedAt || 0) - (b.endedAt || 0));
      
      // Create data rows
      const data = sortedMatches.map(match => {
        const players = match.players || [];
        const startTime = match.startTime ? new Date(match.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
        const endTime = match.endedAt ? new Date(match.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : '';
        const duration = match.startTime && match.endedAt ? Math.floor((match.endedAt - match.startTime) / 60000) : '';
        
        return {
          'Match #': match.matchNumber || '',
          'Status': match.status === 'completed' ? 'Completed' : 'Deleted',
          'Court': match.courtName || '',
          'Player 1': players[0]?.name || '',
          'Player 2': players[1]?.name || '',
          'Player 3': players[2]?.name || '',
          'Player 4': players[3]?.name || '',
          'Start Time': startTime,
          'End Time': endTime,
          'Duration (min)': duration
        };
      });

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 8 },   // Match #
        { wch: 10 },  // Status
        { wch: 12 },  // Court
        { wch: 20 },  // Player 1
        { wch: 20 },  // Player 2
        { wch: 20 },  // Player 3
        { wch: 20 },  // Player 4
        { wch: 10 },  // Start Time
        { wch: 10 },  // End Time
        { wch: 12 }   // Duration
      ];

      // Create sheet name from date (Excel sheet names have max 31 chars)
      const sheetName = label.replace(/[\/\\?*\[\]]/g, '-').substring(0, 31);
      
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    // Generate filename with current date
    const now = new Date();
    const filename = `Match_History_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.xlsx`;

    // Download
    XLSX.writeFile(workbook, filename);
  };

  // EARLY RETURN - AFTER ALL HOOKS
  if (!isOpen) return null;

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return '—';
    const durationMs = endTime - startTime;
    const minutes = Math.floor(durationMs / 60000);
    return `${minutes}m`;
  };

  // Format name as "FirstName L."
  const formatName = (name) => {
    if (!name) return '—';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1][0]}.`;
    }
    return parts[0];
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear all match history? This cannot be undone.')) {
      clearHistory();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl border w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl ${
        isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
      }`}>
        {/* Header - Compact */}
        <div className={`bg-gradient-to-r from-violet-600/20 to-purple-600/20 border-b px-4 py-3 flex items-center justify-between rounded-t-2xl ${
          isDarkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Match History</h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{matchHistory?.length || 0} matches</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Date Filter and Clear */}
        <div className={`px-4 py-2 border-b flex items-center justify-between ${
          isDarkMode ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Date:</span>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className={`border rounded px-2 py-1 text-xs focus:outline-none ${
                  isDarkMode 
                    ? 'bg-slate-800 border-slate-600 text-white' 
                    : 'bg-white border-slate-300 text-slate-800'
                }`}
              >
                <option value="all">All Dates ({matchHistory?.length || 0})</option>
                {availableDates.map(date => (
                  <option key={date} value={date}>{date}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Player:</span>
              <input
                type="text"
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Search by name..."
                className={`border rounded px-2 py-1 text-xs focus:outline-none w-36 ${
                  isDarkMode 
                    ? 'bg-slate-800 border-slate-600 text-white placeholder-slate-500' 
                    : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                }`}
              />
            </div>
            {(dateFilter !== 'all' || nameFilter) && (
              <span className={`text-xs ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                ({filteredHistory.length} match{filteredHistory.length !== 1 ? 'es' : ''})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {matchHistory && matchHistory.length > 0 && (
              <>
                <button
                  onClick={exportToExcel}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                    isDarkMode 
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400' 
                      : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Excel
                </button>
                <button
                  onClick={handleClearHistory}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    isDarkMode 
                      ? 'bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400' 
                      : 'bg-slate-100 hover:bg-red-100 text-slate-500 hover:text-red-500'
                  }`}
                >
                  Clear History
                </button>
              </>
            )}
          </div>
        </div>

        {/* Match List - Condensed */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {sortedHistory.length === 0 ? (
            <div className={`text-center py-8 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No match history</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedHistory.map((match, index) => (
                <div
                  key={`${match.id}-${index}`}
                  className={`rounded-lg border px-3 py-2 ${
                    match.status === 'completed'
                      ? isDarkMode ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-emerald-50 border-emerald-300'
                      : isDarkMode ? 'bg-red-900/20 border-red-500/30' : 'bg-red-50 border-red-300'
                  }`}
                >
                  {/* Single Row Layout */}
                  <div className="flex items-center gap-3">
                    {/* Match # and Status */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                        isDarkMode 
                          ? 'text-orange-400 bg-orange-500/20' 
                          : 'text-orange-700 bg-orange-100 border border-orange-300'
                      }`}>
                        #{match.matchNumber || '?'}
                      </span>
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                        match.status === 'completed'
                          ? isDarkMode ? 'bg-emerald-500/30 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                          : isDarkMode ? 'bg-red-500/30 text-red-400' : 'bg-red-100 text-red-700'
                      }`}>
                        {match.status === 'completed' ? '✓' : '✕'}
                      </span>
                    </div>
                    
                    {/* Players - Inline */}
                    <div className="flex-1 flex gap-1 min-w-0">
                      {match.players && match.players.length > 0 ? (
                        match.players.map((player, playerIndex) => (
                          <div
                            key={player.id || playerIndex}
                            className={`flex-1 rounded px-2 py-1 text-xs flex items-center justify-between min-w-0 ${
                              player.gender === 'male'
                                ? isDarkMode ? 'bg-blue-900/50 text-blue-200 border border-blue-500/30' : 'bg-blue-100 text-blue-700 border border-blue-300'
                                : isDarkMode ? 'bg-pink-900/50 text-pink-200 border border-pink-500/30' : 'bg-pink-100 text-pink-700 border border-pink-300'
                            }`}
                          >
                            <span className="truncate font-medium">{formatName(player.name)}</span>
                            <span className={`ml-1 font-bold flex-shrink-0 ${
                              player.level === 'Expert' 
                                ? (isDarkMode ? 'text-purple-400' : 'text-purple-700') 
                                : player.level === 'Advanced' 
                                  ? (isDarkMode ? 'text-orange-400' : 'text-orange-700') 
                                  : player.level === 'Intermediate' 
                                    ? (isDarkMode ? 'text-cyan-400' : 'text-cyan-700') 
                                    : (isDarkMode ? 'text-green-400' : 'text-green-700')
                            }`}>
                              {player.level ? player.level[0] : '?'}
                            </span>
                          </div>
                        ))
                      ) : (
                        <span className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>No players</span>
                      )}
                      {/* Empty slots */}
                      {match.players && match.players.length < 4 && (
                        [...Array(4 - match.players.length)].map((_, i) => (
                          <div
                            key={`empty-${i}`}
                            className={`flex-1 rounded px-2 py-1 text-center text-xs border border-dashed ${
                              isDarkMode ? 'bg-slate-800/30 border-slate-700 text-slate-600' : 'bg-slate-50 border-slate-300 text-slate-400'
                            }`}
                          >
                            —
                          </div>
                        ))
                      )}
                    </div>
                    
                    {/* Meta Info */}
                    <div className={`text-right text-xs flex-shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                      {match.status === 'completed' && match.startTime ? (
                        <>
                          <div className={`font-medium ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                            {new Date(match.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="flex items-center gap-1 justify-end">
                            <span>{new Date(match.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                            <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>→</span>
                            <span>{new Date(match.endedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                          </div>
                          <div className={`text-[10px] ${isDarkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                            ({formatDuration(match.startTime, match.endedAt)})
                          </div>
                        </>
                      ) : (
                        <div>{formatDateTime(match.endedAt)}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchHistoryModal;
