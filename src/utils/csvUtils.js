import { VALID_GENDERS, SKILL_LEVELS } from '../data/initialData';

/**
 * Export players array to CSV and trigger download
 * @param {Array} players - Array of player objects
 */
export const exportPlayersToCSV = (players) => {
  const headers = ['name', 'gender', 'level'];
  const csvContent = [
    headers.join(','),
    ...players.map(p => [
      `"${p.name.replace(/"/g, '""')}"`, // Escape quotes in names
      p.gender,
      p.level
    ].join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `baddixx_players_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Parse a CSV line handling quoted values
 * @param {string} line - CSV line to parse
 * @returns {Array} Array of values
 */
const parseCSVLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
};

/**
 * Parse CSV text and return array of player objects
 * @param {string} text - CSV text content
 * @returns {Object} { players: Array, errors: Array }
 */
export const parsePlayersCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const errors = [];
  const players = [];
  
  if (lines.length < 2) {
    return { players: [], errors: ['CSV file is empty or has no data rows'] };
  }

  // Parse header
  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const nameIdx = header.indexOf('name');
  const genderIdx = header.indexOf('gender');
  const levelIdx = header.indexOf('level');

  if (nameIdx === -1) {
    return { players: [], errors: ['CSV must have a "name" column'] };
  }

  // Generate unique base ID for this import batch
  const baseId = Date.now();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCSVLine(line);

    const name = values[nameIdx]?.replace(/"/g, '').trim();
    if (!name) {
      errors.push(`Row ${i + 1}: Missing name`);
      continue;
    }

    let gender = genderIdx !== -1 ? values[genderIdx]?.toLowerCase().trim() : 'male';
    if (!VALID_GENDERS.includes(gender)) {
      gender = 'male'; // Default to male if invalid
    }

    let level = levelIdx !== -1 ? values[levelIdx]?.trim() : 'Intermediate';
    // Case-insensitive level matching
    const matchedLevel = SKILL_LEVELS.find(l => l.toLowerCase() === level.toLowerCase());
    level = matchedLevel || 'Intermediate';

    // Generate unique ID using base timestamp + index
    players.push({
      id: baseId + i,
      name,
      gender,
      level
    });
  }

  return { players, errors };
};
