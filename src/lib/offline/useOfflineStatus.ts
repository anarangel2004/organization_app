'use client';

import { useEffect, useState } from 'react';
import { subscribePendingCount, initOfflineSync } from './sync';

export interface OfflineStatus {
  isOnline: boolean;
  pending: number;
}

/** Estado de ligação + nº de alterações à espera de sincronizar. */
export function useOfflineStatus(): OfflineStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    initOfflineSync();

    const unsubscribe = subscribePendingCount(setPending);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, pending };
}
