import { createClient } from '@/lib/supabase';

/**
 * Camada de dados do módulo de Trabalho (Projetos & Tarefas SAP).
 *
 * Substitui o antigo `lib/db.ts` (IndexedDB local, por browser) por
 * tabelas Supabase (`work_projects`, `work_tasks`), para os dados
 * sincronizarem entre dispositivos e teres backup. Ver
 * `supabase-migration-work-module.sql` para criar as tabelas.
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

export async function getWorkProjects(): Promise<WorkProject[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('work_projects')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createWorkProject(input: {
  name: string;
  color?: string;
}): Promise<WorkProject> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('work_projects')
    .insert({ name: input.name, color: input.color ?? '#10b981' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWorkProject(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('work_projects').delete().eq('id', id);
  if (error) throw error;
}

export async function getWorkTasks(): Promise<WorkTask[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('work_tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createWorkTask(input: {
  title: string;
  project_id?: string | null;
  due_date?: string | null;
}): Promise<WorkTask> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('work_tasks')
    .insert({
      title: input.title,
      project_id: input.project_id ?? null,
      due_date: input.due_date ?? null,
      completed: false,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function toggleWorkTask(id: string, completed: boolean): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('work_tasks').update({ completed }).eq('id', id);
  if (error) throw error;
}

export async function deleteWorkTask(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('work_tasks').delete().eq('id', id);
  if (error) throw error;
}
