export interface EvaluationItem {
  id: string;
  name: string;
  weight: number;
  grade?: number;
}

export interface EvaluationData {
  theory_weight: number;
  practical_weight: number;
  tests: EvaluationItem[];
  projects: EvaluationItem[];
}

export interface Project {
  id: string;
  name: string;
  type: 'academic' | 'work' | string;
  color?: string;
  code?: string;
  semester?: string;
  context?: string | null;
  evaluation_data?: EvaluationData;
  created_at?: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  due_date?: string | null;
  project_id?: string | null;
  category?: 'academic' | 'work' | 'general' | string | null;
  context?: 'academic' | 'work' | 'general' | 'faculdade' | 'trabalho' | string | null;
  priority?: 'low' | 'medium' | 'high' | string | null;
  created_at?: string;
}

const DB_NAME = 'HubPWA_DB';
const DB_VERSION = 3;

export const DEFAULT_PROJECTS: Project[] = [];
export const DEFAULT_TASKS: Task[] = [];

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject('SSR');

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('projects')) {
        const store = db.createObjectStore('projects', { keyPath: 'id' });
        DEFAULT_PROJECTS.forEach((p) => store.add(p));
      }
      if (!db.objectStoreNames.contains('tasks')) {
        const taskStore = db.createObjectStore('tasks', { keyPath: 'id' });
        DEFAULT_TASKS.forEach((t) => taskStore.add(t));
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/* ================= PROJETOS / UCS ================= */

export async function getProjects(type?: string): Promise<Project[]> {
  try {
    const db = await initDB();
    const projects: Project[] = await new Promise((resolve) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.getAll();

      req.onsuccess = () => {
        if (req.result && req.result.length > 0) {
          resolve(req.result);
        } else {
          resolve(DEFAULT_PROJECTS);
        }
      };
      req.onerror = () => resolve(DEFAULT_PROJECTS);
    });

    if (type) {
      return projects.filter((p) => p.type === type || p.context === type);
    }
    return projects;
  } catch {
    if (type) {
      return DEFAULT_PROJECTS.filter((p) => p.type === type || p.context === type);
    }
    return DEFAULT_PROJECTS;
  }
}

export async function getProjectById(id: string): Promise<Project | null> {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction('projects', 'readonly');
      const store = tx.objectStore('projects');
      const req = store.get(id);

      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result);
        } else {
          const match = DEFAULT_PROJECTS.find((p) => p.id === id);
          resolve(match || null);
        }
      };
      req.onerror = () => {
        const match = DEFAULT_PROJECTS.find((p) => p.id === id);
        resolve(match || null);
      };
    });
  } catch {
    return DEFAULT_PROJECTS.find((p) => p.id === id) || null;
  }
}

export async function createProject(data: Partial<Project> & { name: string }): Promise<Project> {
  const newProject: Project = {
    id: data.id || crypto.randomUUID(),
    name: data.name,
    type: data.type || 'academic',
    color: data.color || '#0ea5e9',
    code: data.code || '',
    semester: data.semester || '1º Semestre',
    context: data.context || null,
    evaluation_data: data.evaluation_data || {
      theory_weight: 50,
      practical_weight: 50,
      tests: [],
      projects: []
    },
    created_at: new Date().toISOString()
  };

  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.add(newProject);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao criar projeto no IndexedDB:', err);
  }

  return newProject;
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<Project> {
  const current = (await getProjectById(id)) || {
    id,
    name: 'Cadeira',
    type: 'academic' as const,
    evaluation_data: { theory_weight: 50, practical_weight: 50, tests: [], projects: [] }
  };

  const updated: Project = { ...current, ...updates };

  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.put(updated);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao atualizar no IndexedDB:', err);
  }

  return updated;
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.objectStore('projects');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao apagar projeto no IndexedDB:', err);
  }
}

/* ================= TAREFAS ================= */

export async function getTasks(filter?: string): Promise<Task[]> {
  try {
    const db = await initDB();
    const tasks: Task[] = await new Promise((resolve) => {
      const tx = db.transaction('tasks', 'readonly');
      const store = tx.objectStore('tasks');
      const req = store.getAll();

      req.onsuccess = () => {
        if (req.result && req.result.length > 0) {
          resolve(req.result);
        } else {
          resolve(DEFAULT_TASKS);
        }
      };
      req.onerror = () => resolve(DEFAULT_TASKS);
    });

    if (filter) {
      return tasks.filter(
        (t) => t.category === filter || t.context === filter || t.project_id === filter
      );
    }
    return tasks;
  } catch {
    if (filter) {
      return DEFAULT_TASKS.filter(
        (t) => t.category === filter || t.context === filter || t.project_id === filter
      );
    }
    return DEFAULT_TASKS;
  }
}

export async function createTask(data: Partial<Task> & { title: string }): Promise<Task> {
  const newTask: Task = {
    id: data.id || crypto.randomUUID(),
    title: data.title,
    completed: data.completed ?? false,
    due_date: data.due_date ?? null,
    project_id: data.project_id ?? null,
    category: data.category || 'general',
    context: data.context || data.category || 'general',
    priority: data.priority || 'medium',
    created_at: new Date().toISOString()
  };

  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const req = store.add(newTask);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao criar tarefa no IndexedDB:', err);
  }

  return newTask;
}

export async function toggleTaskStatus(id: string, newStatus?: boolean): Promise<Task | null> {
  try {
    const db = await initDB();
    return new Promise((resolve) => {
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const req = store.get(id);

      req.onsuccess = () => {
        const task: Task = req.result;
        if (task) {
          task.completed = typeof newStatus === 'boolean' ? newStatus : !task.completed;
          store.put(task);
          resolve(task);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteTask(id: string): Promise<void> {
  try {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Erro ao apagar tarefa no IndexedDB:', err);
  }
}