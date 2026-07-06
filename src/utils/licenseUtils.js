/**
 * License Utilities for BADDIXX CueMii App
 * 
 * License keys are encrypted strings that decode to: "baddixx-YYYY-MM-DD-pXXX"
 * Where:
 *   - YYYY = 4-digit year
 *   - MM = 2-digit month
 *   - DD = 2-digit day
 *   - XXX = maximum number of players allowed (1-999)
 */

const LICENSE_STORAGE_KEY = 'baddixx_license';

/**
 * Decode a license key
 * @param {string} encodedKey - The encoded license key
 * @returns {string|null} - The decoded string or null if invalid
 */
const decodeLicenseKey = (encodedKey) => {
  try {
    // Decode the license key
    const decoded = atob(encodedKey.trim());
    return decoded;
  } catch (e) {
    return null;
  }
};

/**
 * Encode a license string (for generating license keys)
 * @param {string} licenseString - The license string to encode
 * @returns {string} - The encoded license key
 */
export const encodeLicenseKey = (licenseString) => {
  return btoa(licenseString.trim().toLowerCase());
};

/**
 * Validate and parse a license key
 * @param {string} licenseKey - The encoded license key to validate
 * @returns {object} - { isValid, expirationDate, maxPlayers, error }
 */
export const validateLicense = (licenseKey) => {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return { isValid: false, error: 'License key is required' };
  }

  const trimmedKey = licenseKey.trim();
  
  // Override: Special day pass license
  if (trimmedKey === '0067006700') {
    const today = new Date();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    return {
      isValid: true,
      expirationDate: endOfDay,
      maxPlayers: 500,
      rawKey: trimmedKey
    };
  }
  
  // Decode the license key
  const decodedString = decodeLicenseKey(trimmedKey);
  
  if (!decodedString) {
    return { isValid: false, error: 'Invalid license key' };
  }

  // Validate the decoded format: baddixx-YYYY-MM-DD-pXXX
  const regex = /^baddixx-(\d{4})-(\d{2})-(\d{2})-p(\d{1,3})$/;
  const match = decodedString.toLowerCase().match(regex);
  
  if (!match) {
    return { isValid: false, error: 'Invalid license key' };
  }

  const [, year, month, day, players] = match;
  const yearNum = parseInt(year, 10);
  const monthNum = parseInt(month, 10);
  const dayNum = parseInt(day, 10);
  const maxPlayers = parseInt(players, 10);

  // Validate date components
  if (monthNum < 1 || monthNum > 12) {
    return { isValid: false, error: 'Invalid license key' };
  }
  if (dayNum < 1 || dayNum > 31) {
    return { isValid: false, error: 'Invalid license key' };
  }
  if (maxPlayers < 1 || maxPlayers > 999) {
    return { isValid: false, error: 'Invalid license key' };
  }

  // Create expiration date (end of day)
  const expirationDate = new Date(yearNum, monthNum - 1, dayNum, 23, 59, 59, 999);
  
  // Check if date is valid
  if (isNaN(expirationDate.getTime())) {
    return { isValid: false, error: 'Invalid license key' };
  }

  return {
    isValid: true,
    expirationDate,
    maxPlayers,
    rawKey: trimmedKey
  };
};

/**
 * Check if a license is expired
 * @param {Date} expirationDate - The expiration date
 * @returns {boolean} - true if expired
 */
export const isLicenseExpired = (expirationDate) => {
  if (!expirationDate) return true;
  return new Date() > expirationDate;
};

/**
 * Get days until license expiration
 * @param {Date} expirationDate - The expiration date
 * @returns {number} - Days until expiration (negative if expired)
 */
export const getDaysUntilExpiration = (expirationDate) => {
  if (!expirationDate) return -1;
  const now = new Date();
  const diffTime = expirationDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Save license to localStorage
 * @param {string} licenseKey - The license key to save
 */
export const saveLicense = (licenseKey) => {
  try {
    localStorage.setItem(LICENSE_STORAGE_KEY, licenseKey.trim());
    return true;
  } catch (e) {
    console.error('Failed to save license:', e);
    return false;
  }
};

/**
 * Load license from localStorage
 * @returns {string|null} - The stored license key or null
 */
export const loadLicense = () => {
  try {
    return localStorage.getItem(LICENSE_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to load license:', e);
    return null;
  }
};

/**
 * Clear license from localStorage
 */
export const clearLicense = () => {
  try {
    localStorage.removeItem(LICENSE_STORAGE_KEY);
    return true;
  } catch (e) {
    console.error('Failed to clear license:', e);
    return false;
  }
};

/**
 * Format expiration date for display
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
export const formatExpirationDate = (date) => {
  if (!date) return 'N/A';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Get license status text and color
 * @param {Date} expirationDate - The expiration date
 * @returns {object} - { text, colorClass }
 */
export const getLicenseStatus = (expirationDate) => {
  const daysLeft = getDaysUntilExpiration(expirationDate);
  
  if (daysLeft < 0) {
    return { text: 'EXPIRED', colorClass: 'text-red-500' };
  }
  if (daysLeft === 0) {
    return { text: 'EXPIRES TODAY', colorClass: 'text-red-500' };
  }
  if (daysLeft <= 7) {
    return { text: `EXPIRING SOON (${daysLeft} days)`, colorClass: 'text-red-400' };
  }
  if (daysLeft <= 30) {
    return { text: `${daysLeft} days remaining`, colorClass: 'text-amber-400' };
  }
  return { text: 'ACTIVE', colorClass: 'text-emerald-400' };
};

export default {
  validateLicense,
  isLicenseExpired,
  getDaysUntilExpiration,
  saveLicense,
  loadLicense,
  clearLicense,
  formatExpirationDate,
  getLicenseStatus,
  encodeLicenseKey
};
