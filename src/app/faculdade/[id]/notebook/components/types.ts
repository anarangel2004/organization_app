export type NotebookTab = 'TEORICAS' | 'PRATICAS' | 'TESTES';
export type PaperStyle = 'PAUTADO' | 'QUADRICULA' | 'LISO';

export interface Chapter {
  id: string;
  subjectId: string;
  number: string;
  title: string;
  category: NotebookTab;
  content: string;
  drawingData?: string; // Traços da caneta (JSON)
  pdfUrl?: string;
  pdfName?: string;
  isCompleted?: boolean;
  createdAt?: string;
  updatedAt?: string; // ISO
}

// Alias para garantir compatibilidade caso algum componente use ChapterData
export type ChapterData = Chapter;

export type SyncStatus = 'synced' | 'saving' | 'error';
export type NoteMode = 'EDIT' | 'PREVIEW';
export type Tool = 'TEXT' | 'PEN' | 'HIGHLIGHTER' | 'ERASER' | 'LASSO';
export type EraserType = 'OBJECT' | 'AREA';

export const TABS: [NotebookTab, string][] = [
  ['TEORICAS', 'Teóricas'],
  ['PRATICAS', 'Práticas'],
  ['TESTES', 'Testes'],
];

export const PAPER_LABEL: Record<PaperStyle, string> = {
  PAUTADO: 'Pautado',
  QUADRICULA: 'Quadrícula',
  LISO: 'Liso',
};

// Tintas do design (caneta e marcador).
export const PEN_INKS: [string, string][] = [
  ['Tinta azul-escura', '#22324a'],
  ['Preto', '#1b1b1b'],
  ['Vermelho', '#b3261e'],
  ['Azul', '#2f5f78'],
];
export const MARKER_INKS: [string, string][] = [
  ['Amarelo', '#f6e27f'],
  ['Verde', '#bfe3c0'],
  ['Azul claro', '#cfe3ee'],
  ['Rosa', '#f3c6d3'],
];
// Espessura em px do traço (a folha tem 28px por linha).
export const PEN_WIDTHS: [string, number][] = [
  ['0.3 mm', 1.5],
  ['0.5 mm', 2.5],
  ['0.7 mm', 3.5],
];
// O marcador desenha com 3× este valor.
export const MARKER_WIDTHS: [string, number][] = [
  ['Fino', 2],
  ['Médio', 3],
  ['Largo', 4],
];

export interface OutlineItem {
  level: 2 | 3;
  text: string;
}

export interface EditorStats {
  words: number;
  line: number;
  col: number;
  heading: number; // índice no índice do capítulo; -1 = nenhum
}

export interface PdfDoc {
  id: string;
  title: string;
  url: string;
}

export interface NextAssessment {
  id: string;
  title: string;
  tag: string;
  due: Date;
  days: number;
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[0-9A-Za-zÀ-ÖØ-öø-ÿ]/.test(w)).length;
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function shortDay(d: Date): string {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

// "12:18" se for hoje, senão "24 out".
export function editedLabel(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (d.toDateString() === new Date().toDateString()) {
    return d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
  }
  return shortDay(d);
}

export function inDaysLabel(days: number): string {
  if (days <= 0) return 'hoje';
  if (days === 1) return 'amanhã';
  return `daqui a ${days} dias`;
}

export function assessmentTag(title: string): string {
  if (/exame/i.test(title)) return 'EXAME';
  if (/teste|frequ|quiz/i.test(title)) return 'TESTE';
  if (/projeto|projecto|trabalho|relat/i.test(title)) return 'ENTREGA';
  return 'PRAZO';
}

export function pdfPageFromHref(href: string | null): number | null {
  const m = href?.match(/page=(\d+)/);
  return m ? Number(m[1]) : null;
}
