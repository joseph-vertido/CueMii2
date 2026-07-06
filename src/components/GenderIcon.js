import React from 'react';

/**
 * Icon component displaying gender symbol
 * @param {Object} props
 * @param {string} props.gender - 'male' or 'female'
 */
const GenderIcon = ({ gender }) => (
  <span className={`text-lg ${gender === 'male' ? 'text-blue-300' : 'text-pink-300'}`}>
    {gender === 'male' ? '♂' : '♀'}
  </span>
);

export default GenderIcon;
