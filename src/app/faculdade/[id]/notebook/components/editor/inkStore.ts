'use client';

// Traços do caderno gravados por zonas da folha (tabela chapter_ink).
//
// Cada zona tem INK_REGION_H px de altura; um traço pertence à zona do seu
// primeiro ponto. Ao gravar, só vão as zonas que mudaram (os traços nunca são
// alterados no sítio: uma zona mudou se a lista de traços dela não é a mesma).
// Uma cópia de segurança fica no aparelho (IndexedDB) até o servidor confirmar.

import { supabase } from '@/lib/supabase';
import { deleteMirror, getAllMirror, putMirror } from '@/lib/offline/db';
import type { Stroke } from './DrawingCanvas';

export const INK_REGION_H = 2048;
// Tamanho máximo (aprox.) de cada pedido ao servidor.
const BATCH_BYTES = 1_500_000;
const TABLE = 'chapter_ink';
const BACKUP = 'ink_backup';

export const regionOf = (s: Stroke) => Math.max(0, Math.floor((s.points[0]?.y ?? 0) / INK_REGION_H));

// Ordem dos traços: a borracha só apaga o que veio antes, por isso a ordem conta.
// Os ids são "<Date.now()>-xxxxx"; os traços antigos sem id ficaram "old-<i>".
function orderKey(id: string): number {
  if (id.startsWith('old-')) return Number(id.slice(4)) || 0;
  const t = parseInt(id, 10);
  return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
}

export function sortStrokes(list: Stroke[]): Stroke[] {
  return list
    .map((s, i) => ({ s, i, k: orderKey(s.id) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.s);
}

function groupByRegion(strokes: Stroke[]): Map<number, Stroke[]> {
  const out = new Map<number, Stroke[]>();
  for (const s of strokes) {
    const r = regionOf(s);
    const list = out.get(r);
    if (list) list.push(s);
    else out.set(r, [s]);
  }
  return out;
}

const sameList = (a: Stroke[] | undefined, b: Stroke[] | undefined) =>
  (a?.length ?? 0) === (b?.length ?? 0) && (a ?? []).every((s, i) => s === b![i]);

function errText(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

// A tabela ainda não existe (o SQL supabase-chapter-ink.sql não foi corrido)?
export function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return e?.code === '42P01' || e?.code === 'PGRST205' || /chapter_ink/.test(e?.message || '');
}

export interface InkLoad {
  // false: tabela inexistente → usar chapters.drawing_data como antes.
  available: boolean;
  // null: o capítulo ainda não tem zonas gravadas (usar o desenho antigo e passá-lo para cá).
  strokes: Stroke[] | null;
  // Assinatura das zonas no servidor (para saber se mudaram noutro aparelho).
  signature: string;
}

export async function loadInk(chapterId: string): Promise<InkLoad> {
  const { data, error } = await supabase.from(TABLE).select('id, region, strokes, updated_at').eq('chapter_id', chapterId);
  if (error) {
    if (isMissingTable(error)) return { available: false, strokes: null, signature: '' };
    throw new Error(errText(error));
  }
  const rows = (data ?? []) as { id: string; region: number; strokes: Stroke[]; updated_at: string }[];
  if (rows.length === 0) return { available: true, strokes: null, signature: '' };
  const strokes = sortStrokes(rows.flatMap((r) => (Array.isArray(r.strokes) ? r.strokes : [])));
  const signature = rows
    .map((r) => `${r.region}@${r.updated_at}`)
    .sort()
    .join('|');
  return { available: true, strokes, signature };
}

// Grava só as zonas que mudaram desde a última gravação bem-sucedida.
export class InkSaver {
  private last = new Map<number, Stroke[]>();

  constructor(
    private chapterId: string,
    saved: Stroke[] | null
  ) {
    if (saved) this.last = groupByRegion(saved);
  }

  // Devolve os KB enviados (0 = nada mudou).
  async save(strokes: Stroke[]): Promise<number> {
    const now = groupByRegion(strokes);
    const regions = new Set<number>([...Array.from(now.keys()), ...Array.from(this.last.keys())]);
    const upserts: { region: number; list: Stroke[]; json: string }[] = [];
    const removed: number[] = [];
    for (const r of Array.from(regions)) {
      const list = now.get(r);
      if (sameList(list, this.last.get(r))) continue;
      if (!list || list.length === 0) removed.push(r);
      else upserts.push({ region: r, list, json: JSON.stringify(list) });
    }
    if (!upserts.length && !removed.length) return 0;

    // Em lotes de ~1,5 MB (um pedido gigante era o que fazia o servidor desistir).
    let bytes = 0;
    let batch: typeof upserts = [];
    let batchBytes = 0;
    const send = async () => {
      if (!batch.length) return;
      const stamp = new Date().toISOString();
      const rows = batch.map((u) => ({ id: `${this.chapterId}:${u.region}`, chapter_id: this.chapterId, region: u.region, strokes: u.list, updated_at: stamp }));
      const { error } = await supabase.from(TABLE).upsert(rows);
      if (error) throw new Error(`${errText(error)} · ${Math.round(batchBytes / 1024)} KB`);
      batch.forEach((u) => this.last.set(u.region, u.list));
      bytes += batchBytes;
      batch = [];
      batchBytes = 0;
    };
    for (const u of upserts) {
      if (batch.length && batchBytes + u.json.length > BATCH_BYTES) await send();
      batch.push(u);
      batchBytes += u.json.length;
    }
    await send();

    if (removed.length) {
      const { error } = await supabase
        .from(TABLE)
        .delete()
        .in(
          'id',
          removed.map((r) => `${this.chapterId}:${r}`)
        );
      if (error) throw new Error(errText(error));
      removed.forEach((r) => this.last.delete(r));
    }
    return Math.max(1, Math.round(bytes / 1024));
  }
}

// ==========================================
// CÓPIA DE SEGURANÇA NO APARELHO
// ==========================================
interface InkBackup {
  id: string;
  strokes: Stroke[];
  at: number;
}

export async function putInkBackup(chapterId: string, strokes: Stroke[]): Promise<void> {
  try {
    await putMirror<InkBackup>(BACKUP, { id: chapterId, strokes, at: Date.now() });
  } catch (err) {
    console.error('Não foi possível guardar a cópia local do desenho:', err);
  }
}

export async function readInkBackup(chapterId: string): Promise<InkBackup | null> {
  const all = await getAllMirror<InkBackup>(BACKUP);
  return all.find((b) => b.id === chapterId) ?? null;
}

export async function clearInkBackup(chapterId: string): Promise<void> {
  try {
    await deleteMirror(BACKUP, chapterId);
  } catch {
    // sem IndexedDB: nada a limpar
  }
}

// Assinatura atual das zonas no servidor (leve: sem os traços).
export async function inkSignature(chapterId: string): Promise<string | null> {
  const { data, error } = await supabase.from(TABLE).select('region, updated_at').eq('chapter_id', chapterId);
  if (error) return null;
  return ((data ?? []) as { region: number; updated_at: string }[])
    .map((r) => `${r.region}@${r.updated_at}`)
    .sort()
    .join('|');
}
