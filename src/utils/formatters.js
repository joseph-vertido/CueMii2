/**
 * Format wait time from joinedAt timestamp
 * @param {number} joinedAt - Timestamp when player joined
 * @returns {string} Formatted wait time (e.g., "5m" or "1h+" for over 1 hour)
 */
export const formatWaitTime = (joinedAt) => {
  if (!joinedAt) return '0m';
  const diff = Math.floor((Date.now() - joinedAt) / 1000 / 60);
  if (diff >= 60) return '1h+';
  return `${diff}m`;
};

/**
 * Get color class for wait time
 * @param {number} joinedAt - Timestamp when player joined
 * @returns {string} Tailwind color class
 */
export const getWaitTimeColor = (joinedAt) => {
  if (!joinedAt) return 'text-slate-500';
  const diff = Math.floor((Date.now() - joinedAt) / 1000 / 60);
  if (diff < 10) return 'text-slate-400';      // 0-10 minutes: gray
  if (diff < 25) return 'text-emerald-400';    // 10-25 minutes: green
  if (diff < 40) return 'text-yellow-400';     // 25-40 minutes: yellow
  return 'text-red-400';                        // 40+ minutes: red
};

/**
 * Get color class for wait time (light mode)
 * @param {number} joinedAt - Timestamp when player joined
 * @returns {string} Tailwind color class
 */
export const getWaitTimeColorLight = (joinedAt) => {
  if (!joinedAt) return 'text-slate-600';
  const diff = Math.floor((Date.now() - joinedAt) / 1000 / 60);
  if (diff < 10) return 'text-slate-600';      // 0-10 minutes: gray
  if (diff < 25) return 'text-emerald-600';    // 10-25 minutes: green
  if (diff < 40) return 'text-yellow-600';     // 25-40 minutes: yellow
  return 'text-red-600';                        // 40+ minutes: red
};

/**
 * Format court time from startTime timestamp
 * @param {number} startTime - Timestamp when match started
 * @param {number} currentTime - Current timestamp
 * @returns {string} Formatted court time (e.g., "5m" or "1h+" for over 1 hour)
 */
export const formatCourtTime = (startTime, currentTime) => {
  if (!startTime) return '';
  const diff = Math.floor((currentTime - startTime) / 1000 / 60);
  if (diff >= 60) return '1h+';
  return `${diff}m`;
};
