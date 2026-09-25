'use client';

import { useCallback, useEffect, useState } from 'react';

// Estado persistido em localStorage, só neste browser. Usado para o que
// ainda não tem tabela no Supabase (notas efémeras, eventos do calendário,
// tempo de foco, modo de visualização). Lê depois de montar para não
// divergir do HTML do servidor, e tolera storage bloqueado.
export function useLocalState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratação a partir do storage após montar
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // storage indisponível ou valor corrompido: fica o valor inicial
    }
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // sem persistência, mas o estado em memória continua a funcionar
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update];
}

// Relógio que re-renderiza a cada `intervalMs`.
export function useNow(intervalMs: number): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
