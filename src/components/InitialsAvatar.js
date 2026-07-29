import React from 'react';

/**
 * Small initials circle for a player. Gender is carried by the tint:
 * blue = male, pink = female.
 * @param {Object} props
 * @param {Object} props.player - { name, gender }
 * @param {string} [props.size] - Tailwind size classes (default w-6 h-6)
 */
const getInitials = (name = '') => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const InitialsAvatar = ({ player, size = 'w-6 h-6 text-[10px]' }) => (
  <span
    className={`${size} rounded-full flex-shrink-0 inline-flex items-center justify-center font-medium ${
      player.gender === 'male'
        ? 'bg-blue-500/15 text-blue-300'
        : 'bg-pink-500/15 text-pink-300'
    }`}
    title={player.gender === 'male' ? 'Male' : 'Female'}
  >
    {getInitials(player.name)}
  </span>
);

export default InitialsAvatar;
