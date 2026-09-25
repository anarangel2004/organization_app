'use client';

import { useOfflineStatus } from '@/lib/offline/useOfflineStatus';

/**
 * Aviso discreto, fixo no fundo do ecrã, sobre o estado da ligação e de
 * quaisquer alterações feitas offline que ainda não foram sincronizadas.
 * Não mostra nada quando está tudo online e sincronizado.
 */
export default function OfflineIndicator() {
  const { isOnline, pending } = useOfflineStatus();

  if (isOnline && pending === 0) return null;

  const label = !isOnline
    ? pending > 0
      ? `Sem ligação — ${pending} alteração${pending === 1 ? '' : 'ões'} pendente${pending === 1 ? '' : 's'}`
      : 'Sem ligação — modo offline'
    : `A sincronizar ${pending} alteração${pending === 1 ? '' : 'ões'}…`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 pointer-events-none">
      <div
        role="status"
        className={`pointer-events-auto flex items-center gap-2 border-2 border-[#111111] px-4 py-2 font-mono text-xs uppercase tracking-wide shadow-[3px_3px_0_0_#111111] ${
          isOnline ? 'bg-amber-200 text-[#111111]' : 'bg-[#111111] text-[#FCF9F2]'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${isOnline ? 'animate-pulse bg-amber-600' : 'bg-red-500'}`}
          aria-hidden="true"
        />
        {label}
      </div>
    </div>
  );
}
