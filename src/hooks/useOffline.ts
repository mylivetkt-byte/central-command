import { useState, useEffect, useCallback } from 'react';

const CACHE_PREFIX = 'gomoto-offline-';

export const useOffline = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const cacheData = useCallback(<T>(key: string, data: T) => {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
    } catch {}
  }, []);

  const getCachedData = useCallback(<T>(key: string): T | null => {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      return raw ? JSON.parse(raw) as T : null;
    } catch { return null; }
  }, []);

  return { isOffline, cacheData, getCachedData };
};
