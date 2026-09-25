'use client';

/**
 * Camada de armazenamento local (IndexedDB) para suporte offline.
 *
 * Guarda dois tipos de coisas:
 *  - `mirror`: a última cópia conhecida de cada linha de cada tabela,
 *    usada para responder pedidos de leitura quando não há rede.
 *  - `queue`: alterações (inserir/atualizar/eliminar) feitas offline,
 *    à espera de serem sincronizadas com o Supabase assim que a rede voltar.
 */

const DB_NAME = 'atelier-offline';
const DB_VERSION = 1;
const MIRROR_STORE = 'mirror';
const QUEUE_STORE = 'queue';

export type MutationOp = 'insert' | 'update' | 'delete';

export interface QueuedMutation {
  id?: number;
  table: string;
  op: MutationOp;
  /** id temporário local, quando a mutação é um insert feito offline */
  tempId?: string;
  /** id real (ou tempId a resolver) alvo de um update/delete */
  targetId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

interface MirrorRecord<T> {
  key: string;
  table: string;
  id: string;
  data: T;
}

function hasIndexedDB(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDB()) {
      reject(new Error('IndexedDB indisponível neste ambiente.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MIRROR_STORE)) {
        db.createObjectStore(MIRROR_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Gera um id local, usado como placeholder até a linha ser criada no servidor. */
export function generateLocalId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isLocalId(id: string): boolean {
  return id.startsWith('local-');
}

export async function putMirror<T extends { id: string | number }>(table: string, row: T): Promise<void> {
  const db = await openDB();
  const id = String(row.id);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MIRROR_STORE, 'readwrite');
    const record: MirrorRecord<T> = { key: `${table}:${id}`, table, id, data: row };
    tx.objectStore(MIRROR_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteMirror(table: string, id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MIRROR_STORE, 'readwrite');
    tx.objectStore(MIRROR_STORE).delete(`${table}:${id}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllMirror<T>(table: string): Promise<T[]> {
  if (!hasIndexedDB()) return [];
  try {
    const db = await openDB();
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(MIRROR_STORE, 'readonly');
      const range = IDBKeyRange.bound(`${table}:`, `${table}:￿`);
      const req = tx.objectStore(MIRROR_STORE).getAll(range);
      req.onsuccess = () => resolve((req.result as MirrorRecord<T>[]).map((r) => r.data));
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Erro ao ler cache offline:', err);
    return [];
  }
}

/** Guarda várias linhas no espelho local sem apagar outras já lá existentes
 *  (usa-se quando o pedido ao servidor é parcial, ex: filtrado por disciplina). */
export async function putAllMirror<T extends { id: string | number }>(table: string, rows: T[]): Promise<void> {
  for (const row of rows) {
    await putMirror(table, row);
  }
}

/**
 * Atualiza o espelho local de uma tabela com dados vindos do servidor,
 * sem apagar linhas que ainda têm alterações locais por sincronizar.
 */
export async function reconcileMirror<T extends { id: string | number }>(table: string, freshRows: T[]): Promise<void> {
  if (!hasIndexedDB()) return;
  try {
    const queue = await getQueue();
    const protectedIds = new Set(
      queue
        .filter((m) => m.table === table)
        .map((m) => m.tempId ?? m.targetId)
        .filter((v): v is string => Boolean(v))
    );
    const freshIds = new Set(freshRows.map((r) => String(r.id)));
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(MIRROR_STORE, 'readwrite');
      const store = tx.objectStore(MIRROR_STORE);
      const range = IDBKeyRange.bound(`${table}:`, `${table}:￿`);
      const cursorReq = store.openCursor(range);
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const rec = cursor.value as MirrorRecord<T>;
          if (!freshIds.has(rec.id) && !protectedIds.has(rec.id)) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    for (const row of freshRows) {
      await putMirror(table, row);
    }
  } catch (err) {
    console.error('Erro ao reconciliar cache offline:', err);
  }
}

export async function enqueueMutation(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).add({ ...mutation, createdAt: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueue(): Promise<QueuedMutation[]> {
  if (!hasIndexedDB()) return [];
  try {
    const db = await openDB();
    return await new Promise<QueuedMutation[]>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const req = tx.objectStore(QUEUE_STORE).getAll();
      req.onsuccess = () => resolve(req.result as QueuedMutation[]);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Erro ao ler fila offline:', err);
    return [];
  }
}

export async function removeFromQueue(id: number): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
