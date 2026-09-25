import { createClient } from '@/lib/supabase';
import { getAllMirror, putMirror, deleteMirror, reconcileMirror, generateLocalId } from '@/lib/offline/db';
import { queueMutation, isNetworkError } from '@/lib/offline/sync';

/**
 * Camada de dados do módulo de Trabalho (Projetos & Tarefas SAP).
 *
 * Usa tabelas Supabase (`work_projects`, `work_tasks`) como fonte de
 * verdade, com um espelho local em IndexedDB (`lib/offline`) para
 * continuar a funcionar sem rede: leituras caem para a última cópia
 * conhecida, e escritas feitas offline ficam numa fila e são
 * sincronizadas automaticamente assim que a ligação voltar.
 */

export interface WorkProject {
  id: string;
  name: string;
  color: string;
  created_at?: string;
}

export interface WorkTask {
  id: string;
  title: string;
  completed: boolean;
  due_date: string | null;
  project_id: string | null;
  created_at?: string;
}

const TABLE_PROJECTS = 'work_projects';
const TABLE_TASKS = 'work_tasks';

export async function getWorkProjects(): Promise<WorkProject[]> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from(TABLE_PROJECTS)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = data ?? [];
    await reconcileMirror(TABLE_PROJECTS, rows);
    return rows;
  } catch (err) {
    if (isNetworkError(err)) return getAllMirror<WorkProject>(TABLE_PROJECTS);
    throw err;
  }
}

export async function createWorkProject(input: {
  name: string;
  color?: string;
}): Promise<WorkProject> {
  const supabase = createClient();
  const payload = { name: input.name, color: input.color ?? '#10b981' };

  try {
    const { data, error } = await supabase
      .from(TABLE_PROJECTS)
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    await putMirror(TABLE_PROJECTS, data);
    return data;
  } catch (err) {
    if (!isNetworkError(err)) throw err;

    const optimistic: WorkProject = {
      id: generateLocalId(),
      created_at: new Date().toISOString(),
      ...payload,
    };
    await putMirror(TABLE_PROJECTS, optimistic);
    await queueMutation({ table: TABLE_PROJECTS, op: 'insert', tempId: optimistic.id, payload });
    return optimistic;
  }
}

export async function deleteWorkProject(id: string): Promise<void> {
  const supabase = createClient();
  try {
    const { error } = await supabase.from(TABLE_PROJECTS).delete().eq('id', id);
    if (error) throw error;
    await deleteMirror(TABLE_PROJECTS, id);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    await deleteMirror(TABLE_PROJECTS, id);
    await queueMutation({ table: TABLE_PROJECTS, op: 'delete', targetId: id, payload: {} });
  }
}

export async function getWorkTasks(): Promise<WorkTask[]> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from(TABLE_TASKS)
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const rows = data ?? [];
    await reconcileMirror(TABLE_TASKS, rows);
    return rows;
  } catch (err) {
    if (isNetworkError(err)) return getAllMirror<WorkTask>(TABLE_TASKS);
    throw err;
  }
}

export async function createWorkTask(input: {
  title: string;
  project_id?: string | null;
  due_date?: string | null;
}): Promise<WorkTask> {
  const supabase = createClient();
  const payload = {
    title: input.title,
    project_id: input.project_id ?? null,
    due_date: input.due_date ?? null,
    completed: false,
  };

  try {
    const { data, error } = await supabase
      .from(TABLE_TASKS)
      .insert(payload)
      .select('*')
      .single();

    if (error) throw error;
    await putMirror(TABLE_TASKS, data);
    return data;
  } catch (err) {
    if (!isNetworkError(err)) throw err;

    const optimistic: WorkTask = {
      id: generateLocalId(),
      created_at: new Date().toISOString(),
      ...payload,
    };
    await putMirror(TABLE_TASKS, optimistic);
    await queueMutation({ table: TABLE_TASKS, op: 'insert', tempId: optimistic.id, payload });
    return optimistic;
  }
}

export async function toggleWorkTask(id: string, completed: boolean): Promise<void> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase
      .from(TABLE_TASKS)
      .update({ completed })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    await putMirror(TABLE_TASKS, data);
  } catch (err) {
    if (!isNetworkError(err)) throw err;

    const cached = (await getAllMirror<WorkTask>(TABLE_TASKS)).find((t) => t.id === id);
    if (cached) await putMirror(TABLE_TASKS, { ...cached, completed });
    await queueMutation({ table: TABLE_TASKS, op: 'update', targetId: id, payload: { completed } });
  }
}

export async function deleteWorkTask(id: string): Promise<void> {
  const supabase = createClient();
  try {
    const { error } = await supabase.from(TABLE_TASKS).delete().eq('id', id);
    if (error) throw error;
    await deleteMirror(TABLE_TASKS, id);
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    await deleteMirror(TABLE_TASKS, id);
    await queueMutation({ table: TABLE_TASKS, op: 'delete', targetId: id, payload: {} });
  }
}
