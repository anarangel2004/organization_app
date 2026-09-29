'use client';

import { useState, type ReactNode } from 'react';
import d from './denso.module.css';

// Peças comuns aos formulários densos (painéis laterais da Faculdade, disciplinas e Trabalho).

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className={d.field}>
      <span className={d.fieldLabel}>{label}</span>
      {children}
      {hint && <span className={d.hint}>{hint}</span>}
    </label>
  );
}

// Botão de apagar em dois toques: o primeiro pede confirmação, o segundo apaga.
export function DeleteButton({ onConfirm, label = 'Apagar' }: { onConfirm: () => void; label?: string }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`${d.btnGhost} ${d.sm}`}
      style={armed ? { color: '#e38b7a', borderColor: '#e38b7a' } : undefined}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      onBlur={() => setArmed(false)}
    >
      {armed ? 'Confirmar?' : label}
    </button>
  );
}

// Linha de estado no fundo de cada editor ("Guardado", erros, sem rede).
export type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'saved'; offline?: boolean } | { kind: 'error'; message: string };

export function SaveStatus({ state }: { state: SaveState }) {
  if (state.kind === 'idle') return null;
  const text =
    state.kind === 'saving'
      ? 'A guardar…'
      : state.kind === 'saved'
        ? state.offline
          ? 'Guardado neste dispositivo — sincroniza quando houver rede.'
          : 'Guardado.'
        : `Erro: ${state.message}`;
  return (
    <span role="status" style={{ fontSize: 12, color: state.kind === 'error' ? '#e38b7a' : state.kind === 'saved' ? 'var(--sky)' : 'var(--mut)' }}>
      {text}
    </span>
  );
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return 'erro desconhecido';
}
