import React, { useState, useRef, useEffect } from 'react';
import { showAlert, showConfirm } from '../utils/appAlert';
import { SKILL_LEVELS } from '../data/initialData';
import LevelBadge from './LevelBadge';
import ThemedSelect from './ThemedSelect';
import { exportPlayersToCSV, parsePlayersCSV } from '../utils/csvUtils';

/**
 * Modal for managing the player database
 * Includes add, edit, delete, import/export functionality
 */
const PlayerDatabaseModal = ({ 
  isOpen, 
  onClose, 
  players, 
  onAddPlayer, 
  onEditPlayer, 
  onDeletePlayer, 
  onAddToPool, 
  onRemoveFromPool,
  onRemoveAllFromPool,
  poolPlayers,
  notPresentPlayers = [],
  onImportPlayers,
  isDarkMode = true,
  licenseInfo = null,
  totalPlayerCount = 0,
  fingerprintIds = [],
  fingerprints = {},
  onDeleteFingerprint = () => {},
  onResetAllFingerprints = () => {},
  onRemoveDuplicates = async () => 0
}) => {
  const [newPlayer, setNewPlayer] = useState({ name: '', gender: 'male', level: 'Intermediate' });
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [letterFilter, setLetterFilter] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [newlyAddedPlayerIds, setNewlyAddedPlayerIds] = useState([]);
  const [showAddSection, setShowAddSection] = useState(false);
  
  const playerListRef = useRef(null);
  const searchInputRef = useRef(null);

  // Which players have a fingerprint enrolled.
  const fingerprintSet = new Set(fingerprintIds);
  const hasFingerprint = (id) => fingerprintSet.has(id);
  const isInPool = (playerId) => poolPlayers.some(p => p.id === playerId) || notPresentPlayers.some(p => p.id === playerId);

  // Reset showAddSection and focus search when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowAddSection(false);
      setLetterFilter('');
      setSearchTerm('');
      // Focus search input after a brief delay to ensure modal is rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    } else {
      // Collapse on close too, so the section is already collapsed the next
      // time the window opens (otherwise it renders expanded for one frame
      // before the reset above runs).
      setShowAddSection(false);
    }
  }, [isOpen]);

  // License limits
  const maxPlayers = licenseInfo?.maxPlayers || Infinity;
  const remainingSlots = Math.max(0, maxPlayers - totalPlayerCount);
  const isAtLimit = totalPlayerCount >= maxPlayers;
  const hasHiddenPlayers = totalPlayerCount > maxPlayers;

  // Handle modal close - reset newly added players
  const handleClose = () => {
    setNewlyAddedPlayerIds([]);
    onClose();
  };

  if (!isOpen) return null;

  // Handle sort change
  const handleSort = (field) => {
    if (sortBy === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Sort icon component
  const SortIcon = ({ field }) => {
    if (sortBy !== field) {
      return (
        <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  // Level order for sorting
  const levelOrder = { 'Expert': 0, 'Advanced': 1, 'Intermediate': 2, 'Novice': 3 };

  // Export players to CSV (with id + fingerprint template)
  const handleExportCSV = () => {
    exportPlayersToCSV(players, fingerprints);
  };

  // Import players from CSV
  const handleImportCSV = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImportError('');
    setImportSuccess('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const { players: importedPlayers, fingerprints: importedFingerprints, errors } = parsePlayersCSV(e.target.result);

        if (errors.length > 0 && importedPlayers.length === 0) {
          setImportError(errors[0]);
          return;
        }

        if (importedPlayers.length > 0) {
          // Check license limit
          const availableSlots = maxPlayers - totalPlayerCount;
          let playersToImport = importedPlayers;
          let limitMessage = '';
          
          if (availableSlots <= 0) {
            setImportError(`Cannot import players. Player limit reached (${maxPlayers} players). Please upgrade your license.`);
            return;
          }
          
          if (importedPlayers.length > availableSlots) {
            playersToImport = importedPlayers.slice(0, availableSlots);
            limitMessage = ` (${importedPlayers.length - availableSlots} player(s) were not imported due to license limit of ${maxPlayers})`;
          }
          
          // Only import fingerprints for players that actually got imported.
          const idsToImport = new Set(playersToImport.map(p => p.id));
          const fpToImport = {};
          for (const [id, entry] of Object.entries(importedFingerprints || {})) {
            if (idsToImport.has(Number(id)) || idsToImport.has(id)) {
              fpToImport[id] = entry;
            }
          }

          onImportPlayers(playersToImport, fpToImport);
          const fpCount = Object.keys(fpToImport).length;
          setImportSuccess(`Successfully imported ${playersToImport.length} player(s)${fpCount ? ` and ${fpCount} fingerprint(s)` : ''}${limitMessage}`);
          if (errors.length > 0) {
            setImportError(`${errors.length} row(s) skipped due to errors`);
          }
        } else {
          setImportError('No valid players found in CSV');
        }
      } catch (err) {
        setImportError('Error parsing CSV file: ' + err.message);
      }
    };

    reader.onerror = () => {
      setImportError('Error reading file');
    };

    reader.readAsText(file);
    event.target.value = '';
  };

  const filteredPlayers = [...players]
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesLetter = !letterFilter || p.name.toUpperCase().startsWith(letterFilter);
      return matchesSearch && matchesLetter;
    })
    .sort((a, b) => {
      // Newly added players always appear at the top (in order they were added)
      const aIsNew = newlyAddedPlayerIds.includes(a.id);
      const bIsNew = newlyAddedPlayerIds.includes(b.id);
      
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      if (aIsNew && bIsNew) {
        // Both are new - sort by order added (most recent first)
        return newlyAddedPlayerIds.indexOf(a.id) - newlyAddedPlayerIds.indexOf(b.id);
      }
      
      // Normal sorting for non-new players
      let comparison = 0;
      
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'gender') {
        comparison = a.gender.localeCompare(b.gender);
      } else if (sortBy === 'level') {
        comparison = levelOrder[a.level] - levelOrder[b.level];
      } else if (sortBy === 'status') {
        comparison = (isInPool(b.id) ? 1 : 0) - (isInPool(a.id) ? 1 : 0);
      } else if (sortBy === 'fingerprint') {
        comparison = (hasFingerprint(b.id) ? 1 : 0) - (hasFingerprint(a.id) ? 1 : 0);
      }
      
      // Use ID as tiebreaker for stable sorting
      if (comparison === 0) {
        comparison = a.id - b.id;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Convert string to Title Case
  const toTitleCase = (str) => {
    return str.toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleAddPlayer = () => {
    // Check license limit
    if (isAtLimit) {
      showAlert(`Player limit reached (${maxPlayers} players).\n\nYour license allows a maximum of ${maxPlayers} players. Please upgrade your license to add more players.`);
      return;
    }
    
    if (newPlayer.name.trim()) {
      // Check for duplicate name
      const trimmedName = newPlayer.name.trim().toLowerCase();
      const isDuplicate = players.some(p => p.name.toLowerCase() === trimmedName);
      if (isDuplicate) {
        showAlert(`A player named "${newPlayer.name.trim()}" already exists in the database.\n\nPlease use a unique name.`);
        return;
      }
      
      const newId = Date.now();
      const titleCaseName = toTitleCase(newPlayer.name.trim());
      onAddPlayer({ ...newPlayer, id: newId, name: titleCaseName });
      setNewlyAddedPlayerIds(prev => [newId, ...prev]);
      setNewPlayer({ name: '', gender: 'male', level: 'Intermediate' });
      setSearchTerm(''); // Clear search bar after adding
      setLetterFilter(''); // Reset letter filter to "All"
      // Scroll to top of player list after a brief delay to allow state update
      setTimeout(() => {
        if (playerListRef.current) {
          playerListRef.current.scrollTop = 0;
        }
      }, 50);
    }
  };

  const handleSaveEdit = () => {
    if (editingPlayer && editingPlayer.name.trim()) {
      // Check for duplicate name (excluding the current player)
      const trimmedName = editingPlayer.name.trim().toLowerCase();
      const isDuplicate = players.some(p => p.id !== editingPlayer.id && p.name.toLowerCase() === trimmedName);
      if (isDuplicate) {
        showAlert(`A player named "${editingPlayer.name.trim()}" already exists in the database.\n\nPlease use a unique name.`);
        return;
      }
      
      onEditPlayer(editingPlayer);
      setEditingPlayer(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={handleClose}>
      <div onClick={(e) => e.stopPropagation()} className={`neon-panel rounded-2xl w-[92vw] max-w-[1000px] h-[calc(100vh-2rem)] flex flex-col overflow-hidden shadow-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-300'}`}>
        {/* Header */}
        <div className={`px-4 py-2.5 flex justify-between items-center flex-shrink-0 border-b ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <h2 className={`text-lg font-bold tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Player Database</h2>
            {/* Player Count / License Limit */}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isAtLimit 
                ? 'bg-red-500/30 text-red-200' 
                : remainingSlots <= 10 
                  ? 'bg-amber-500/30 text-amber-200' 
                  : (isDarkMode ? 'bg-white/20 text-white/80' : 'bg-slate-200 text-slate-600')
            }`}>
              {players.length}/{maxPlayers === Infinity ? '∞' : maxPlayers} players
              {remainingSlots <= 20 && maxPlayers !== Infinity && (
                <span className="ml-1">({remainingSlots} left)</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Remove All from Pool Button */}
            {(poolPlayers.length > 0 || notPresentPlayers.length > 0) && (
              <button
                onClick={async () => {
                  const totalCount = poolPlayers.length + notPresentPlayers.length;
                  if (await showConfirm(`Remove all ${totalCount} players from the pool?`)) {
                    onRemoveAllFromPool();
                  }
                }}
                className={`px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1.5 text-xs ${isDarkMode ? 'bg-red-500/30 hover:bg-red-500/50 text-white' : 'bg-red-100 hover:bg-red-200 text-red-700'}`}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Pool ({poolPlayers.length + notPresentPlayers.length})
              </button>
            )}
            {/* Remove Duplicate Players (repair) */}
            <button
              onClick={async () => {
                if (await showConfirm('Clean up duplicate players by name (across the cloud and this device) and rewrite the cloud to match?')) {
                  const removed = await onRemoveDuplicates();
                  showAlert(removed > 0 ? `Cleaned up ${removed} duplicate entr(ies).` : 'No duplicates found.');
                }
              }}
              className={`px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1.5 text-xs border ${isDarkMode ? 'bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 border-amber-500/30' : 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-400'}`}
              title="De-duplicate players by name and fix the cloud copy"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Remove Duplicates
            </button>
            {/* Export Button */}
            <button
              onClick={handleExportCSV}
              className={`px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1.5 text-xs ${isDarkMode ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700'}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            {/* Import Button */}
            <label className={`px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1.5 text-xs ${
              isAtLimit 
                ? (isDarkMode ? 'bg-slate-500/30 text-slate-400 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed') 
                : (isDarkMode ? 'bg-white/20 hover:bg-white/30 text-white cursor-pointer' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 cursor-pointer')
            }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import
              <input
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
                disabled={isAtLimit}
              />
            </label>
            <button onClick={handleClose} className={`text-2xl font-light transition-colors ml-1 ${isDarkMode ? 'text-white/80 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>&times;</button>
          </div>
        </div>
        
        {/* Hidden Players Warning */}
        {hasHiddenPlayers && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className={`text-sm ${isDarkMode ? 'text-amber-300' : 'text-amber-700'}`}>
              {totalPlayerCount - maxPlayers} player(s) are hidden due to your license limit of {maxPlayers} players. Upgrade your license to view all players.
            </span>
          </div>
        )}
        
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar player-db-scroll flex flex-col min-h-0">
          {/* Import/Export Status Messages */}
          {(importError || importSuccess) && (
            <div className="mb-4 flex gap-3">
              {importSuccess && (
                <div className="flex-1 bg-green-500/20 border border-green-500/30 text-green-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {importSuccess}
                </div>
              )}
              {importError && (
                <div className="flex-1 bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {importError}
                </div>
              )}
              <button
                onClick={() => { setImportError(''); setImportSuccess(''); }}
                className={isDarkMode ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Add New Player Section - Collapsible */}
          <div className="mb-4">
            <button
              onClick={() => setShowAddSection(!showAddSection)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                showAddSection
                  ? (isDarkMode ? 'bg-slate-800/60 border-slate-600' : 'bg-slate-100 border-slate-300')
                  : (isDarkMode ? 'bg-slate-800/50 border-slate-600/50 hover:border-cyan-600/50' : 'bg-slate-50 border-slate-300 hover:border-cyan-400')
              }`}
            >
              <span className={`text-sm font-semibold ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'}`}>+ Add New Player</span>
              <svg 
                className={`w-4 h-4 transition-transform ${isDarkMode ? 'text-cyan-400' : 'text-cyan-700'} ${showAddSection ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showAddSection && (
              <div className={`rounded-b-lg p-3 border border-t-0 -mt-1 ${isDarkMode ? 'bg-slate-800/60 border-slate-600' : 'bg-slate-100 border-slate-300'}`}>
                <div className="flex gap-2 items-center">
                  <ThemedSelect
                      className="w-28 flex-none"
                      value={newPlayer.gender}
                      onChange={(e) => setNewPlayer({ ...newPlayer, gender: e.target.value })}
                              isDarkMode={isDarkMode}
                            >
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                            </ThemedSelect>
                  <ThemedSelect
                      className="w-36 flex-none"
                      value={newPlayer.level}
                      onChange={(e) => setNewPlayer({ ...newPlayer, level: e.target.value })}
                              isDarkMode={isDarkMode}
                            >
                      {SKILL_LEVELS.map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                            </ThemedSelect>
                  <input
                    type="text"
                    value={newPlayer.name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                    placeholder="Player name..."
                    className={`flex-1 border rounded px-3 py-1.5 text-sm focus:border-cyan-500 focus:outline-none transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'}`}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPlayer()}
                  />
                  <button
                    onClick={handleAddPlayer}
                    disabled={isAtLimit}
                    className={`font-semibold px-4 py-1.5 rounded text-sm transition-all shadow-lg ${
                      isAtLimit 
                        ? (isDarkMode ? 'bg-slate-600 text-slate-400 cursor-not-allowed shadow-none' : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none') 
                        : 'bg-cyan-700 hover:bg-cyan-600 text-white'
                    }`}
                    title={isAtLimit ? `Player limit reached (${maxPlayers})` : 'Add player'}
                  >
                    + Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search + A-Z filter on one row */}
          <div className="mb-4 flex items-center gap-3">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setLetterFilter(''); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && filteredPlayers.length === 1) {
                  const player = filteredPlayers[0];
                  if (!isInPool(player.id)) {
                    onAddToPool(player);
                    setNewlyAddedPlayerIds(prev => prev.filter(id => id !== player.id));
                    setSearchTerm('');
                  }
                }
              }}
              placeholder="Search players..."
              className={`w-56 flex-none border rounded px-3 py-1.5 text-sm focus:border-cyan-500 focus:outline-none transition-colors ${isDarkMode ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'}`}
            />
            <div className="flex gap-0.5 flex-nowrap flex-1 min-w-0 items-center">
              <button
                onClick={() => setLetterFilter('')}
                className={`flex-none px-2 py-1 text-xs font-medium rounded transition-colors ${
                  letterFilter === '' 
                    ? 'bg-cyan-500 text-white' 
                    : (isDarkMode ? 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900')
                }`}
              >
                All
              </button>
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => (
                <button
                  key={letter}
                  onClick={() => { 
                    if (letterFilter === letter) {
                      setLetterFilter('');
                    } else {
                      setLetterFilter(letter); 
                      setSearchTerm(''); 
                    }
                  }}
                  className={`flex-1 min-w-0 px-0 py-1 text-xs font-medium rounded transition-colors ${
                    letterFilter === letter 
                      ? 'bg-cyan-500 text-white' 
                      : (isDarkMode ? 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900')
                  }`}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>

          {/* Player List */}
          <div ref={playerListRef} className="flex-1 overflow-y-auto custom-scrollbar player-db-scroll min-h-0">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
                <col className="w-[17%]" />
                <col className="w-[13%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr className={`text-left text-[0.95rem] ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <th className={`py-2 px-2 align-middle ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <button 
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1.5 font-semibold hover:text-cyan-400 transition-colors"
                    >
                      <svg className="w-4 h-4 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      Name <SortIcon field="name" />
                    </button>
                  </th>
                  <th className={`py-2 px-2 align-middle ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <button 
                      onClick={() => handleSort('gender')}
                      className="flex items-center gap-1.5 font-semibold hover:text-cyan-400 transition-colors"
                    >
                      <svg className="w-4 h-4 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 13a4 4 0 100-8 4 4 0 000 8zm0 0v7m-3-3h6" /></svg>
                      Gender <SortIcon field="gender" />
                    </button>
                  </th>
                  <th className={`py-2 px-2 align-middle ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <button 
                      onClick={() => handleSort('level')}
                      className="flex items-center gap-1.5 font-semibold hover:text-cyan-400 transition-colors"
                    >
                      <svg className="w-4 h-4 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                      Level <SortIcon field="level" />
                    </button>
                  </th>
                  <th className={`py-2 px-2 align-middle ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <button 
                      onClick={() => handleSort('fingerprint')}
                      className="flex items-center gap-1.5 font-semibold hover:text-cyan-400 transition-colors"
                    >
                      <svg className="w-4 h-4 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M5 20.663A21.9 21.9 0 004 11a8 8 0 011.929-5.207" /></svg>
                      Fingerprint <SortIcon field="fingerprint" />
                    </button>
                  </th>
                  <th className={`py-2 px-2 align-middle ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <button 
                      onClick={() => handleSort('status')}
                      className="flex items-center gap-1.5 font-semibold hover:text-cyan-400 transition-colors"
                    >
                      <svg className="w-4 h-4 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Status <SortIcon field="status" />
                    </button>
                  </th>
                  <th className={`py-2 px-2 align-middle ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <span className="flex items-center justify-end gap-1.5 font-semibold">
                      <svg className="w-4 h-4 flex-shrink-0 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>
                      Actions
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map(player => {
                  const isNewlyAdded = newlyAddedPlayerIds.includes(player.id);
                  return (
                  <tr 
                    key={player.id} 
                    className={`border-t transition-colors ${isDarkMode ? 'border-slate-700/50' : 'border-slate-200'} ${
                      isNewlyAdded 
                        ? 'bg-yellow-500/20 hover:bg-yellow-500/30' 
                        : (isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')
                    }`}
                  >
                    {editingPlayer?.id === player.id ? (
                      <>
                        <td className="h-[46px] align-middle py-1 pl-4 pr-2">
                          <input
                            type="text"
                            value={editingPlayer.name}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                            className={`w-full min-w-0 max-w-full h-7 rounded-lg border px-2.5 py-0 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 transition-colors ${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-100' : 'bg-white border-slate-300 text-slate-800'}`}
                          />
                        </td>
                        <td className="h-[46px] align-middle py-1 pl-4 pr-2">
                          <ThemedSelect
                            compact
                              value={editingPlayer.gender}
                              onChange={(e) => setEditingPlayer({ ...editingPlayer, gender: e.target.value })}
                              isDarkMode={isDarkMode}
                            >
                              <option value="male">Male</option>
                              <option value="female">Female</option>
                            </ThemedSelect>
                        </td>
                        <td className="h-[46px] align-middle py-1 pl-4 pr-2">
                          <ThemedSelect
                            compact
                              value={editingPlayer.level}
                              onChange={(e) => setEditingPlayer({ ...editingPlayer, level: e.target.value })}
                              isDarkMode={isDarkMode}
                            >
                              {SKILL_LEVELS.map(level => (
                                <option key={level} value={level}>{level}</option>
                              ))}
                            </ThemedSelect>
                        </td>
                        <td className="h-[46px] align-middle py-1 pl-8 pr-2">
                          <span
                            className={'inline-flex items-center align-middle ' + (hasFingerprint(player.id)
                              ? (isDarkMode ? 'text-green-400' : 'text-green-600')
                              : (isDarkMode ? 'text-slate-600' : 'text-slate-300'))}
                            title={hasFingerprint(player.id) ? 'Fingerprint enrolled' : 'No fingerprint enrolled'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3" /><path d="M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6" /><path d="M12 11v2a14 14 0 0 0 2.5 8" /><path d="M8 15a18 18 0 0 0 1.8 6" /><path d="M4.9 19a22 22 0 0 1 -.9 -7v-1a8 8 0 0 1 12 -6.95" /></svg>
                          </span>
                        </td>
                        <td className="h-[46px] align-middle py-1 pl-4 pr-2">
                          <span className={`db-pill text-xs px-2 py-1 rounded-full whitespace-nowrap ${isInPool(player.id) ? (isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800 border border-green-400') : (isDarkMode ? 'bg-slate-600/50 text-slate-400' : 'bg-slate-200 text-slate-700 border border-slate-400')}`}>
                            {isInPool(player.id) ? 'In Pool' : 'Not In Pool'}
                          </span>
                        </td>
                        <td className="h-[46px] align-middle py-1 pl-4 pr-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={handleSaveEdit}
                              title="Save changes"
                              className={`db-action-btn w-7 h-7 flex items-center justify-center rounded-md transition-colors flex-shrink-0 ${isDarkMode ? 'bg-green-500/20 hover:bg-green-500/35 text-green-300' : 'bg-green-100 hover:bg-green-200 text-green-800 border border-green-400'}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setEditingPlayer(null)}
                              title="Cancel"
                              className={`db-action-btn w-7 h-7 flex items-center justify-center rounded-md transition-colors flex-shrink-0 ${isDarkMode ? 'bg-slate-600/40 hover:bg-slate-600/60 text-slate-300' : 'bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-400'}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="h-[46px] align-middle py-1 pl-4 pr-2 truncate">
                          <span className={`font-normal text-[0.9rem] ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>{player.name}</span>
                        </td>
                        <td className="h-[46px] align-middle py-1 pl-4 pr-2">
                          <span className={`capitalize text-[0.9rem] ${player.gender === 'male' ? (isDarkMode ? 'text-blue-300' : 'text-blue-700') : (isDarkMode ? 'text-pink-300' : 'text-pink-700')}`}>
                            {player.gender === 'male' ? '♂' : '♀'} {player.gender}
                          </span>
                        </td>
                        <td className="h-[46px] align-middle py-1 pl-4 pr-2">
                          <LevelBadge level={player.level} isDarkMode={isDarkMode} />
                        </td>
                        <td className="h-[46px] align-middle py-1 pl-8 pr-2">
                          {hasFingerprint(player.id) ? (
                            <span className="inline-flex items-center gap-1.5 align-middle">
                              <span className={`inline-flex items-center align-middle ${isDarkMode ? 'text-green-400' : 'text-green-600'}`} title="Fingerprint enrolled">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3" /><path d="M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6" /><path d="M12 11v2a14 14 0 0 0 2.5 8" /><path d="M8 15a18 18 0 0 0 1.8 6" /><path d="M4.9 19a22 22 0 0 1 -.9 -7v-1a8 8 0 0 1 12 -6.95" /></svg>
                              </span>
                              <button
                                onClick={async () => {
                                  if (await showConfirm(`Delete ${player.name}'s fingerprint from the database?`)) {
                                    onDeleteFingerprint(player.id);
                                  }
                                }}
                                className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full transition-colors ${isDarkMode ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10' : 'text-red-600 hover:text-red-700 hover:bg-red-100'}`}
                                title="Delete this fingerprint"
                              >
                                ✕
                              </button>
                            </span>
                          ) : (
                            <span className={`inline-flex items-center align-middle ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} title="No fingerprint enrolled">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M18.9 7a8 8 0 0 1 1.1 5v1a6 6 0 0 0 .8 3" /><path d="M8 11a4 4 0 0 1 8 0v1a10 10 0 0 0 2 6" /><path d="M12 11v2a14 14 0 0 0 2.5 8" /><path d="M8 15a18 18 0 0 0 1.8 6" /><path d="M4.9 19a22 22 0 0 1 -.9 -7v-1a8 8 0 0 1 12 -6.95" /></svg>
                            </span>
                          )}
                        </td>
                        <td className="h-[46px] align-middle py-1 pl-4 pr-2">
                          <span className={`db-pill text-xs px-2 py-1 rounded-full whitespace-nowrap ${isInPool(player.id) ? (isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800 border border-green-400') : (isDarkMode ? 'bg-slate-600/50 text-slate-400' : 'bg-slate-200 text-slate-700 border border-slate-400')}`}>
                            {isInPool(player.id) ? 'In Pool' : 'Not In Pool'}
                          </span>
                        </td>
                        <td className="h-[46px] align-middle py-1 pl-4 pr-2">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isInPool(player.id) ? (
                              <button
                                onClick={() => { 
                                  onAddToPool(player); 
                                  setNewlyAddedPlayerIds(prev => prev.filter(id => id !== player.id));
                                  setSearchTerm(''); 
                                  setLetterFilter('');
                                  searchInputRef.current?.focus(); 
                                }}
                                title="Add to pool"
                                className={`db-action-btn w-7 h-7 flex items-center justify-center rounded-md transition-colors flex-shrink-0 ${isDarkMode ? 'bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300' : 'bg-cyan-100 hover:bg-cyan-200 text-cyan-800 border border-cyan-400'}`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                              </button>
                            ) : (
                              <button
                                onClick={() => { onRemoveFromPool(player.id); setSearchTerm(''); setLetterFilter(''); searchInputRef.current?.focus(); }}
                                title="Remove from pool"
                                className={`db-action-btn w-7 h-7 flex items-center justify-center rounded-md transition-colors flex-shrink-0 ${isDarkMode ? 'bg-orange-500/25 hover:bg-orange-500/40 text-orange-300' : 'bg-orange-100 hover:bg-orange-200 text-orange-800 border border-orange-400'}`}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => setEditingPlayer({ ...player })}
                              title="Edit player"
                              className={`db-action-btn w-7 h-7 flex items-center justify-center rounded-md transition-colors flex-shrink-0 ${isDarkMode ? 'bg-yellow-500/20 hover:bg-yellow-500/35 text-yellow-300' : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800 border border-yellow-400'}`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={async () => {
                                const extra = hasFingerprint(player.id)
                                  ? ' Their stored fingerprint will also be deleted.'
                                  : '';
                                if (await showConfirm(`Delete ${player.name} from the player database?${extra} This cannot be undone.`)) {
                                  onDeletePlayer(player.id);
                                }
                              }}
                              title="Delete player"
                              className={`db-action-btn w-7 h-7 flex items-center justify-center rounded-md transition-colors flex-shrink-0 ${isDarkMode ? 'bg-red-500/20 hover:bg-red-500/35 text-red-300' : 'bg-red-100 hover:bg-red-200 text-red-700 border border-red-400'}`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPlayers.length === 0 && (
              <div className={`text-center py-8 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>No players found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerDatabaseModal;
