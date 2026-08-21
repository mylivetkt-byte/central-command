import { useState, useEffect, useCallback, useRef } from 'react';

const CACHE_PREFIX = 'gomoto-offline-';
const QUEUE_KEY = 'gomoto-offline-queue';

export interface QueuedAction {
  id: string;
  type: string;
  payload: any;
  ts: number;
  attempts: number;
}

type Handler = (action: QueuedAction) => Promise<void>;

export const useOffline = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);
  const handlerRef = useRef<Handler | null>(null);
  const flushingRef = useRef(false);

  const readQueue = (): QueuedAction[] => {
    try {
      const raw = localStorage.getItem(QUEUE_KEY);
      return raw ? (JSON.parse(raw) as QueuedAction[]) : [];
    } catch { return []; }
  };
  const writeQueue = (q: QueuedAction[]) => {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
    setQueueSize(q.length);
  };

  useEffect(() => { setQueueSize(readQueue().length); }, []);

  const enqueue = useCallback((type: string, payload: any) => {
    const q = readQueue();
    q.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, payload, ts: Date.now(), attempts: 0 });
    writeQueue(q);
  }, []);

  const registerHandler = useCallback((h: Handler) => { handlerRef.current = h; }, []);

  const flushQueue = useCallback(async () => {
    if (flushingRef.current || !handlerRef.current) return;
    flushingRef.current = true;
    try {
      let q = readQueue();
      const remaining: QueuedAction[] = [];
      for (const action of q) {
        try {
          await handlerRef.current(action);
        } catch {
          remaining.push({ ...action, attempts: action.attempts + 1 });
        }
      }
      writeQueue(remaining);
    } finally {
      flushingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const on = () => { setIsOffline(false); flushQueue(); };
    const off = () => setIsOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [flushQueue]);

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

  return { isOffline, queueSize, cacheData, getCachedData, enqueue, flushQueue, registerHandler };
};
