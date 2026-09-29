'use client';

import { useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { getAllMirror, putMirror } from '@/lib/offline/db';
import { queueMutation, isNetworkError } from '@/lib/offline/sync';
import d from '@/app/components/denso/denso.module.css';

// Peças comuns aos editores do painel "Gerir" (horário, avaliação, biblioteca).

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

// Atualiza colunas da disciplina. Sem rede: guarda no espelho local e põe na fila.
// Devolve true se ficou só offline.
export async function updateSubject(subjectId: string, patch: Record<string, unknown>): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('subjects').update(patch).eq('id', subjectId).select('id');
    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('o Supabase não atualizou nenhuma linha (verifica as permissões RLS da tabela subjects).');
    }
    return false;
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const cached = (await getAllMirror<Record<string, unknown> & { id: string }>('subjects')).find((s) => String(s.id) === subjectId);
    if (cached) await putMirror('subjects', { ...cached, ...patch });
    await queueMutation({ table: 'subjects', op: 'update', targetId: subjectId, payload: patch });
    return true;
  }
}
