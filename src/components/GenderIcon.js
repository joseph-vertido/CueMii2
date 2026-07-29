import React from 'react';

/**
 * Icon component displaying gender symbol.
 * @param {Object} props
 * @param {string} props.gender - 'male' or 'female'
 */
const GenderIcon = ({ gender }) => (
  <span className={`text-base leading-none ${gender === 'male' ? 'text-blue-400' : 'text-pink-400'}`}>
    {gender === 'male' ? '♂' : '♀'}
  </span>
);

export default GenderIcon;
