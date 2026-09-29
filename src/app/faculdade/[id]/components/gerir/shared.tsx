'use client';

import { supabase } from '@/lib/supabase';
import { getAllMirror, putMirror } from '@/lib/offline/db';
import { queueMutation, isNetworkError } from '@/lib/offline/sync';

export { DeleteButton, Field, SaveStatus, errorMessage, type SaveState } from '@/app/components/denso/DensoForm';

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
