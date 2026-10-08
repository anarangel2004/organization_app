// Preparação para um teste: capítulos do caderno escolhidos na avaliação
// (assessments.chapter_ids) e quantos já estão marcados como concluídos.

export interface PrepChapter {
  id: string | number;
  is_completed?: boolean | null;
}

export interface TestPrep {
  total: number;
  done: number;
  pct: number; // 0–100, arredondado
}

// chapter_ids vem do Supabase como lista (jsonb); aceita também texto JSON.
export function chapterIdsOf(raw: unknown): string[] {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return [];
    }
  }
  return Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
}

// null = ainda sem capítulos escolhidos. Capítulos que entretanto foram apagados não contam.
export function testPrep(raw: unknown, chapters: PrepChapter[]): TestPrep | null {
  const ids = new Set(chapterIdsOf(raw));
  if (ids.size === 0) return null;
  const chosen = chapters.filter((c) => ids.has(String(c.id)));
  if (chosen.length === 0) return null;
  const done = chosen.filter((c) => c.is_completed).length;
  return { total: chosen.length, done, pct: Math.round((done / chosen.length) * 100) };
}
