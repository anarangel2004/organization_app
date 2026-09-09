import { createClient } from '@/lib/supabase';

// --- Tipos de Dados ---

export interface EvaluationData {
  theory_weight: number;
  practical_weight: number;
  tests: Array<{ id: string; name: string; weight: number; grade?: number }>;
  projects: Array<{ id: string; name: string; weight: number; grade?: number }>;
  attendance?: {
    required_percentage: number;
    total_classes: number;
    attended_classes: number;
  };
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  color: string;
  context: 'academic' | 'work';
  evaluation_data?: EvaluationData;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  due_date: string | null;
  completed: boolean;
  context: 'academic' | 'work';
  created_at: string;
}

export interface Note {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  content: string;
  updated_at: string;
  created_at: string;
}

// --- Funções CRUD: Projetos / Cadeiras ---

export async function getProjects(context?: 'academic' | 'work') {
  const supabase = createClient();
  let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
  
  if (context) {
    query = query.eq('context', context);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Project[];
}

export async function getProjectById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Project;
}

export async function createProject(project: Omit<Project, 'id' | 'user_id' | 'created_at'>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilizador não autenticado');

  const { data, error } = await supabase
    .from('projects')
    .insert([{ ...project, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function updateProject(id: string, updates: Partial<Omit<Project, 'id' | 'user_id' | 'created_at'>>) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function deleteProject(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

// --- Funções CRUD: Tarefas ---

export async function getTasks(projectId?: string) {
  const supabase = createClient();
  let query = supabase.from('tasks').select('*').order('due_date', { ascending: true });

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Task[];
}

export async function createTask(task: Omit<Task, 'id' | 'user_id' | 'created_at'>) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilizador não autenticado');

  const { data, error } = await supabase
    .from('tasks')
    .insert([{ ...task, user_id: user.id }])
    .select()
    .single();

  if (error) throw error;
  return data as Task;
}

export async function toggleTaskStatus(id: string, completed: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('tasks')
    .update({ completed })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Task;
}

export async function deleteTask(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) throw error;
}