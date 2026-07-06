import { useState, useEffect } from 'react';

/**
 * Custom hook that returns current time and updates every minute
 * Used for wait time and court time display
 * @returns {number} Current timestamp
 */
const useCurrentTime = () => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  return currentTime;
};

export default useCurrentTime;
