import { VALID_GENDERS, SKILL_LEVELS } from '../data/initialData';

/**
 * Export players to CSV (including id and fingerprint template) and download.
 * @param {Array} players - player objects
 * @param {Object} fingerprints - map { [playerId]: { template, player } }
 */
export const exportPlayersToCSV = (players, fingerprints = {}) => {
  const headers = ['id', 'name', 'gender', 'level', 'fingerprint'];
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;

  const csvContent = [
    headers.join(','),
    ...players.map(p => {
      const entry = fingerprints[p.id] || fingerprints[String(p.id)];
      const template = entry && entry.template ? entry.template : '';
      return [
        p.id,
        esc(p.name),
        p.gender,
        p.level,
        esc(template)
      ].join(',');
    })
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
 * Parse a CSV line handling quoted values (with "" escaping).
 */
const parseCSVLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } // escaped quote
      else inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map(v => v.trim());
};

/**
 * Parse CSV text into players and fingerprints.
 * Recognizes optional 'id' and 'fingerprint' columns; when present, the id is
 * preserved and the fingerprint template is loaded so it can be used immediately.
 * @returns {Object} { players, fingerprints, errors }
 *   fingerprints: map { [playerId]: { template, player } }
 */
export const parsePlayersCSV = (text) => {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const errors = [];
  const players = [];
  const fingerprints = {};

  if (lines.length < 2) {
    return { players: [], fingerprints: {}, errors: ['CSV file is empty or has no data rows'] };
  }

  const header = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const idIdx = header.indexOf('id');
  const nameIdx = header.indexOf('name');
  const genderIdx = header.indexOf('gender');
  const levelIdx = header.indexOf('level');
  const fpIdx = header.indexOf('fingerprint');

  if (nameIdx === -1) {
    return { players: [], fingerprints: {}, errors: ['CSV must have a "name" column'] };
  }

  const baseId = Date.now();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = parseCSVLine(line);

    const name = values[nameIdx]?.replace(/^"|"$/g, '').trim();
    if (!name) {
      errors.push(`Row ${i + 1}: Missing name`);
      continue;
    }

    let gender = genderIdx !== -1 ? values[genderIdx]?.toLowerCase().trim() : 'male';
    if (!VALID_GENDERS.includes(gender)) gender = 'male';

    let level = levelIdx !== -1 ? values[levelIdx]?.trim() : 'Intermediate';
    const matchedLevel = SKILL_LEVELS.find(l => l.toLowerCase() === level.toLowerCase());
    level = matchedLevel || 'Intermediate';

    // Preserve id from the file when present (keeps fingerprints keyed correctly),
    // otherwise generate a unique one.
    let id = baseId + i;
    if (idIdx !== -1) {
      const raw = values[idIdx]?.trim();
      if (raw) {
        const num = parseInt(raw, 10);
        id = Number.isNaN(num) ? raw : num;
      }
    }

    const player = { id, name, gender, level };
    players.push(player);

    if (fpIdx !== -1) {
      const template = values[fpIdx]?.trim();
      if (template) {
        fingerprints[id] = { template, player: { id, name, gender, level } };
      }
    }
  }

  return { players, fingerprints, errors };
};
