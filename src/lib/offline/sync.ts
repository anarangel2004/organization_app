'use client';

import { createClient } from '@/lib/supabase';
import {
  getQueue,
  removeFromQueue,
  putMirror,
  deleteMirror,
  enqueueMutation,
  QueuedMutation,
} from './db';

type Listener = (pending: number) => void;

const listeners = new Set<Listener>();
let flushing = false;
let initialized = false;

/** Deteta falhas de rede (em vez de erros "normais" da aplicação/Supabase). */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true;
  const message = err instanceof Error ? err.message : String(err ?? '');
  return /fetch|network|failed to fetch/i.test(message);
}

async function notify(): Promise<void> {
  const queue = await getQueue();
  listeners.forEach((listener) => listener(queue.length));
}

export function subscribePendingCount(listener: Listener): () => void {
  listeners.add(listener);
  getQueue().then((q) => listener(q.length));
  return () => {
    listeners.delete(listener);
  };
}

/** Regista uma alteração feita offline e avisa quem estiver a ouvir a fila. */
export async function queueMutation(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>): Promise<void> {
  await enqueueMutation(mutation);
  await notify();
}

function remapReferences(
  payload: Record<string, unknown>,
  idMap: Map<string, string>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...payload };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (typeof value === 'string' && idMap.has(value)) {
      result[key] = idMap.get(value);
    }
  }
  return result;
}

/**
 * Processa a fila de alterações offline, pela ordem em que foram feitas.
 * Para na primeira falha de rede (tenta-se de novo mais tarde); erros
 * "definitivos" (ex: violação de uma regra na base de dados) descartam
 * essa alteração para não bloquear as seguintes.
 */
export async function flushQueue(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  flushing = true;
  try {
    const supabase = createClient();
    const idMap = new Map<string, string>();
    const queue = await getQueue();

    for (const mutation of queue) {
      try {
        const payload = remapReferences(mutation.payload, idMap);

        if (mutation.op === 'insert') {
          const { data, error } = await supabase
            .from(mutation.table)
            .insert(payload)
            .select('*')
            .single();
          if (error) throw error;
          if (mutation.tempId) {
            idMap.set(mutation.tempId, data.id);
            await deleteMirror(mutation.table, mutation.tempId);
          }
          await putMirror(mutation.table, data);
        } else if (mutation.op === 'update') {
          const targetId = (mutation.targetId && idMap.get(mutation.targetId)) ?? mutation.targetId;
          if (!targetId) throw new Error('Alteração offline sem alvo válido.');
          const { data, error } = await supabase
            .from(mutation.table)
            .update(payload)
            .eq('id', targetId)
            .select('*')
            .single();
          if (error) throw error;
          await putMirror(mutation.table, data);
        } else if (mutation.op === 'delete') {
          const targetId = (mutation.targetId && idMap.get(mutation.targetId)) ?? mutation.targetId;
          if (!targetId) throw new Error('Alteração offline sem alvo válido.');
          const { error } = await supabase.from(mutation.table).delete().eq('id', targetId);
          if (error) throw error;
          await deleteMirror(mutation.table, targetId);
        }

        if (mutation.id !== undefined) await removeFromQueue(mutation.id);
      } catch (err) {
        if (isNetworkError(err)) {
          // Perdeu-se a rede outra vez a meio da sincronização: pára aqui,
          // o resto da fila fica para a próxima tentativa.
          break;
        }
        console.error('Falha ao sincronizar alteração offline, a descartar:', mutation, err);
        if (mutation.id !== undefined) await removeFromQueue(mutation.id);
      }
    }
  } finally {
    flushing = false;
    await notify();
  }
}

/** Liga a sincronização automática assim que a app deteta que voltou a rede. */
export function initOfflineSync(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  window.addEventListener('online', () => {
    flushQueue();
  });
  if (navigator.onLine) {
    flushQueue();
  }
}
