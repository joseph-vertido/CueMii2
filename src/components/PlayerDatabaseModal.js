import React, { useState, useRef, useEffect } from 'react';
import { SKILL_LEVELS, LEVEL_COLORS } from '../data/initialData';
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
  totalPlayerCount = 0
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

  // Reset showAddSection and focus search when modal opens
  useEffect(() => {
    if (isOpen) {
      setShowAddSection(false);
      // Focus search input after a brief delay to ensure modal is rendered
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
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

  // Export players to CSV
  const handleExportCSV = () => {
    exportPlayersToCSV(players);
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
        const { players: importedPlayers, errors } = parsePlayersCSV(e.target.result);

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
          
          onImportPlayers(playersToImport);
          setImportSuccess(`Successfully imported ${playersToImport.length} player(s)${limitMessage}`);
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
      alert(`Player limit reached (${maxPlayers} players).\n\nYour license allows a maximum of ${maxPlayers} players. Please upgrade your license to add more players.`);
      return;
    }
    
    if (newPlayer.name.trim()) {
      // Check for duplicate name
      const trimmedName = newPlayer.name.trim().toLowerCase();
      const isDuplicate = players.some(p => p.name.toLowerCase() === trimmedName);
      if (isDuplicate) {
        alert(`A player named "${newPlayer.name.trim()}" already exists in the database.\n\nPlease use a unique name.`);
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
        alert(`A player named "${editingPlayer.name.trim()}" already exists in the database.\n\nPlease use a unique name.`);
        return;
      }
      
      onEditPlayer(editingPlayer);
      setEditingPlayer(null);
    }
  };

  const isInPool = (playerId) => poolPlayers.some(p => p.id === playerId) || notPresentPlayers.some(p => p.id === playerId);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl w-[800px] h-[calc(100vh-2rem)] flex flex-col overflow-hidden shadow-2xl border border-cyan-500/20">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white tracking-wide">Player Database</h2>
            {/* Player Count / License Limit */}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              isAtLimit 
                ? 'bg-red-500/30 text-red-200' 
                : remainingSlots <= 10 
                  ? 'bg-amber-500/30 text-amber-200' 
                  : 'bg-white/20 text-white/80'
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
                onClick={() => {
                  const totalCount = poolPlayers.length + notPresentPlayers.length;
                  if (window.confirm(`Remove all ${totalCount} players from the pool?`)) {
                    onRemoveAllFromPool();
                  }
                }}
                className="bg-red-500/30 hover:bg-red-500/50 text-white px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1.5 text-xs"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Pool ({poolPlayers.length + notPresentPlayers.length})
              </button>
            )}
            {/* Export Button */}
            <button
              onClick={handleExportCSV}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1.5 text-xs"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export
            </button>
            {/* Import Button */}
            <label className={`px-3 py-1.5 rounded font-medium transition-all flex items-center gap-1.5 text-xs ${
              isAtLimit 
                ? 'bg-slate-500/30 text-slate-400 cursor-not-allowed' 
                : 'bg-white/20 hover:bg-white/30 text-white cursor-pointer'
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
            <button onClick={handleClose} className="text-white/80 hover:text-white text-2xl font-light transition-colors ml-1">&times;</button>
          </div>
        </div>
        
        {/* Hidden Players Warning */}
        {hasHiddenPlayers && (
          <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center gap-2">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="text-amber-300 text-sm">
              {totalPlayerCount - maxPlayers} player(s) are hidden due to your license limit of {maxPlayers} players. Upgrade your license to view all players.
            </span>
          </div>
        )}
        
        <div className="p-6 flex-1 overflow-y-auto flex flex-col min-h-0">
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
                className="text-slate-400 hover:text-slate-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* CSV Format Help */}
          <div className="mb-4 bg-slate-800/30 border border-slate-700/50 rounded-lg px-4 py-3">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-cyan-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm">
                <p className="text-slate-300 font-medium">CSV Format</p>
                <p className="text-slate-500 mt-1">
                  Required column: <span className="text-cyan-400">name</span> | 
                  Optional: <span className="text-cyan-400">gender</span> (male/female), 
                  <span className="text-cyan-400"> level</span> (Expert/Advanced/Intermediate/Novice)
                </p>
                <p className="text-slate-600 mt-1 text-xs">Example: name,gender,level</p>
              </div>
            </div>
          </div>

          {/* Add New Player Section - Collapsible */}
          <div className="mb-4">
            <button
              onClick={() => setShowAddSection(!showAddSection)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border transition-colors ${
                showAddSection
                  ? 'bg-gradient-to-r from-cyan-900/30 to-teal-900/30 border-cyan-700/50'
                  : 'bg-slate-800/50 border-slate-600/50 hover:border-cyan-600/50'
              }`}
            >
              <span className="text-cyan-400 text-sm font-semibold">+ Add New Player</span>
              <svg 
                className={`w-4 h-4 text-cyan-400 transition-transform ${showAddSection ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showAddSection && (
              <div className="bg-gradient-to-r from-cyan-900/30 to-teal-900/30 rounded-b-lg p-3 border border-t-0 border-cyan-700/50 -mt-1">
                <div className="flex gap-2 items-center">
                  <select
                    value={newPlayer.gender}
                    onChange={(e) => setNewPlayer({ ...newPlayer, gender: e.target.value })}
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none transition-colors"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                  <select
                    value={newPlayer.level}
                    onChange={(e) => setNewPlayer({ ...newPlayer, level: e.target.value })}
                    className="bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none transition-colors"
                  >
                    {SKILL_LEVELS.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newPlayer.name}
                    onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
                    placeholder="Player name..."
                    className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddPlayer()}
                  />
                  <button
                    onClick={handleAddPlayer}
                    disabled={isAtLimit}
                    className={`font-semibold px-4 py-1.5 rounded text-sm transition-all shadow-lg ${
                      isAtLimit 
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed shadow-none' 
                        : 'bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-white shadow-cyan-500/25'
                    }`}
                    title={isAtLimit ? `Player limit reached (${maxPlayers})` : 'Add player'}
                  >
                    + Add
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="mb-2 flex items-center gap-3">
            <label className="text-cyan-400 text-sm font-bold whitespace-nowrap">Search</label>
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
              className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none transition-colors"
            />
          </div>

          {/* A-Z Letter Filter */}
          <div className="mb-4 flex gap-0.5">
            <button
              onClick={() => setLetterFilter('')}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                letterFilter === '' 
                  ? 'bg-cyan-500 text-white' 
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
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
                className={`w-6 py-1 text-xs font-medium rounded transition-colors ${
                  letterFilter === letter 
                    ? 'bg-cyan-500 text-white' 
                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'
                }`}
              >
                {letter}
              </button>
            ))}
          </div>

          {/* Player List */}
          <div ref={playerListRef} className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
            <table className="w-full table-fixed">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[12%]" />
                <col className="w-[15%]" />
                <col className="w-[13%]" />
                <col className="w-[30%]" />
              </colgroup>
              <thead className="sticky top-0 bg-slate-800">
                <tr className="text-left text-slate-400 text-sm uppercase tracking-wider">
                  <th className="py-3 px-2 align-middle">
                    <button 
                      onClick={() => handleSort('name')}
                      className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                    >
                      Name <SortIcon field="name" />
                    </button>
                  </th>
                  <th className="py-3 px-2 align-middle">
                    <button 
                      onClick={() => handleSort('gender')}
                      className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                    >
                      Gender <SortIcon field="gender" />
                    </button>
                  </th>
                  <th className="py-3 px-2 align-middle">
                    <button 
                      onClick={() => handleSort('level')}
                      className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
                    >
                      Level <SortIcon field="level" />
                    </button>
                  </th>
                  <th className="py-3 px-2 align-middle">Status</th>
                  <th className="py-3 px-2 align-middle text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map(player => {
                  const isNewlyAdded = newlyAddedPlayerIds.includes(player.id);
                  return (
                  <tr 
                    key={player.id} 
                    className={`border-t border-slate-700/50 transition-colors ${
                      isNewlyAdded 
                        ? 'bg-yellow-500/20 hover:bg-yellow-500/30' 
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    {editingPlayer?.id === player.id ? (
                      <>
                        <td className="py-3 px-2">
                          <input
                            type="text"
                            value={editingPlayer.name}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, name: e.target.value })}
                            className="bg-slate-900 border border-cyan-500 rounded px-2 py-1 text-white w-full max-w-full"
                          />
                        </td>
                        <td className="py-3 px-2">
                          <select
                            value={editingPlayer.gender}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, gender: e.target.value })}
                            className="bg-slate-900 border border-cyan-500 rounded px-2 py-1 text-white w-full"
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        </td>
                        <td className="py-3 px-2">
                          <select
                            value={editingPlayer.level}
                            onChange={(e) => setEditingPlayer({ ...editingPlayer, level: e.target.value })}
                            className="bg-slate-900 border border-cyan-500 rounded px-2 py-1 text-white w-full"
                          >
                            {SKILL_LEVELS.map(level => (
                              <option key={level} value={level}>{level}</option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${isInPool(player.id) ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'}`}>
                            {isInPool(player.id) ? 'In Pool' : 'Not in Pool'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right whitespace-nowrap">
                          <button onClick={handleSaveEdit} className="text-green-400 hover:text-green-300 mr-2">Save</button>
                          <button onClick={() => setEditingPlayer(null)} className="text-slate-400 hover:text-slate-300">Cancel</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 px-2 truncate">
                          <span className={`font-medium ${player.gender === 'male' ? 'text-blue-300' : 'text-pink-300'}`}>{player.name}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`${player.gender === 'male' ? 'text-blue-300' : 'text-pink-300'}`}>
                            {player.gender === 'male' ? '♂' : '♀'} {player.gender}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium border ${LEVEL_COLORS[player.level]}`}>
                            {player.level}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-xs px-2 py-1 rounded-full ${isInPool(player.id) ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'}`}>
                            {isInPool(player.id) ? 'In Pool' : 'Not in Pool'}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right space-x-2">
                          {!isInPool(player.id) ? (
                            <button
                              onClick={() => { 
                                onAddToPool(player); 
                                setNewlyAddedPlayerIds(prev => prev.filter(id => id !== player.id));
                                setSearchTerm(''); 
                                searchInputRef.current?.focus(); 
                              }}
                              className="bg-cyan-500/20 hover:bg-cyan-500/40 text-cyan-400 hover:text-cyan-300 text-xs font-medium px-3 py-1.5 rounded-lg border border-cyan-500/30 transition-all"
                            >
                              + Add to Pool
                            </button>
                          ) : (
                            <button
                              onClick={() => { onRemoveFromPool(player.id); setSearchTerm(''); searchInputRef.current?.focus(); }}
                              className="bg-orange-500/20 hover:bg-orange-500/40 text-orange-400 hover:text-orange-300 text-xs font-medium px-3 py-1.5 rounded-lg border border-orange-500/30 transition-all"
                            >
                              − Remove
                            </button>
                          )}
                          <button
                            onClick={() => setEditingPlayer({ ...player })}
                            className="text-yellow-400 hover:text-yellow-300 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDeletePlayer(player.id)}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredPlayers.length === 0 && (
              <div className="text-center py-8 text-slate-500">No players found</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerDatabaseModal;
