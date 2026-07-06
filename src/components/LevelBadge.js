import React from 'react';

// Level badge colors for dark and light modes
const LEVEL_COLORS_DARK = {
  Expert: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  Advanced: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  Intermediate: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  Novice: 'bg-green-500/20 text-green-400 border-green-500/30'
};

const LEVEL_COLORS_LIGHT = {
  Expert: 'bg-purple-100 text-purple-700 border-purple-400',
  Advanced: 'bg-orange-100 text-orange-700 border-orange-400',
  Intermediate: 'bg-cyan-100 text-cyan-700 border-cyan-400',
  Novice: 'bg-green-100 text-green-700 border-green-400'
};

/**
 * Badge component displaying player skill level
 * @param {Object} props
 * @param {string} props.level - Player skill level
 * @param {boolean} props.isDarkMode - Theme mode
 */
const LevelBadge = ({ level, isDarkMode = true }) => {
  const colors = isDarkMode ? LEVEL_COLORS_DARK : LEVEL_COLORS_LIGHT;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${colors[level]}`}>
      {level}
    </span>
  );
};

export default LevelBadge;
