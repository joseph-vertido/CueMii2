import React, { useState, useMemo, useRef, useEffect } from 'react';

/**
 * Reports Modal - Shows comprehensive match and player statistics
 */
const ReportsModal = ({ 
  isOpen, 
  onClose, 
  matchHistory = [],
  players = [],
  onClearReports,
  isDarkMode = true 
}) => {
  const [activeTab, setActiveTab] = useState('overall');
  const [selectedDate, setSelectedDate] = useState('all');
  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [playerSearchTerm, setPlayerSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [sortColumn, setSortColumn] = useState('checkInTime');
  const [sortDirection, setSortDirection] = useState('asc');
  
  const overallReportRef = useRef(null);
  const individualReportRef = useRef(null);

  // Auto-select today's date if data exists when modal opens
  useEffect(() => {
    if (isOpen) {
      const today = new Date().toLocaleDateString('en-CA');
      const hasTodayData = matchHistory.some(match => {
        if (!match.endedAt) return false;
        return new Date(match.endedAt).toLocaleDateString('en-CA') === today;
      });
      setSelectedDate(hasTodayData ? today : 'all');
    }
  }, [isOpen, matchHistory]);

  // Level color helper
  const getLevelColor = (level) => {
    const colors = {
      'Expert': isDarkMode ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-300',
      'Advanced': isDarkMode ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-orange-100 text-orange-700 border-orange-300',
      'Intermediate': isDarkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-300',
      'Novice': isDarkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-100 text-green-700 border-green-300'
    };
    return colors[level] || (isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700');
  };

  // Gender color helper for labels
  const formatGenderCombo = (combo) => {
    const match = combo.match(/(\d+)M\/(\d+)F/);
    if (!match) return combo;
    const [, males, females] = match;
    return (
      <span>
        <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>{males}M</span>
        <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>/</span>
        <span className={isDarkMode ? 'text-pink-400' : 'text-pink-600'}>{females}F</span>
      </span>
    );
  };

  // Get unique dates from match history
  const uniqueDates = useMemo(() => {
    const dates = new Set();
    matchHistory.forEach(match => {
      if (match.endedAt) {
        const date = new Date(match.endedAt).toLocaleDateString('en-CA');
        dates.add(date);
      }
    });
    return Array.from(dates).sort().reverse();
  }, [matchHistory]);

  // Filter matches by selected date
  const filteredMatches = useMemo(() => {
    if (selectedDate === 'all') return matchHistory;
    return matchHistory.filter(match => {
      if (!match.endedAt) return false;
      const matchDate = new Date(match.endedAt).toLocaleDateString('en-CA');
      return matchDate === selectedDate;
    });
  }, [matchHistory, selectedDate]);

  // ==================== OVERALL REPORTS ====================

  // Gender combinations count
  const genderCombinations = useMemo(() => {
    const combos = {};
    filteredMatches.forEach(match => {
      if (match.players && match.players.length === 4) {
        const males = match.players.filter(p => p.gender === 'male').length;
        const females = match.players.filter(p => p.gender === 'female').length;
        const key = `${males}M/${females}F`;
        combos[key] = (combos[key] || 0) + 1;
      }
    });
    return Object.entries(combos)
      .sort((a, b) => b[1] - a[1])
      .map(([combo, count]) => ({ combo, count }));
  }, [filteredMatches]);

  // Level combinations count
  const levelCombinations = useMemo(() => {
    const combos = {};
    filteredMatches.forEach(match => {
      if (match.players && match.players.length === 4) {
        const levels = match.players.map(p => p.level).sort();
        const key = levels.join(' / ');
        combos[key] = (combos[key] || 0) + 1;
      }
    });
    return Object.entries(combos)
      .sort((a, b) => b[1] - a[1])
      .map(([combo, count]) => ({ combo, count }));
  }, [filteredMatches]);

  // Overall average wait time and wait time distribution
  const waitTimeStats = useMemo(() => {
    const waitTimes = [];
    const distribution = { under20: 0, between20and30: 0, between30and40: 0, over40: 0 };
    
    filteredMatches.forEach(match => {
      if (!match.players || !match.startTime) return;
      match.players.forEach(p => {
        if (p.joinedAt && match.startTime) {
          const waitTime = Math.round((match.startTime - p.joinedAt) / 60000);
          if (waitTime > 0 && waitTime < 180) {
            waitTimes.push(waitTime);
            if (waitTime < 20) {
              distribution.under20++;
            } else if (waitTime < 30) {
              distribution.between20and30++;
            } else if (waitTime < 40) {
              distribution.between30and40++;
            } else {
              distribution.over40++;
            }
          }
        }
      });
    });
    
    const avgWaitTime = waitTimes.length > 0 
      ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) 
      : 0;
    
    return { avgWaitTime, distribution, totalWaits: waitTimes.length };
  }, [filteredMatches]);

  // Court timer duration stats (how long matches lasted on court)
  const courtDurationStats = useMemo(() => {
    const distribution = { under20: 0, between20and30: 0, between30and40: 0, over40: 0 };
    let totalDuration = 0;
    let matchCount = 0;
    
    filteredMatches.forEach(match => {
      if (match.startTime && match.endedAt) {
        const duration = Math.round((match.endedAt - match.startTime) / 60000);
        if (duration >= 0 && duration < 180) {
          matchCount++;
          totalDuration += duration;
          if (duration < 20) {
            distribution.under20++;
          } else if (duration < 30) {
            distribution.between20and30++;
          } else if (duration < 40) {
            distribution.between30and40++;
          } else {
            distribution.over40++;
          }
        }
      }
    });
    
    const avgDuration = matchCount > 0 ? Math.round(totalDuration / matchCount) : 0;
    
    return { avgDuration, distribution, matchCount };
  }, [filteredMatches]);

  // Per date statistics (always show, filter by date if selected)
  const dateStats = useMemo(() => {
    const targetMatches = filteredMatches;
    const stats = {};
    targetMatches.forEach(match => {
      if (!match.endedAt || !match.players) return;
      const date = new Date(match.endedAt).toLocaleDateString('en-CA');
      if (!stats[date]) {
        stats[date] = { totalGames: 0, playerGames: {} };
      }
      stats[date].totalGames++;
      match.players.forEach(p => {
        stats[date].playerGames[p.id] = (stats[date].playerGames[p.id] || 0) + 1;
      });
    });
    
    return Object.entries(stats)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, data]) => {
        const gameCountGroups = {};
        Object.entries(data.playerGames).forEach(([playerId, count]) => {
          if (!gameCountGroups[count]) gameCountGroups[count] = [];
          const player = players.find(p => p.id === parseInt(playerId));
          if (player) gameCountGroups[count].push(player.name);
        });
        
        return {
          date,
          totalGames: data.totalGames,
          gameCountGroups: Object.entries(gameCountGroups)
            .sort((a, b) => parseInt(b[0]) - parseInt(a[0]))
            .map(([count, names]) => ({ count: parseInt(count), players: names }))
        };
      });
  }, [filteredMatches, players]);

  // Daily chart data for graphs (unique players, matches, avg wait time per day)
  const dailyChartData = useMemo(() => {
    const dailyStats = {};
    
    matchHistory.forEach(match => {
      if (!match.endedAt || !match.players) return;
      const date = new Date(match.endedAt).toLocaleDateString('en-CA');
      
      if (!dailyStats[date]) {
        dailyStats[date] = {
          date,
          uniquePlayers: new Set(),
          totalMatches: 0,
          waitTimes: []
        };
      }
      
      dailyStats[date].totalMatches++;
      match.players.forEach(p => {
        dailyStats[date].uniquePlayers.add(p.id);
        if (p.joinedAt && match.startTime) {
          const waitTime = Math.round((match.startTime - p.joinedAt) / 60000);
          if (waitTime >= 0 && waitTime < 180) {
            dailyStats[date].waitTimes.push(waitTime);
          }
        }
      });
    });
    
    return Object.values(dailyStats)
      .map(day => ({
        date: day.date,
        displayDate: new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        uniquePlayers: day.uniquePlayers.size,
        totalMatches: day.totalMatches,
        avgWaitTime: day.waitTimes.length > 0 
          ? Math.round(day.waitTimes.reduce((a, b) => a + b, 0) / day.waitTimes.length)
          : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Show last 14 days
  }, [matchHistory]);

  // Player table for date selection (with sorting)
  const playerTableData = useMemo(() => {
    if (selectedDate === 'all') return [];
    
    const playerStats = {};
    
    filteredMatches.forEach(match => {
      if (!match.players) return;
      
      match.players.forEach(p => {
        if (!playerStats[p.id]) {
          const fullPlayer = players.find(pl => pl.id === p.id);
          playerStats[p.id] = {
            id: p.id,
            name: p.name,
            gender: p.gender || fullPlayer?.gender,
            level: p.level || fullPlayer?.level,
            checkInTime: p.joinedAt,
            totalGames: 0,
            smartMatchGames: 0,
            noSmartMatchGames: 0,
            expertCount: 0,
            advancedCount: 0,
            intermediateCount: 0,
            noviceCount: 0,
            waitUnder20: 0,
            wait20to30: 0,
            wait30to40: 0,
            waitOver40: 0
          };
        }
        
        if (p.joinedAt && (!playerStats[p.id].checkInTime || p.joinedAt < playerStats[p.id].checkInTime)) {
          playerStats[p.id].checkInTime = p.joinedAt;
        }
        
        playerStats[p.id].totalGames++;
        
        // Calculate wait time (time waiting in pool before getting on court)
        if (p.joinedAt && match.startTime) {
          const waitTime = Math.round((match.startTime - p.joinedAt) / 60000);
          if (waitTime >= 0 && waitTime < 180) {
            if (waitTime < 20) {
              playerStats[p.id].waitUnder20++;
            } else if (waitTime < 30) {
              playerStats[p.id].wait20to30++;
            } else if (waitTime < 40) {
              playerStats[p.id].wait30to40++;
            } else {
              playerStats[p.id].waitOver40++;
            }
          }
        }
        
        if (match.smartMatchedPlayerIds?.includes(p.id)) {
          playerStats[p.id].smartMatchGames++;
        } else {
          playerStats[p.id].noSmartMatchGames++;
        }
        
        match.players.forEach(otherP => {
          if (otherP.id !== p.id && otherP.level) {
            const levelKey = `${otherP.level.toLowerCase()}Count`;
            if (playerStats[p.id][levelKey] !== undefined) {
              playerStats[p.id][levelKey]++;
            }
          }
        });
      });
    });
    
    return Object.values(playerStats);
  }, [selectedDate, filteredMatches, players]);

  // Sorted player table data
  const sortedPlayerTableData = useMemo(() => {
    if (playerTableData.length === 0) return [];
    
    // Level order for sorting (Expert=0, Advanced=1, Intermediate=2, Novice=3)
    const levelOrder = { 'Expert': 0, 'Advanced': 1, 'Intermediate': 2, 'Novice': 3 };
    
    return [...playerTableData].sort((a, b) => {
      let aVal, bVal;
      
      switch (sortColumn) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'level':
          aVal = levelOrder[a.level] ?? 4;
          bVal = levelOrder[b.level] ?? 4;
          break;
        case 'checkInTime':
          aVal = a.checkInTime || Infinity;
          bVal = b.checkInTime || Infinity;
          break;
        case 'totalGames':
          aVal = a.totalGames || 0;
          bVal = b.totalGames || 0;
          break;
        case 'smartMatchGames':
          aVal = a.smartMatchGames || 0;
          bVal = b.smartMatchGames || 0;
          break;
        case 'noSmartMatchGames':
          aVal = a.noSmartMatchGames || 0;
          bVal = b.noSmartMatchGames || 0;
          break;
        case 'waitUnder20':
          aVal = a.waitUnder20 || 0;
          bVal = b.waitUnder20 || 0;
          break;
        case 'wait20to30':
          aVal = a.wait20to30 || 0;
          bVal = b.wait20to30 || 0;
          break;
        case 'wait30to40':
          aVal = a.wait30to40 || 0;
          bVal = b.wait30to40 || 0;
          break;
        case 'waitOver40':
          aVal = a.waitOver40 || 0;
          bVal = b.waitOver40 || 0;
          break;
        case 'expertCount':
          aVal = a.expertCount || 0;
          bVal = b.expertCount || 0;
          break;
        case 'advancedCount':
          aVal = a.advancedCount || 0;
          bVal = b.advancedCount || 0;
          break;
        case 'intermediateCount':
          aVal = a.intermediateCount || 0;
          bVal = b.intermediateCount || 0;
          break;
        case 'noviceCount':
          aVal = a.noviceCount || 0;
          bVal = b.noviceCount || 0;
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });
  }, [playerTableData, sortColumn, sortDirection]);

  // Handle column sort
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort indicator component
  const SortIndicator = ({ column }) => {
    if (sortColumn !== column) return <span className="ml-1 opacity-30">↕</span>;
    return <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  // Smart Match usage per player
  const smartMatchStats = useMemo(() => {
    const stats = {};
    filteredMatches.forEach(match => {
      if (match.smartMatchedPlayerIds) {
        match.smartMatchedPlayerIds.forEach(playerId => {
          stats[playerId] = (stats[playerId] || 0) + 1;
        });
      }
    });
    
    return Object.entries(stats)
      .map(([playerId, count]) => {
        const player = players.find(p => p.id === parseInt(playerId));
        return { 
          playerId: parseInt(playerId), 
          name: player?.name || 'Unknown', 
          gender: player?.gender,
          level: player?.level,
          count 
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [filteredMatches, players]);

  // ==================== INDIVIDUAL PLAYER REPORTS ====================

  const playersWithData = useMemo(() => {
    if (selectedDate === 'all') return players;
    
    const playerIdsWithData = new Set();
    filteredMatches.forEach(match => {
      match.players?.forEach(p => playerIdsWithData.add(p.id));
    });
    
    return players.filter(p => playerIdsWithData.has(p.id));
  }, [selectedDate, filteredMatches, players]);

  const selectedPlayer = useMemo(() => {
    if (!selectedPlayerId) return null;
    return players.find(p => p.id === selectedPlayerId);
  }, [selectedPlayerId, players]);

  const playerMatches = useMemo(() => {
    if (!selectedPlayerId) return [];
    return filteredMatches.filter(match => 
      match.players?.some(p => p.id === selectedPlayerId)
    ).sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0));
  }, [selectedPlayerId, filteredMatches]);

  const playerOverallStats = useMemo(() => {
    if (!selectedPlayerId) return null;
    
    const allPlayerMatches = filteredMatches.filter(match => 
      match.players?.some(p => p.id === selectedPlayerId)
    );
    
    let totalWaitTime = 0;
    let waitCount = 0;
    allPlayerMatches.forEach(match => {
      const player = match.players.find(p => p.id === selectedPlayerId);
      if (player?.joinedAt && match.startTime) {
        const waitTime = (match.startTime - player.joinedAt) / 60000;
        if (waitTime > 0 && waitTime < 180) {
          totalWaitTime += waitTime;
          waitCount++;
        }
      }
    });
    const avgWaitTime = waitCount > 0 ? Math.round(totalWaitTime / waitCount) : 0;
    
    const totalGames = allPlayerMatches.length;
    
    const levelCounts = { Expert: 0, Advanced: 0, Intermediate: 0, Novice: 0 };
    allPlayerMatches.forEach(match => {
      match.players.forEach(p => {
        if (p.id !== selectedPlayerId && p.level) {
          levelCounts[p.level] = (levelCounts[p.level] || 0) + 1;
        }
      });
    });
    
    const genderCombos = {};
    allPlayerMatches.forEach(match => {
      if (match.players?.length === 4) {
        const males = match.players.filter(p => p.gender === 'male').length;
        const females = match.players.filter(p => p.gender === 'female').length;
        const key = `${males}M/${females}F`;
        genderCombos[key] = (genderCombos[key] || 0) + 1;
      }
    });
    
    const levelCombos = {};
    allPlayerMatches.forEach(match => {
      if (match.players?.length === 4) {
        const levels = match.players.map(p => p.level).sort();
        const key = levels.join(' / ');
        levelCombos[key] = (levelCombos[key] || 0) + 1;
      }
    });
    
    const playedWith = {};
    allPlayerMatches.forEach(match => {
      match.players.forEach(p => {
        if (p.id !== selectedPlayerId) {
          playedWith[p.id] = playedWith[p.id] || { name: p.name, gender: p.gender, count: 0 };
          playedWith[p.id].count++;
        }
      });
    });
    
    let smartMatchCount = 0;
    allPlayerMatches.forEach(match => {
      if (match.smartMatchedPlayerIds?.includes(selectedPlayerId)) {
        smartMatchCount++;
      }
    });
    
    return {
      avgWaitTime,
      totalGames,
      levelCounts,
      genderCombos: Object.entries(genderCombos)
        .sort((a, b) => b[1] - a[1])
        .map(([combo, count]) => ({ combo, count })),
      levelCombos: Object.entries(levelCombos)
        .sort((a, b) => b[1] - a[1])
        .map(([combo, count]) => ({ combo, count })),
      playedWith: Object.values(playedWith)
        .sort((a, b) => b.count - a.count),
      smartMatchCount
    };
  }, [selectedPlayerId, filteredMatches]);

  // Player daily reports with max wait time
  const playerDailyReports = useMemo(() => {
    if (!selectedPlayerId) return [];
    
    const matchesToUse = filteredMatches.filter(match => 
      match.players?.some(p => p.id === selectedPlayerId)
    );
    
    const dailyData = {};
    matchesToUse.forEach(match => {
      if (!match.endedAt) return;
      const date = new Date(match.endedAt).toLocaleDateString('en-CA');
      if (!dailyData[date]) {
        dailyData[date] = {
          matches: [],
          levelCounts: { Expert: 0, Advanced: 0, Intermediate: 0, Novice: 0 },
          waitTimes: [],
          smartMatchCount: 0,
          checkInTime: null
        };
      }
      
      dailyData[date].matches.push(match);
      
      match.players.forEach(p => {
        if (p.id !== selectedPlayerId && p.level) {
          dailyData[date].levelCounts[p.level]++;
        }
      });
      
      const player = match.players.find(p => p.id === selectedPlayerId);
      if (player?.joinedAt && match.startTime) {
        const waitTime = Math.round((match.startTime - player.joinedAt) / 60000);
        if (waitTime > 0 && waitTime < 180) {
          dailyData[date].waitTimes.push(waitTime);
        }
        // Track check-in time
        if (!dailyData[date].checkInTime || player.joinedAt < dailyData[date].checkInTime) {
          dailyData[date].checkInTime = player.joinedAt;
        }
      }
      
      if (match.smartMatchedPlayerIds?.includes(selectedPlayerId)) {
        dailyData[date].smartMatchCount++;
      }
    });
    
    return Object.entries(dailyData)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, data]) => ({
        date,
        ...data,
        avgWaitTime: data.waitTimes.length > 0 
          ? Math.round(data.waitTimes.reduce((a, b) => a + b, 0) / data.waitTimes.length)
          : 0,
        maxWaitTime: data.waitTimes.length > 0 
          ? Math.max(...data.waitTimes)
          : 0
      }));
  }, [selectedPlayerId, filteredMatches]);

  const filteredPlayers = useMemo(() => {
    return playersWithData
      .filter(p => p.name.toLowerCase().includes(playerSearchTerm.toLowerCase()))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [playersWithData, playerSearchTerm]);

  const handleClearReports = () => {
    if (window.confirm('Are you sure you want to clear all match history and reports?\n\nThis action cannot be undone.')) {
      onClearReports();
    }
  };

  // Time Graph Component for Individual Player
  const TimeGraph = ({ matches, checkInTime, date }) => {
    if (!matches || matches.length === 0 || !checkInTime) return null;
    
    // Find earliest and latest times
    const allTimes = [checkInTime];
    matches.forEach(m => {
      if (m.startTime) allTimes.push(m.startTime);
      if (m.endedAt) allTimes.push(m.endedAt);
    });
    
    const minTime = Math.min(...allTimes);
    const maxTime = Math.max(...allTimes);
    const totalDuration = maxTime - minTime;
    
    if (totalDuration <= 0) return null;
    
    // Convert time to position percentage
    const getPosition = (time) => ((time - minTime) / totalDuration) * 100;
    
    // Format time for display
    const formatTimeLabel = (timestamp) => {
      return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    };
    
    return (
      <div className={`mt-3 p-3 rounded-lg ${isDarkMode ? 'bg-slate-600/30' : 'bg-slate-50'}`}>
        <p className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Activity Timeline
        </p>
        <div className="relative h-8">
          {/* Background bar (waiting) */}
          <div className={`absolute inset-0 rounded ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
          
          {/* Playing segments */}
          {matches.map((match, idx) => {
            if (!match.startTime || !match.endedAt) return null;
            const left = getPosition(match.startTime);
            const width = getPosition(match.endedAt) - left;
            return (
              <div
                key={idx}
                className="absolute top-0 h-full bg-green-500 rounded"
                style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
                title={`Playing: ${formatTimeLabel(match.startTime)} - ${formatTimeLabel(match.endedAt)}`}
              />
            );
          })}
          
          {/* Check-in marker */}
          <div
            className="absolute top-0 h-full w-0.5 bg-yellow-400"
            style={{ left: `${getPosition(checkInTime)}%` }}
            title={`Check-in: ${formatTimeLabel(checkInTime)}`}
          />
        </div>
        
        {/* Legend and time labels */}
        <div className="flex justify-between mt-1">
          <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            {formatTimeLabel(minTime)}
          </span>
          <div className="flex gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-yellow-400"></span>
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Check-in</span>
            </span>
            <span className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded ${isDarkMode ? 'bg-slate-700' : 'bg-slate-300'}`}></span>
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Waiting</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded bg-green-500"></span>
              <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>Playing</span>
            </span>
          </div>
          <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            {formatTimeLabel(maxTime)}
          </span>
        </div>
      </div>
    );
  };

  // Export to PDF
  const exportToPDF = async (reportType) => {
    setIsExporting(true);
    try {
      const element = reportType === 'overall' ? overallReportRef.current : individualReportRef.current;
      if (!element) {
        alert('No report content to export');
        setIsExporting(false);
        return;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow pop-ups to export PDF');
        setIsExporting(false);
        return;
      }

      const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
        .map(style => style.outerHTML)
        .join('\n');

      const content = element.cloneNode(true);
      content.style.maxHeight = 'none';
      content.style.overflow = 'visible';
      content.style.height = 'auto';
      
      const darkToLightMap = [
        ['bg-slate-800/50', 'bg-slate-50 border-slate-200'],
        ['bg-slate-800', 'bg-slate-50'],
        ['bg-slate-700/50', 'bg-white border-slate-200'],
        ['bg-slate-700', 'bg-slate-100'],
        ['bg-slate-600/50', 'bg-slate-100'],
        ['bg-slate-600', 'bg-slate-100'],
        ['bg-slate-600/30', 'bg-slate-100'],
        ['from-slate-900', 'from-white'],
        ['to-slate-800', 'to-slate-50'],
        ['text-white', 'text-slate-800'],
        ['text-slate-300', 'text-slate-700'],
        ['text-slate-200', 'text-slate-700'],
        ['text-slate-400', 'text-slate-600'],
        ['text-slate-500', 'text-slate-500'],
        ['bg-purple-500/20', 'bg-purple-100'],
        ['text-purple-400', 'text-purple-700'],
        ['border-purple-500/30', 'border-purple-300'],
        ['bg-orange-500/20', 'bg-orange-100'],
        ['text-orange-400', 'text-orange-700'],
        ['border-orange-500/30', 'border-orange-300'],
        ['bg-blue-500/20', 'bg-blue-100'],
        ['text-blue-400', 'text-blue-600'],
        ['border-blue-500/30', 'border-blue-300'],
        ['bg-green-500/20', 'bg-green-100'],
        ['text-green-400', 'text-green-700'],
        ['border-green-500/30', 'border-green-300'],
        ['bg-violet-500/30', 'bg-violet-100'],
        ['text-violet-400', 'text-violet-700'],
        ['border-violet-500', 'border-violet-400'],
        ['border-violet-500/30', 'border-violet-300'],
        ['bg-pink-500/20', 'bg-pink-100'],
        ['text-pink-400', 'text-pink-600'],
        ['border-slate-700', 'border-slate-200'],
        ['border-slate-600', 'border-slate-200'],
      ];

      content.querySelectorAll('*').forEach(el => {
        el.style.maxHeight = 'none';
        el.style.overflow = 'visible';
        
        if (el.className && typeof el.className === 'string') {
          let classList = el.className.split(' ');
          let newClassList = classList.map(cls => {
            for (const [darkClass, lightClass] of darkToLightMap) {
              if (cls === darkClass) {
                return lightClass;
              }
            }
            return cls;
          });
          el.className = newClassList.join(' ');
        }
      });

      if (content.className && typeof content.className === 'string') {
        let classList = content.className.split(' ');
        let newClassList = classList.map(cls => {
          for (const [darkClass, lightClass] of darkToLightMap) {
            if (cls === darkClass) {
              return lightClass;
            }
          }
          return cls;
        });
        content.className = newClassList.join(' ');
      }

      const dateStr = selectedDate === 'all' ? 'All Time' : formatDate(selectedDate);
      const playerName = reportType === 'individual' && selectedPlayer ? ` - ${selectedPlayer.name}` : '';
      const title = `CueMii ${reportType === 'overall' ? 'Overall' : 'Individual'} Report - ${dateStr}${playerName}`;

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${title}</title>
          ${styles}
          <style>
            @media print {
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }
              * {
                max-height: none !important;
                overflow: visible !important;
              }
            }
            body {
              margin: 0;
              padding: 20px;
              background: #ffffff !important;
            }
            .report-content {
              max-width: 800px;
              margin: 0 auto;
            }
          </style>
        </head>
        <body>
          <div class="report-content">
            ${content.outerHTML}
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 500);
            };
          </script>
        </body>
        </html>
      `);
      
      printWindow.document.close();
      
      setTimeout(() => {
        setIsExporting(false);
      }, 1000);
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Error exporting PDF. Please try again.');
    }
    setIsExporting(false);
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`rounded-2xl w-[1100px] h-[calc(100vh-2rem)] flex flex-col overflow-hidden shadow-2xl border ${
        isDarkMode 
          ? 'bg-gradient-to-br from-slate-900 to-slate-800 border-violet-500/30' 
          : 'bg-white border-violet-300'
      }`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-3 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h2 className="text-xl font-bold text-white">Reports</h2>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedPlayerId(null);
              }}
              className="bg-white/20 text-white px-3 py-1.5 rounded-lg text-sm font-medium border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              <option value="all" className="text-slate-800">All Time</option>
              {uniqueDates.map(date => (
                <option key={date} value={date} className="text-slate-800">{formatDate(date)}</option>
              ))}
            </select>

            <button
              onClick={() => exportToPDF(activeTab)}
              disabled={isExporting || (activeTab === 'individual' && !selectedPlayer)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isExporting || (activeTab === 'individual' && !selectedPlayer)
                  ? 'bg-white/10 text-white/50 cursor-not-allowed'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>
            
            <button
              onClick={handleClearReports}
              className="bg-red-500/30 hover:bg-red-500/50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear All
            </button>
            
            <button 
              onClick={onClose} 
              className="text-white/80 hover:text-white text-2xl font-light transition-colors ml-2"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <button
            onClick={() => setActiveTab('overall')}
            className={`px-6 py-3 font-semibold text-sm transition-colors ${
              activeTab === 'overall'
                ? isDarkMode 
                  ? 'text-violet-400 border-b-2 border-violet-400 bg-slate-800/50' 
                  : 'text-violet-600 border-b-2 border-violet-600 bg-violet-50'
                : isDarkMode 
                  ? 'text-slate-400 hover:text-slate-300' 
                  : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            📊 Overall Reports
          </button>
          <button
            onClick={() => setActiveTab('individual')}
            className={`px-6 py-3 font-semibold text-sm transition-colors ${
              activeTab === 'individual'
                ? isDarkMode 
                  ? 'text-violet-400 border-b-2 border-violet-400 bg-slate-800/50' 
                  : 'text-violet-600 border-b-2 border-violet-600 bg-violet-50'
                : isDarkMode 
                  ? 'text-slate-400 hover:text-slate-300' 
                  : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            👤 Individual Player Reports
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'overall' ? (
            <div className="h-full overflow-y-auto p-6 space-y-6" ref={overallReportRef}>
              {filteredMatches.length === 0 ? (
                <div className={`text-center py-12 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-lg font-medium">No match data available</p>
                  <p className="text-sm mt-1">Complete some matches to see reports</p>
                </div>
              ) : (
                <>
                  {/* Report Title */}
                  <div className={`text-center pb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                    <h3 className="text-lg font-semibold">
                      Overall Report - {selectedDate === 'all' ? 'All Time' : formatDate(selectedDate)}
                    </h3>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                      <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Matches</p>
                      <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{filteredMatches.length}</p>
                    </div>
                    <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                      <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Unique Players</p>
                      <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {new Set(filteredMatches.flatMap(m => m.players?.map(p => p.id) || [])).size}
                      </p>
                    </div>
                    <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                      <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Smart Matches</p>
                      <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        {filteredMatches.filter(m => m.smartMatchedPlayerIds?.length > 0).length}
                      </p>
                    </div>
                    <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                      <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Avg Wait Time</p>
                      <p className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{waitTimeStats.avgWaitTime}m</p>
                    </div>
                  </div>

                  {/* Gender and Level Breakdown */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Gender Counts */}
                    <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                      <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        Players by Gender
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {(() => {
                          const uniquePlayers = new Map();
                          filteredMatches.forEach(m => {
                            m.players?.forEach(p => {
                              if (!uniquePlayers.has(p.id)) {
                                uniquePlayers.set(p.id, p);
                              }
                            });
                          });
                          const males = [...uniquePlayers.values()].filter(p => p.gender === 'male').length;
                          const females = [...uniquePlayers.values()].filter(p => p.gender === 'female').length;
                          return (
                            <>
                              <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-blue-100 border border-blue-200'}`}>
                                <p className={`text-2xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>{males}</p>
                                <p className={`text-xs ${isDarkMode ? 'text-blue-400/70' : 'text-blue-600'}`}>Male</p>
                              </div>
                              <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-pink-500/20 border border-pink-500/30' : 'bg-pink-100 border border-pink-200'}`}>
                                <p className={`text-2xl font-bold ${isDarkMode ? 'text-pink-400' : 'text-pink-700'}`}>{females}</p>
                                <p className={`text-xs ${isDarkMode ? 'text-pink-400/70' : 'text-pink-600'}`}>Female</p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Level Counts */}
                    <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                      <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        Players by Level
                      </h3>
                      <div className="grid grid-cols-4 gap-2">
                        {(() => {
                          const uniquePlayers = new Map();
                          filteredMatches.forEach(m => {
                            m.players?.forEach(p => {
                              if (!uniquePlayers.has(p.id)) {
                                uniquePlayers.set(p.id, p);
                              }
                            });
                          });
                          const experts = [...uniquePlayers.values()].filter(p => p.level === 'Expert').length;
                          const advanced = [...uniquePlayers.values()].filter(p => p.level === 'Advanced').length;
                          const intermediate = [...uniquePlayers.values()].filter(p => p.level === 'Intermediate').length;
                          const novice = [...uniquePlayers.values()].filter(p => p.level === 'Novice').length;
                          return (
                            <>
                              <div className={`rounded-lg p-2 text-center ${isDarkMode ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-purple-100 border border-purple-200'}`}>
                                <p className={`text-xl font-bold ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>{experts}</p>
                                <p className={`text-xs ${isDarkMode ? 'text-purple-400/70' : 'text-purple-600'}`}>Expert</p>
                              </div>
                              <div className={`rounded-lg p-2 text-center ${isDarkMode ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-orange-100 border border-orange-200'}`}>
                                <p className={`text-xl font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-700'}`}>{advanced}</p>
                                <p className={`text-xs ${isDarkMode ? 'text-orange-400/70' : 'text-orange-600'}`}>Adv</p>
                              </div>
                              <div className={`rounded-lg p-2 text-center ${isDarkMode ? 'bg-blue-500/20 border border-blue-500/30' : 'bg-blue-100 border border-blue-200'}`}>
                                <p className={`text-xl font-bold ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>{intermediate}</p>
                                <p className={`text-xs ${isDarkMode ? 'text-blue-400/70' : 'text-blue-600'}`}>Int</p>
                              </div>
                              <div className={`rounded-lg p-2 text-center ${isDarkMode ? 'bg-green-500/20 border border-green-500/30' : 'bg-green-100 border border-green-200'}`}>
                                <p className={`text-xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>{novice}</p>
                                <p className={`text-xs ${isDarkMode ? 'text-green-400/70' : 'text-green-600'}`}>Nov</p>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Wait Time Distribution */}
                  <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                    <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Wait Time Distribution
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                      <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-green-500/20 border border-green-500/30' : 'bg-green-100 border border-green-200'}`}>
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>{waitTimeStats.distribution.under20}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-green-400/70' : 'text-green-600'}`}>&lt; 20 min</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-yellow-100 border border-yellow-200'}`}>
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>{waitTimeStats.distribution.between20and30}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>20-30 min</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-orange-100 border border-orange-200'}`}>
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-700'}`}>{waitTimeStats.distribution.between30and40}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-orange-400/70' : 'text-orange-600'}`}>30-40 min</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-red-500/20 border border-red-500/30' : 'bg-red-100 border border-red-200'}`}>
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>{waitTimeStats.distribution.over40}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-red-400/70' : 'text-red-600'}`}>&gt; 40 min</p>
                      </div>
                    </div>
                  </div>

                  {/* Court Timer Duration */}
                  <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                    <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Court Timer Duration
                      <span className={`text-xs font-normal ml-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        (Avg: {courtDurationStats.avgDuration}m)
                      </span>
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                      <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-green-500/20 border border-green-500/30' : 'bg-green-100 border border-green-200'}`}>
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>{courtDurationStats.distribution.under20}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-green-400/70' : 'text-green-600'}`}>&lt; 20 min</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-yellow-500/20 border border-yellow-500/30' : 'bg-yellow-100 border border-yellow-200'}`}>
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-yellow-400' : 'text-yellow-700'}`}>{courtDurationStats.distribution.between20and30}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-yellow-400/70' : 'text-yellow-600'}`}>20-30 min</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-orange-100 border border-orange-200'}`}>
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-orange-400' : 'text-orange-700'}`}>{courtDurationStats.distribution.between30and40}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-orange-400/70' : 'text-orange-600'}`}>30-40 min</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-red-500/20 border border-red-500/30' : 'bg-red-100 border border-red-200'}`}>
                        <p className={`text-2xl font-bold ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>{courtDurationStats.distribution.over40}</p>
                        <p className={`text-xs ${isDarkMode ? 'text-red-400/70' : 'text-red-600'}`}>&gt; 40 min</p>
                      </div>
                    </div>
                  </div>

                  {/* Daily Charts */}
                  {dailyChartData.length > 1 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Unique Players Per Day */}
                      <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                        <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          Unique Players Per Day
                        </h3>
                        <div className="flex items-end gap-1 h-32">
                          {dailyChartData.map((day, idx) => {
                            const maxPlayers = Math.max(...dailyChartData.map(d => d.uniquePlayers));
                            const height = maxPlayers > 0 ? (day.uniquePlayers / maxPlayers) * 100 : 0;
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center">
                                <div className="w-full flex flex-col items-center justify-end h-24">
                                  <span className={`text-xs mb-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                    {day.uniquePlayers}
                                  </span>
                                  <div 
                                    className={`w-full rounded-t ${isDarkMode ? 'bg-blue-500' : 'bg-blue-400'}`}
                                    style={{ height: `${height}%`, minHeight: day.uniquePlayers > 0 ? '4px' : '0' }}
                                  />
                                </div>
                                <span className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {day.displayDate}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Total Matches Per Day */}
                      <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                        <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          Total Matches Per Day
                        </h3>
                        <div className="flex items-end gap-1 h-32">
                          {dailyChartData.map((day, idx) => {
                            const maxMatches = Math.max(...dailyChartData.map(d => d.totalMatches));
                            const height = maxMatches > 0 ? (day.totalMatches / maxMatches) * 100 : 0;
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center">
                                <div className="w-full flex flex-col items-center justify-end h-24">
                                  <span className={`text-xs mb-1 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    {day.totalMatches}
                                  </span>
                                  <div 
                                    className={`w-full rounded-t ${isDarkMode ? 'bg-emerald-500' : 'bg-emerald-400'}`}
                                    style={{ height: `${height}%`, minHeight: day.totalMatches > 0 ? '4px' : '0' }}
                                  />
                                </div>
                                <span className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {day.displayDate}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Average Wait Time Per Day */}
                      <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                        <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                          Avg Wait Time Per Day
                        </h3>
                        <div className="flex items-end gap-1 h-32">
                          {dailyChartData.map((day, idx) => {
                            const maxWait = Math.max(...dailyChartData.map(d => d.avgWaitTime));
                            const height = maxWait > 0 ? (day.avgWaitTime / maxWait) * 100 : 0;
                            const textColor = day.avgWaitTime < 20 
                              ? (isDarkMode ? 'text-green-400' : 'text-green-600')
                              : day.avgWaitTime < 30 
                              ? (isDarkMode ? 'text-yellow-400' : 'text-yellow-600')
                              : day.avgWaitTime < 40 
                              ? (isDarkMode ? 'text-orange-400' : 'text-orange-600')
                              : (isDarkMode ? 'text-red-400' : 'text-red-600');
                            const barColor = day.avgWaitTime < 20 
                              ? (isDarkMode ? 'bg-green-500' : 'bg-green-400')
                              : day.avgWaitTime < 30 
                              ? (isDarkMode ? 'bg-yellow-500' : 'bg-yellow-400')
                              : day.avgWaitTime < 40 
                              ? (isDarkMode ? 'bg-orange-500' : 'bg-orange-400')
                              : (isDarkMode ? 'bg-red-500' : 'bg-red-400');
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center">
                                <div className="w-full flex flex-col items-center justify-end h-24">
                                  <span className={`text-xs mb-1 ${textColor}`}>
                                    {day.avgWaitTime}m
                                  </span>
                                  <div 
                                    className={`w-full rounded-t ${barColor}`}
                                    style={{ height: `${height}%`, minHeight: day.avgWaitTime > 0 ? '4px' : '0' }}
                                  />
                                </div>
                                <span className={`text-xs mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                  {day.displayDate}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Player Table for Specific Date */}
                  {selectedDate !== 'all' && sortedPlayerTableData.length > 0 && (
                    <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                      <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                        Player Statistics for {formatDate(selectedDate)}
                        <span className={`text-xs font-normal ml-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          (Click column headers to sort)
                        </span>
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                              <th className="text-left py-2 px-2 cursor-pointer hover:text-violet-400" onClick={() => handleSort('name')}>
                                Player<SortIndicator column="name" />
                              </th>
                              <th className="text-center py-2 px-2 cursor-pointer hover:text-violet-400" onClick={() => handleSort('level')}>
                                Level<SortIndicator column="level" />
                              </th>
                              <th className="text-center py-2 px-2 cursor-pointer hover:text-violet-400" onClick={() => handleSort('checkInTime')}>
                                Check-In<SortIndicator column="checkInTime" />
                              </th>
                              <th className="text-center py-2 px-2 cursor-pointer hover:text-violet-400" onClick={() => handleSort('totalGames')}>
                                Games<SortIndicator column="totalGames" />
                              </th>
                              <th className="text-center py-2 px-2 cursor-pointer hover:text-violet-400" onClick={() => handleSort('smartMatchGames')}>
                                Smart<SortIndicator column="smartMatchGames" />
                              </th>
                              <th className="text-center py-2 px-2 cursor-pointer hover:text-violet-400" onClick={() => handleSort('noSmartMatchGames')}>
                                Manual<SortIndicator column="noSmartMatchGames" />
                              </th>
                              <th className="text-center py-2 px-1 cursor-pointer hover:text-violet-400" onClick={() => handleSort('waitUnder20')}>
                                <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>&lt;20m</span>
                                <SortIndicator column="waitUnder20" />
                              </th>
                              <th className="text-center py-2 px-1 cursor-pointer hover:text-violet-400" onClick={() => handleSort('wait20to30')}>
                                <span className={isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}>20-30</span>
                                <SortIndicator column="wait20to30" />
                              </th>
                              <th className="text-center py-2 px-1 cursor-pointer hover:text-violet-400" onClick={() => handleSort('wait30to40')}>
                                <span className={isDarkMode ? 'text-orange-400' : 'text-orange-600'}>30-40</span>
                                <SortIndicator column="wait30to40" />
                              </th>
                              <th className="text-center py-2 px-1 cursor-pointer hover:text-violet-400" onClick={() => handleSort('waitOver40')}>
                                <span className={isDarkMode ? 'text-red-400' : 'text-red-600'}>&gt;40m</span>
                                <SortIndicator column="waitOver40" />
                              </th>
                              <th className="text-center py-2 px-1 cursor-pointer hover:text-violet-400" onClick={() => handleSort('expertCount')}>
                                <span className={isDarkMode ? 'text-purple-400' : 'text-purple-600'}>Exp</span>
                                <SortIndicator column="expertCount" />
                              </th>
                              <th className="text-center py-2 px-1 cursor-pointer hover:text-violet-400" onClick={() => handleSort('advancedCount')}>
                                <span className={isDarkMode ? 'text-orange-400' : 'text-orange-600'}>Adv</span>
                                <SortIndicator column="advancedCount" />
                              </th>
                              <th className="text-center py-2 px-1 cursor-pointer hover:text-violet-400" onClick={() => handleSort('intermediateCount')}>
                                <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>Int</span>
                                <SortIndicator column="intermediateCount" />
                              </th>
                              <th className="text-center py-2 px-1 cursor-pointer hover:text-violet-400" onClick={() => handleSort('noviceCount')}>
                                <span className={isDarkMode ? 'text-green-400' : 'text-green-600'}>Nov</span>
                                <SortIndicator column="noviceCount" />
                              </th>
                            </tr>
                          </thead>
                          <tbody className={isDarkMode ? 'text-slate-300' : 'text-slate-700'}>
                            {sortedPlayerTableData.map(player => (
                              <tr key={player.id} className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
                                <td className="py-2 px-2">
                                  <span className={player.gender === 'male' ? 'text-blue-400' : 'text-pink-400'}>●</span>{' '}
                                  {player.name}
                                </td>
                                <td className="text-center py-2 px-2">
                                  {player.level && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getLevelColor(player.level)}`}>
                                      {player.level[0]}
                                    </span>
                                  )}
                                </td>
                                <td className="text-center py-2 px-2 text-xs">
                                  {player.checkInTime ? formatTime(player.checkInTime) : '—'}
                                </td>
                                <td className="text-center py-2 px-2 font-semibold">{player.totalGames}</td>
                                <td className="text-center py-2 px-2">
                                  <span className={isDarkMode ? 'text-violet-400' : 'text-violet-600'}>{player.smartMatchGames}</span>
                                </td>
                                <td className="text-center py-2 px-2">{player.noSmartMatchGames}</td>
                                <td className={`text-center py-2 px-1 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                  {player.waitUnder20 || '—'}
                                </td>
                                <td className={`text-center py-2 px-1 ${isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                                  {player.wait20to30 || '—'}
                                </td>
                                <td className={`text-center py-2 px-1 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                                  {player.wait30to40 || '—'}
                                </td>
                                <td className={`text-center py-2 px-1 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>
                                  {player.waitOver40 || '—'}
                                </td>
                                <td className={`text-center py-2 px-1 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                                  {player.expertCount || '—'}
                                </td>
                                <td className={`text-center py-2 px-1 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}`}>
                                  {player.advancedCount || '—'}
                                </td>
                                <td className={`text-center py-2 px-1 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                                  {player.intermediateCount || '—'}
                                </td>
                                <td className={`text-center py-2 px-1 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                                  {player.noviceCount || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Gender Combinations */}
                  <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                    <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Gender Combinations
                    </h3>
                    <div className="grid grid-cols-4 gap-3">
                      {genderCombinations.map(({ combo, count }) => (
                        <div key={combo} className={`rounded-lg p-3 text-center ${
                          isDarkMode ? 'bg-slate-700/50' : 'bg-white border border-slate-200'
                        }`}>
                          <p className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{count}</p>
                          <p className="text-xs">{formatGenderCombo(combo)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Level Combinations */}
                  <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                    <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Level Combinations
                    </h3>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {levelCombinations.map(({ combo, count }) => {
                        // Color code each level in the combo
                        const coloredCombo = combo.split(' / ').map((level, idx) => {
                          let colorClass = '';
                          if (level === 'Expert') colorClass = isDarkMode ? 'text-purple-400' : 'text-purple-600';
                          else if (level === 'Advanced') colorClass = isDarkMode ? 'text-orange-400' : 'text-orange-600';
                          else if (level === 'Intermediate') colorClass = isDarkMode ? 'text-blue-400' : 'text-blue-600';
                          else if (level === 'Novice') colorClass = isDarkMode ? 'text-green-400' : 'text-green-600';
                          return (
                            <span key={idx}>
                              {idx > 0 && <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}> / </span>}
                              <span className={colorClass}>{level}</span>
                            </span>
                          );
                        });
                        return (
                          <div key={combo} className={`flex justify-between items-center rounded-lg px-3 py-2 ${
                            isDarkMode ? 'bg-slate-700/50' : 'bg-white border border-slate-200'
                          }`}>
                            <span className="text-sm">{coloredCombo}</span>
                            <span className={`font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Daily Statistics - Always show */}
                  <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                    <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Daily Statistics
                    </h3>
                    <div className="space-y-4 max-h-64 overflow-y-auto">
                      {dateStats.map(({ date, totalGames, gameCountGroups }) => (
                        <div key={date} className={`rounded-lg p-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-white border border-slate-200'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                              {formatDate(date)}
                            </span>
                            <span className={`text-sm ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                              {totalGames} matches
                            </span>
                          </div>
                          <div className="space-y-1">
                            {gameCountGroups.map(({ count, players: playerNames }) => (
                              <div key={count} className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                <span className="font-medium">{count} game{count !== 1 ? 's' : ''}:</span>{' '}
                                {playerNames.join(', ')}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Smart Match Usage */}
                  <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                    <h3 className={`font-semibold mb-3 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      Smart Match Usage by Player
                    </h3>
                    {smartMatchStats.length === 0 ? (
                      <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        No smart match data available
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                        {smartMatchStats.map(({ name, gender, level, count }) => (
                          <div key={name} className={`flex justify-between items-center rounded-lg px-3 py-2 ${
                            isDarkMode ? 'bg-slate-700/50' : 'bg-white border border-slate-200'
                          }`}>
                            <div className="flex items-center gap-2 truncate">
                              <span className={`text-sm truncate ${
                                gender === 'male' 
                                  ? (isDarkMode ? 'text-blue-400' : 'text-blue-600')
                                  : (isDarkMode ? 'text-pink-400' : 'text-pink-600')
                              }`}>{name}</span>
                              {level && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getLevelColor(level)}`}>
                                  {level[0]}
                                </span>
                              )}
                            </div>
                            <span className={`font-semibold ml-2 ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Individual Player Reports Tab */
            <div className="h-full flex">
              {/* Player List */}
              <div className={`w-64 flex-shrink-0 border-r overflow-hidden flex flex-col ${
                isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="p-3">
                  <input
                    type="text"
                    value={playerSearchTerm}
                    onChange={(e) => setPlayerSearchTerm(e.target.value)}
                    placeholder="Search players..."
                    className={`w-full px-3 py-2 rounded-lg text-sm ${
                      isDarkMode 
                        ? 'bg-slate-700 border-slate-600 text-white placeholder-slate-500' 
                        : 'bg-white border-slate-300 text-slate-800 placeholder-slate-400'
                    } border focus:outline-none focus:ring-2 focus:ring-violet-500`}
                  />
                  {selectedDate !== 'all' && (
                    <p className={`text-xs mt-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                      Showing {filteredPlayers.length} players with data for {formatDate(selectedDate)}
                    </p>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filteredPlayers.length === 0 ? (
                    <p className={`text-center py-4 text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                      No players found
                    </p>
                  ) : (
                    filteredPlayers.map(player => (
                      <button
                        key={player.id}
                        onClick={() => setSelectedPlayerId(player.id)}
                        className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                          selectedPlayerId === player.id
                            ? isDarkMode 
                              ? 'bg-violet-600/30 text-violet-300 border-l-2 border-violet-500' 
                              : 'bg-violet-100 text-violet-700 border-l-2 border-violet-500'
                            : isDarkMode 
                              ? 'text-slate-300 hover:bg-slate-700/50' 
                              : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {player.level && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${getLevelColor(player.level)}`}>
                              {player.level[0]}
                            </span>
                          )}
                          <span className={player.gender === 'male' ? 'text-blue-400' : 'text-pink-400'}>●</span>
                          <span className="truncate">{player.name}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Player Details */}
              <div className="flex-1 overflow-y-auto p-6" ref={individualReportRef}>
                {!selectedPlayer ? (
                  <div className={`text-center py-12 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <p className="text-lg font-medium">Select a player</p>
                    <p className="text-sm mt-1">Choose a player from the list to view their statistics</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Player Header */}
                    <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
                          selectedPlayer.gender === 'male' 
                            ? 'bg-blue-500/20 text-blue-400' 
                            : 'bg-pink-500/20 text-pink-400'
                        }`}>
                          {selectedPlayer.gender === 'male' ? '♂' : '♀'}
                        </div>
                        <div>
                          <h3 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                            {selectedPlayer.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded text-xs border ${getLevelColor(selectedPlayer.level)}`}>
                              {selectedPlayer.level}
                            </span>
                            <span className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                              {selectedPlayer.gender === 'male' ? 'Male' : 'Female'}
                            </span>
                            {selectedDate !== 'all' && (
                              <span className={`text-xs ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                                ({formatDate(selectedDate)})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {playerOverallStats && playerOverallStats.totalGames > 0 ? (
                      <>
                        {/* Quick Stats */}
                        <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                          <h4 className={`font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                            📊 {selectedDate === 'all' ? 'Overall' : 'Daily'} Statistics
                          </h4>
                          
                          <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-slate-700/50' : 'bg-white border border-slate-200'}`}>
                              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                {playerOverallStats.totalGames}
                              </p>
                              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Total Games</p>
                            </div>
                            <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-slate-700/50' : 'bg-white border border-slate-200'}`}>
                              <p className={`text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                {playerOverallStats.avgWaitTime}m
                              </p>
                              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Avg Wait Time</p>
                            </div>
                            <div className={`rounded-lg p-3 text-center ${isDarkMode ? 'bg-slate-700/50' : 'bg-white border border-slate-200'}`}>
                              <p className={`text-2xl font-bold ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                                {playerOverallStats.smartMatchCount}
                              </p>
                              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Smart Matches</p>
                            </div>
                          </div>

                          {/* Played with Levels */}
                          <div className="mb-4">
                            <p className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              Played with Levels
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              {Object.entries(playerOverallStats.levelCounts)
                                .filter(([, count]) => count > 0)
                                .map(([level, count]) => (
                                  <span key={level} className={`px-2 py-1 rounded text-xs border ${getLevelColor(level)}`}>
                                    {level}: {count}
                                  </span>
                                ))}
                            </div>
                          </div>

                          {/* Gender Combinations */}
                          <div className="mb-4">
                            <p className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              Gender Combinations
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              {playerOverallStats.genderCombos.map(({ combo, count }) => (
                                <span key={combo} className={`px-2 py-1 rounded text-xs ${
                                  isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {formatGenderCombo(combo)}: {count}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* People Played With */}
                          <div>
                            <p className={`text-sm font-medium mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                              People Played With
                            </p>
                            <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
                              {playerOverallStats.playedWith.map(({ name, gender, count }) => (
                                <div key={name} className={`flex justify-between text-xs px-2 py-1 rounded ${
                                  isDarkMode ? 'bg-slate-700/50' : 'bg-slate-100'
                                }`}>
                                  <span className={`truncate ${
                                    gender === 'male' 
                                      ? (isDarkMode ? 'text-blue-400' : 'text-blue-600')
                                      : (isDarkMode ? 'text-pink-400' : 'text-pink-600')
                                  }`}>{name}</span>
                                  <span className={`ml-1 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Daily Reports */}
                        <div className={`rounded-xl p-4 ${isDarkMode ? 'bg-slate-800/50 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                          <h4 className={`font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                            📅 {selectedDate === 'all' ? 'Daily' : 'Match'} Reports
                          </h4>
                          <div className="space-y-4">
                            {playerDailyReports.map(({ date, matches: dayMatches, levelCounts, avgWaitTime, maxWaitTime, smartMatchCount, checkInTime }) => (
                              <div key={date} className={`rounded-lg p-3 ${isDarkMode ? 'bg-slate-700/50' : 'bg-white border border-slate-200'}`}>
                                <div className="flex justify-between items-center mb-2">
                                  <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                                    {formatDate(date)}
                                  </span>
                                  <span className={`text-sm ${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>
                                    {dayMatches.length} match{dayMatches.length !== 1 ? 'es' : ''}
                                  </span>
                                </div>
                                
                                <div className="grid grid-cols-4 gap-2 mb-2 text-xs">
                                  <div className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                                    Avg Wait: <span className={isDarkMode ? 'text-white' : 'text-slate-800'}>{avgWaitTime}m</span>
                                  </div>
                                  <div className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                                    Max Wait: <span className={isDarkMode ? 'text-orange-400' : 'text-orange-600'}>{maxWaitTime}m</span>
                                  </div>
                                  <div className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                                    Smart Match: <span className={isDarkMode ? 'text-violet-400' : 'text-violet-600'}>{smartMatchCount}</span>
                                  </div>
                                  <div className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>
                                    Levels: {Object.entries(levelCounts).filter(([,c]) => c > 0).map(([l,c]) => `${l[0]}:${c}`).join(' ')}
                                  </div>
                                </div>

                                {/* Time Graph */}
                                <TimeGraph matches={dayMatches} checkInTime={checkInTime} date={date} />

                                {/* Match List */}
                                <div className="space-y-2 mt-3">
                                  {dayMatches.map((match, idx) => (
                                    <div key={match.id || idx} className={`text-xs px-2 py-2 rounded ${
                                      isDarkMode ? 'bg-slate-600/50' : 'bg-slate-100'
                                    }`}>
                                      <div className="flex justify-between items-center mb-1">
                                        <div className={isDarkMode ? 'text-slate-400' : 'text-slate-500'}>
                                          {match.startTime && (
                                            <span>Start: {formatTime(match.startTime)}</span>
                                          )}
                                          {match.startTime && match.endedAt && ' → '}
                                          {match.endedAt && (
                                            <span>End: {formatTime(match.endedAt)}</span>
                                          )}
                                        </div>
                                        {match.smartMatchedPlayerIds?.includes(selectedPlayerId) && (
                                          <span className={`${isDarkMode ? 'text-violet-400' : 'text-violet-600'}`}>⚡ Smart</span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {match.players?.map(p => (
                                          <span 
                                            key={p.id} 
                                            className={`px-1.5 py-0.5 rounded border-2 ${
                                              p.id === selectedPlayerId 
                                                ? `${getLevelColor(p.level)} border-yellow-400`
                                                : `${getLevelColor(p.level)} border-transparent`
                                            }`}
                                          >
                                            <span className={p.gender === 'male' ? 'text-blue-400' : 'text-pink-400'}>●</span>{' '}
                                            {p.name}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className={`text-center py-8 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                        <p>No match data available for this player{selectedDate !== 'all' ? ' on this date' : ''}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsModal;
