import { useState, useEffect } from 'react';

/**
 * Custom hook that syncs state with localStorage
 * @param {string} key - localStorage key
 * @param {any} initialValue - Default value if nothing in storage
 * @returns {[any, Function]} - State value and setter function
 */
const useLocalStorage = (key, initialValue) => {
  // Get initial value from localStorage or use default
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  // Update localStorage when state changes
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
};

export default useLocalStorage;
