'use client';

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { formatRelativeDate, getItemEffectiveGrade } from '@/lib/utils';
import type { AssessmentItem } from '@/types';
import ProfileModal from '@/components/ui/ProfileModal';
import d from '@/app/components/denso/denso.module.css';
import { DensoHeader, SearchHit } from '@/app/components/denso/DensoChrome';
import { useLocalState } from '@/app/components/painel/useLocalState';
import { parseDueDate } from '@/app/components/homeAgenda';
import { FAC_TONES } from '@/app/faculdade/components/FaculdadeDenso';
import {
  FileRow,
  MONTHS_LONG,
  WEEKDAY_LONG,
  daysBetween,
  startOfDay,
  toLibDoc,
} from '@/app/faculdade/[id]/components/disciplinaData';

import c from './components/caderno.module.css';
import {
  Chapter,
  EditorStats,
  NextAssessment,
  NoteMode,
  NotebookTab,
  OutlineItem,
  PaperStyle,
  PdfDoc,
  SyncStatus,
  TABS,
  assessmentTag,
  htmlToText,
} from './components/types';
import { ContextBar, MenuBar, MenuDef, StatusBar, StudyInfo, SubjectChip } from './components/CadernoBars';
import { ManualSessionDialog } from './components/ManualSessionDialog';
import { fmtStudy, loadStudySettings, useStudyTimer } from '@/lib/study';
import { classSlots, isInClass, type ClassRange } from '@/lib/studyPath';
import { planPeriod } from '@/lib/studyPlan';
import { ChapterSidebar } from './components/ChapterSidebar';
import { FormatState, NotesLayout, NotesPane, NotesPaneRef, ZOOM_MAX, ZOOM_MIN } from './components/NotesPane';
import { TableSizeDialog } from './components/TableMenu';
import { PdfPane } from './components/PdfPane';
import { OptionsSheet, PdfSheet, PhoneBar, PhoneFormatBar, TabletBars, syncText } from './components/TouchBars';

// Arranjo do ecrã: computador (rato/teclado) ou os três dos designs táteis.
type Device = 'desktop' | 'phone' | 'tablet-v' | 'tablet-h';

// ?device=iphone|ipad-v|ipad-h força um arranjo (útil para testar no computador).
const DEVICE_PARAM: Record<string, Device> = {
  iphone: 'phone',
  'ipad-v': 'tablet-v',
  'ipad-h': 'tablet-h',
  desktop: 'desktop',
};

function detectDevice(): Device {
  // Ecrã tátil como entrada principal (iPad, iPhone); portáteis com ecrã tátil ficam no arranjo de computador.
  const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  if (!touch) return 'desktop';
  if (Math.min(window.innerWidth, window.innerHeight) < 600) return 'phone';
  return window.innerHeight >= window.innerWidth ? 'tablet-v' : 'tablet-h';
}

interface SubjectRow {
  id: string;
  code: string | null;
  name: string | null;
  schedules?: unknown;
}

interface ChapterDbRow {
  id: string;
  subject_id: string;
  number: string | number | null;
  title: string | null;
  category: string | null;
  content: string | null;
  drawing_data?: string | null;
  drawing?: string | null;
  pdf_url: string | null;
  pdf_name: string | null;
  is_completed: boolean | null;
  created_at: string;
  updated_at: string | null;
}

const SIDE_W = 210;
const SAVE_DELAY = 700;

function toTab(raw: string | null | undefined): NotebookTab {
  const t = (raw || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return t === 'PRATICAS' || t === 'TESTES' ? t : 'TEORICAS';
}

// Só estas categorias são cadernos. Outras linhas da tabela (ex.: "Programa",
// o programa da cadeira importado à parte) não são capítulos e ficam de fora.
// Último capítulo usado em cada disciplina (e em cada aba), neste aparelho.
interface LastChapter {
  chapter: string;
  byTab: Partial<Record<NotebookTab, string>>;
}
const lastKey = (subjectId: string) => `caderno:ultimo:${subjectId}`;
function readLast(subjectId: string): LastChapter | null {
  try {
    const raw = window.localStorage.getItem(lastKey(subjectId));
    const v = raw ? (JSON.parse(raw) as LastChapter) : null;
    return v && typeof v.chapter === 'string' ? { chapter: v.chapter, byTab: v.byTab ?? {} } : null;
  } catch {
    return null;
  }
}
function writeLast(subjectId: string, tab: NotebookTab, chapter: string) {
  try {
    const prev = readLast(subjectId);
    const next: LastChapter = { chapter, byTab: { ...(prev?.byTab ?? {}), [tab]: chapter } };
    window.localStorage.setItem(lastKey(subjectId), JSON.stringify(next));
  } catch {
    // Sem armazenamento (navegação privada): abre no primeiro capítulo, como antes.
  }
}

function isNotebookRow(row: ChapterDbRow): boolean {
  const t = (row.category || '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return t === 'TEORICAS' || t === 'PRATICAS' || t === 'TESTES';
}

function toChapter(row: ChapterDbRow): Chapter {
  return {
    id: String(row.id),
    subjectId: String(row.subject_id),
    number: String(row.number ?? '1').padStart(2, '0'),
    title: row.title || '',
    category: toTab(row.category),
    content: row.content || '',
    drawingData: row.drawing_data || row.drawing || '',
    pdfUrl: row.pdf_url || undefined,
    pdfName: row.pdf_name || undefined,
    isCompleted: Boolean(row.is_completed),
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function fold(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function NotebookContent({ subjectId }: { subjectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useCurrentUser();

  const urlTab = toTab(searchParams.get('tab'));
  const urlChapter = searchParams.get('chapter');

  // ==========================================
  // DADOS
  // ==========================================
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [assessments, setAssessments] = useState<AssessmentItem[]>([]);
  const [files, setFiles] = useState<FileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [subj, chaps, assess, fileRows] = await Promise.all([
        supabase.from('subjects').select('id, code, name, schedules'),
        supabase.from('chapters').select('*').eq('subject_id', subjectId).order('created_at', { ascending: true }),
        supabase.from('assessments').select('*').eq('subject_id', subjectId),
        supabase.from('subject_files').select('*').eq('subject_id', subjectId).order('created_at', { ascending: false }),
      ]);
      if (chaps.error) throw chaps.error;
      setSubjects(((subj.data ?? []) as SubjectRow[]).map((s) => ({ ...s, id: String(s.id) })));
      setChapters(((chaps.data ?? []) as ChapterDbRow[]).filter(isNotebookRow).map(toChapter));
      setAssessments((assess.data ?? []) as AssessmentItem[]);
      setFiles((fileRows.data ?? []) as FileRow[]);
    } catch (err) {
      console.error('Erro ao carregar o caderno:', err);
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar o caderno.');
    } finally {
      setLoading(false);
    }
  }, [subjectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pedido inicial de dados
    load();
  }, [load]);

  // ==========================================
  // ESTADO DA VISTA
  // ==========================================
  const [tab, setTab] = useState<NotebookTab>(urlTab);
  const [selectedId, setSelectedId] = useState<string>(urlChapter || '');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [mode, setMode] = useState<NoteMode>('EDIT');
  const [sync, setSync] = useState<SyncStatus>('synced');
  const [uploading, setUploading] = useState(false);
  const [pdfPage, setPdfPage] = useState(1);
  const [focusMode, setFocusMode] = useState(false);
  const [stats, setStats] = useState<EditorStats>({ words: 0, line: 1, col: 1, heading: -1 });
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [deviceLabel, setDeviceLabel] = useState('Computador');
  const [detectedDevice, setDetectedDevice] = useState<Device>('desktop');
  const device: Device = DEVICE_PARAM[searchParams.get('device') || ''] ?? detectedDevice;
  const touch = device !== 'desktop';
  const tablet = device === 'tablet-v' || device === 'tablet-h';
  const [format, setFormat] = useState<FormatState>({ block: 'p', bold: false, italic: false });
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pdfSheetOpen, setPdfSheetOpen] = useState(false);
  // Divisão notas/PDF no iPad, em % para as notas (vertical: em cima; horizontal: à esquerda).
  const [splitV, setSplitV] = useLocalState('caderno:splitV', 58);
  const [splitH, setSplitH] = useLocalState('caderno:splitH', 50);

  // Preferências deste browser.
  const [paper, setPaper] = useLocalState<PaperStyle>('caderno:paper', 'PAUTADO');
  const [sideOpen, setSideOpen] = useLocalState('caderno:side', true);
  const [splitOpen, setSplitOpen] = useLocalState('caderno:split', false);
  const [splitWidth, setSplitWidth] = useLocalState('caderno:splitWidth', 560);
  const [follow, setFollow] = useLocalState('caderno:follow', true);
  const [zoom, setZoom] = useLocalState('caderno:zoom', 1);

  const notesRef = useRef<NotesPaneRef>(null);
  // Janela "Inserir → Tabela…" (computador).
  const [tableDialog, setTableDialog] = useState(false);
  const globalSearchRef = useRef<HTMLInputElement>(null);
  const chapterSearchRef = useRef<HTMLInputElement>(null);
  const pdfSelectRef = useRef<HTMLSelectElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // O URL manda no volume e no capítulo (links da pesquisa, voltar atrás).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- acompanhar o URL
    setTab(urlTab);
  }, [urlTab]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- acompanhar o URL
    if (urlChapter) setSelectedId(urlChapter);
  }, [urlChapter]);

  // Plataforma, dispositivo e largura só se conhecem no cliente.
  useEffect(() => {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deteção só possível no cliente
    setIsMac(mac);
    setDeviceLabel(touch ? (/iPad|Macintosh/.test(navigator.userAgent) ? 'iPad ligado' : 'Tablet ligado') : 'Computador');
    const mq = window.matchMedia('(max-width: 899px)');
    const onMq = () => {
      setNarrow(mq.matches);
      setDetectedDevice(detectDevice());
    };
    onMq();
    mq.addEventListener('change', onMq);
    // Rodar o iPad troca entre o arranjo vertical e o horizontal.
    window.addEventListener('resize', onMq);
    return () => {
      mq.removeEventListener('change', onMq);
      window.removeEventListener('resize', onMq);
    };
  }, []);

  // No telemóvel e no iPad a lateral abre por cima da folha e não mexe na preferência guardada.
  const drawerMode = narrow || touch;
  const [mobileSide, setMobileSide] = useState(false);
  const openSide = useCallback(() => (drawerMode ? setMobileSide(true) : setSideOpen(true)), [drawerMode, setSideOpen]);

  // ==========================================
  // DERIVADOS
  // ==========================================
  const today = useMemo(() => startOfDay(new Date()), []);

  const subjectChips = useMemo<SubjectChip[]>(
    () =>
      [...subjects]
        .sort((a, b) => (a.code || a.name || '').localeCompare(b.code || b.name || ''))
        .map((s, i) => ({
          id: s.id,
          code: s.code || (s.name || '?').slice(0, 3).toUpperCase(),
          name: s.name || s.code || 'Disciplina',
          dot: FAC_TONES[i]?.bg ?? '#7fb0cb',
        })),
    [subjects]
  );

  const inTab = useMemo(() => chapters.filter((ch) => ch.category === tab), [chapters, tab]);
  const active = inTab.find((ch) => ch.id === selectedId) ?? inTab[0];

  // Abrir no último capítulo usado nesta disciplina (guardado neste aparelho),
  // a não ser que o endereço diga outro (links da pesquisa, do /estudo…).
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || loading || chapters.length === 0) return;
    restoredRef.current = true;
    if (searchParams.get('chapter') || searchParams.get('tab')) return;
    const last = readLast(subjectId);
    const ch = last && chapters.find((x) => x.id === last.chapter);
    if (!ch) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- repor o último capítulo depois de carregar
    setTab(ch.category);
    setSelectedId(ch.id);
  }, [loading, chapters, searchParams, subjectId]);
  useEffect(() => {
    if (!restoredRef.current || !active || active.id.startsWith('temp-')) return;
    writeLast(subjectId, active.category, active.id);
  }, [active, subjectId]);

  const visibleChapters = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return inTab;
    return inTab.filter((ch) => fold(`${ch.number} ${ch.title} ${htmlToText(ch.content)}`).includes(q));
  }, [inTab, query]);

  const libraryPdfs = useMemo<PdfDoc[]>(
    () =>
      files
        .map(toLibDoc)
        .filter((doc) => doc.type === 'PDF' && doc.url)
        .map((doc) => ({ id: doc.id, title: doc.title, url: doc.url })),
    [files]
  );

  const nextAssessment = useMemo<NextAssessment | null>(() => {
    const next = assessments
      .filter((a) => getItemEffectiveGrade(a) === null)
      .map((a) => ({ a, due: parseDueDate(a.due_date) }))
      .filter((r): r is { a: AssessmentItem; due: Date } => r.due !== null && r.due >= today)
      .sort((x, y) => x.due.getTime() - y.due.getTime())[0];
    if (!next) return null;
    const title = next.a.title || 'Avaliação';
    return { id: next.a.id, title, tag: assessmentTag(title), due: next.due, days: daysBetween(today, next.due) };
  }, [assessments, today]);

  const linkedPages = useMemo(() => {
    const set = new Set<number>();
    for (const m of (active?.content || '').matchAll(/page=(\d+)/g)) set.add(Number(m[1]));
    return set;
  }, [active?.content]);

  const subject = subjects.find((s) => s.id === subjectId);

  // ==========================================
  // CONTADOR DE ESTUDO (só tempo ativo; guarda por capítulo)
  // ==========================================
  // Durante a aula desta disciplina (pelo horário e dentro do período de aulas) o contador não conta.
  const [classRange, setClassRange] = useState<ClassRange>({ start: null, end: null });
  useEffect(() => {
    let alive = true;
    loadStudySettings().then(({ settings }) => {
      if (!alive) return;
      const period = planPeriod(settings, new Date());
      setClassRange({ start: period.usingDefaults ? null : period.start, end: period.usingDefaults ? null : period.classesEnd });
    });
    return () => {
      alive = false;
    };
  }, []);
  const mySlots = useMemo(() => classSlots(subjects.find((x) => x.id === subjectId)?.schedules), [subjects, subjectId]);
  const inClass = useCallback(() => isInClass(mySlots, new Date(), classRange), [mySlots, classRange]);
  const studyTimer = useStudyTimer(subjectId, active?.id ?? null, inClass);
  const [manualOpen, setManualOpen] = useState(false);
  const study: StudyInfo = {
    state: studyTimer.state,
    todaySec: studyTimer.todaySec,
    sessionSec: studyTimer.sessionSec,
    onPause: studyTimer.pause,
    onResume: studyTimer.resume,
    onAdd: () => setManualOpen(true),
  };
  const tabLabel = TABS.find(([id]) => id === tab)?.[1] ?? 'Teóricas';
  const showSide = drawerMode ? mobileSide : sideOpen && !focusMode;
  // No iPhone o PDF abre numa folha que sobe de baixo, nunca lado a lado.
  const showSplit = splitOpen && !focusMode && device !== 'phone';

  // Ao mudar de capítulo, o PDF volta à primeira página referida (ou à 1).
  useEffect(() => {
    const first = active?.content.match(/page=(\d+)/);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- página inicial do PDF do capítulo aberto
    setPdfPage(first ? Number(first[1]) : 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando muda o capítulo ou o PDF
  }, [active?.id, active?.pdfUrl]);

  // ==========================================
  // GRAVAR (com atraso, para não gravar a cada tecla)
  // ==========================================
  const pendingRef = useRef<Map<string, Record<string, unknown>>>(new Map());
  const timerRef = useRef<number | null>(null);

  const flush = useCallback(async () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    const entries = Array.from(pendingRef.current.entries()).filter(([id]) => !id.startsWith('temp-'));
    entries.forEach(([id]) => pendingRef.current.delete(id));
    if (entries.length === 0) return;
    const now = new Date().toISOString();
    const results = await Promise.all(
      entries.map(([id, patch]) => supabase.from('chapters').update({ ...patch, updated_at: now }).eq('id', id))
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) console.error('Erro ao guardar o capítulo:', failed.error);
    setSync(failed ? 'error' : pendingRef.current.size ? 'saving' : 'synced');
  }, []);

  const queueSave = useCallback(
    (id: string, patch: Record<string, unknown>, local: Partial<Chapter>) => {
      const now = new Date().toISOString();
      setChapters((prev) => prev.map((ch) => (ch.id === id ? { ...ch, ...local, updatedAt: now } : ch)));
      pendingRef.current.set(id, { ...(pendingRef.current.get(id) || {}), ...patch });
      setSync('saving');
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(flush, SAVE_DELAY);
    },
    [flush]
  );

  // Não perder o que falta gravar ao sair ou esconder o separador.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  // ==========================================
  // ATUALIZAR: grava o que falta e volta a ler o caderno do servidor
  // (o que foi escrito noutro aparelho aparece aqui).
  // ==========================================
  const [revision, setRevision] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  });

  const refresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      notesRef.current?.flushInk();
      await flush();
      const [chaps, assess, fileRows] = await Promise.all([
        supabase.from('chapters').select('*').eq('subject_id', subjectId).order('created_at', { ascending: true }),
        supabase.from('assessments').select('*').eq('subject_id', subjectId),
        supabase.from('subject_files').select('*').eq('subject_id', subjectId).order('created_at', { ascending: false }),
      ]);
      if (chaps.error) throw chaps.error;
      const fresh = ((chaps.data ?? []) as ChapterDbRow[]).filter(isNotebookRow).map(toChapter);
      // O que se escreveu durante o pedido ainda não foi gravado: fica o local.
      const pending = pendingRef.current;
      setChapters((prev) =>
        fresh
          .map((ch) => (pending.has(ch.id) ? (prev.find((p) => p.id === ch.id) ?? ch) : ch))
          .concat(prev.filter((p) => p.id.startsWith('temp-')))
      );
      if (!assess.error) setAssessments((assess.data ?? []) as AssessmentItem[]);
      if (!fileRows.error) setFiles((fileRows.data ?? []) as FileRow[]);
      // A folha aberta só volta a ser lida se mudou noutro sítio (assim não se perde o desfazer).
      const local = activeRef.current;
      const server = local ? fresh.find((ch) => ch.id === local.id) : undefined;
      if (local && server && !pending.has(local.id) && (server.content !== local.content || server.drawingData !== local.drawingData)) {
        setRevision((r) => r + 1);
      }
      setSync(pendingRef.current.size ? 'saving' : 'synced');
    } catch (err) {
      console.error('Erro ao atualizar o caderno:', err);
      setSync('error');
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [flush, subjectId]);

  // Voltar à app (ou à rede): atualiza sozinho.
  useEffect(() => {
    const onShow = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onOnline = () => void refresh();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('online', onOnline);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('online', onOnline);
    };
  }, [refresh]);

  // ==========================================
  // AÇÕES
  // ==========================================
  const selectChapter = useCallback(
    (id: string) => {
      setSelectedId(id);
      setMobileSide(false);
    },
    []
  );

  const changeTab = useCallback(
    (next: NotebookTab) => {
      setTab(next);
      // Na aba nova, volta ao último capítulo que lá se usou.
      setSelectedId(readLast(subjectId)?.byTab[next] ?? '');
      setCreating(false);
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', next);
      params.delete('chapter');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, subjectId]
  );

  const hrefFor = useCallback((id: string) => `/faculdade/${id}/notebook?tab=${tab}`, [tab]);

  const switchSubject = useCallback(
    (dir: 1 | -1) => {
      if (subjectChips.length < 2) return;
      const i = subjectChips.findIndex((s) => s.id === subjectId);
      const next = subjectChips[(i + dir + subjectChips.length) % subjectChips.length];
      flush();
      router.push(hrefFor(next.id));
    },
    [flush, hrefFor, router, subjectChips, subjectId]
  );

  const startCreate = useCallback(() => {
    setFocusMode(false);
    openSide();
    setCreating(true);
  }, [openSide]);

  const createChapter = useCallback(
    async (rawTitle: string) => {
      setCreating(false);
      const title = rawTitle || 'Novo capítulo';
      const highest = inTab.reduce((n, ch) => Math.max(n, parseInt(ch.number, 10) || 0), 0);
      const number = String(highest + 1).padStart(2, '0');
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      setChapters((prev) => [
        ...prev,
        { id: tempId, subjectId, number, title, category: tab, content: '', drawingData: '', isCompleted: false, createdAt: now, updatedAt: now },
      ]);
      setSelectedId(tempId);

      const { data, error } = await supabase
        .from('chapters')
        .insert([{ subject_id: subjectId, number, title, category: tab, content: '', drawing_data: '', is_completed: false }])
        .select()
        .single();

      if (error || !data) {
        console.error('Erro ao criar capítulo:', error);
        setChapters((prev) => prev.filter((ch) => ch.id !== tempId));
        setSync('error');
        window.alert(`Não foi possível criar o capítulo: ${error?.message ?? 'erro desconhecido'}`);
        return;
      }
      const realId = String(data.id);
      // O que se escreveu entretanto passa para o id verdadeiro.
      const pending = pendingRef.current.get(tempId);
      pendingRef.current.delete(tempId);
      if (pending) pendingRef.current.set(realId, pending);
      setChapters((prev) => prev.map((ch) => (ch.id === tempId ? { ...ch, id: realId } : ch)));
      setSelectedId((cur) => (cur === tempId ? realId : cur));
      if (pending) flush();
    },
    [flush, inTab, subjectId, tab]
  );

  const deleteChapter = useCallback(
    async (ch: Chapter) => {
      if (!window.confirm(`Apagar o capítulo "${ch.title || 'Sem título'}"? Isto não se pode desfazer.`)) return;
      pendingRef.current.delete(ch.id);
      const { error } = await supabase.from('chapters').delete().eq('id', ch.id);
      if (error) {
        window.alert(`Não foi possível apagar: ${error.message}`);
        return;
      }
      setChapters((prev) => prev.filter((x) => x.id !== ch.id));
      if (selectedId === ch.id) setSelectedId('');
    },
    [selectedId]
  );

  const toggleCompleted = useCallback(() => {
    if (!active) return;
    queueSave(active.id, { is_completed: !active.isCompleted }, { isCompleted: !active.isCompleted });
  }, [active, queueSave]);

  const exportPdf = useCallback(() => {
    flush();
    // A folha é cortada em páginas por nós; sem folha aberta, impressão normal.
    if (!notesRef.current?.printPages()) window.print();
  }, [flush]);

  const setPdf = useCallback(
    (url: string | null, name: string | null) => {
      if (!active) return;
      queueSave(active.id, { pdf_url: url, pdf_name: name }, { pdfUrl: url || undefined, pdfName: name || undefined });
      setPdfPage(1);
    },
    [active, queueSave]
  );

  const uploadPdf = useCallback(
    async (file: File) => {
      if (!active) return;
      setUploading(true);
      try {
        const path = `${subjectId}/${active.id}-${Date.now()}.pdf`;
        const { error } = await supabase.storage.from('notebook-pdfs').upload(path, file);
        if (error) throw error;
        const { data } = supabase.storage.from('notebook-pdfs').getPublicUrl(path);
        setPdf(data.publicUrl, file.name);
        setSplitOpen(true);
      } catch (err) {
        console.error('Erro ao carregar o PDF:', err);
        window.alert(`Não foi possível carregar o PDF: ${err instanceof Error ? err.message : 'erro desconhecido'}`);
      } finally {
        setUploading(false);
      }
    },
    [active, setPdf, setSplitOpen, subjectId]
  );

  const removePdf = useCallback(() => {
    if (!active) return;
    const html = notesRef.current?.unwrapPageRefs() ?? active.content;
    queueSave(
      active.id,
      { pdf_url: null, pdf_name: null, content: html },
      { pdfUrl: undefined, pdfName: undefined, content: html }
    );
  }, [active, queueSave]);

  const openRef = useCallback(
    (page: number) => {
      setFocusMode(false);
      setPdfPage(page);
      if (device === 'phone') setPdfSheetOpen(true);
      else setSplitOpen(true);
    },
    [device, setSplitOpen]
  );

  const caretRef = useCallback(
    (page: number) => {
      if (follow && showSplit && active?.pdfUrl) setPdfPage(page);
    },
    [active?.pdfUrl, follow, showSplit]
  );

  const changeZoom = useCallback(
    (delta: number) => setZoom((z) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((z + delta) * 10) / 10))),
    [setZoom]
  );

  const toggleSide = useCallback(() => {
    if (drawerMode) {
      setMobileSide((v) => !v);
      return;
    }
    setFocusMode(false);
    setSideOpen((v) => (focusMode ? true : !v));
  }, [drawerMode, focusMode, setSideOpen]);

  const toggleSplit = useCallback(() => {
    setFocusMode(false);
    setSplitOpen((v) => (focusMode ? true : !v));
  }, [focusMode, setSplitOpen]);

  const openPdfPicker = useCallback(() => {
    setFocusMode(false);
    if (device === 'phone') {
      setPdfSheetOpen(true);
      return;
    }
    setSplitOpen(true);
    window.setTimeout(() => pdfSelectRef.current?.focus(), 50);
  }, [device, setSplitOpen]);

  const focusChapterSearch = useCallback(() => {
    setFocusMode(false);
    openSide();
    window.setTimeout(() => chapterSearchRef.current?.focus(), 30);
  }, [openSide]);

  // ==========================================
  // ATALHOS DE TECLADO
  // ==========================================
  const keys = useCallback(
    (combo: string) =>
      isMac
        ? combo.replace(/mod\+/g, '⌘').replace(/alt\+/g, '⌥').replace(/shift\+/g, '⇧')
        : combo.replace(/mod\+/g, 'Ctrl+').replace(/alt\+/g, 'Alt+').replace(/shift\+/g, 'Shift+'),
    [isMac]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      const notes = notesRef.current;

      if (mod && e.shiftKey && !e.altKey) {
        const block = e.code === 'Digit1' ? 'h2' : e.code === 'Digit2' ? 'h3' : e.code === 'Digit0' ? 'p' : null;
        if (block && notes) {
          e.preventDefault();
          notes.block(block);
        } else if (e.code === 'KeyF' && notes) {
          e.preventDefault();
          notes.replace();
        }
        return;
      }
      if (mod && !e.altKey) {
        const k = e.key.toLowerCase();
        const run: Record<string, () => void> = {
          j: toggleSide,
          '\\': toggleSplit,
          '[': () => switchSubject(-1),
          ']': () => switchSubject(1),
          e: exportPdf,
          f: focusChapterSearch,
          '.': () => setFocusMode((v) => !v),
          '=': () => changeZoom(0.1),
          '+': () => changeZoom(0.1),
          '-': () => changeZoom(-0.1),
        };
        if (k === 'r' && notes && active) run.r = () => notes.insertRef();
        if (k === 'k') run.k = notes?.isEditorFocused() ? () => notes.insertLink() : () => globalSearchRef.current?.focus();
        if (run[k]) {
          e.preventDefault();
          run[k]();
        }
        return;
      }
      if (e.altKey && !mod && e.code === 'KeyN') {
        e.preventDefault();
        startCreate();
        return;
      }
      if (!typing && !e.altKey && e.key === '/') {
        e.preventDefault();
        focusChapterSearch();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, changeZoom, exportPdf, focusChapterSearch, startCreate, switchSubject, toggleSide, toggleSplit]);

  // ==========================================
  // MENUS
  // ==========================================
  const noChapter = !active;
  const textOnly = noChapter || mode !== 'EDIT';
  const menus: MenuDef[] = [
    {
      label: 'Ficheiro',
      items: [
        { label: 'Novo capítulo', keys: keys('alt+N'), onClick: startCreate },
        { label: 'Exportar PDF', keys: keys('mod+E'), onClick: exportPdf, disabled: noChapter },
        { label: active?.isCompleted ? 'Desmarcar concluído' : 'Marcar concluído', onClick: toggleCompleted, disabled: noChapter },
        { label: 'Apagar capítulo…', onClick: () => active && deleteChapter(active), disabled: noChapter },
      ],
    },
    {
      label: 'Editar',
      items: [
        { label: 'Desfazer', keys: keys('mod+Z'), onClick: () => notesRef.current?.undo(), disabled: textOnly },
        { label: 'Refazer', keys: keys('mod+shift+Z'), onClick: () => notesRef.current?.redo(), disabled: textOnly },
        { label: 'Procurar', keys: keys('mod+F'), onClick: focusChapterSearch },
        { label: 'Substituir', keys: keys('mod+shift+F'), onClick: () => notesRef.current?.replace(), disabled: textOnly },
      ],
    },
    {
      label: 'Formatar',
      items: [
        { label: 'Título', keys: keys('mod+shift+1'), onClick: () => notesRef.current?.block('h2'), disabled: textOnly },
        { label: 'Subtítulo', keys: keys('mod+shift+2'), onClick: () => notesRef.current?.block('h3'), disabled: textOnly },
        { label: 'Normal', keys: keys('mod+shift+0'), onClick: () => notesRef.current?.block('p'), disabled: textOnly },
        { label: 'Negrito', keys: keys('mod+B'), onClick: () => notesRef.current?.exec('bold'), disabled: textOnly },
        { label: 'Itálico', keys: keys('mod+I'), onClick: () => notesRef.current?.exec('italic'), disabled: textOnly },
      ],
    },
    {
      label: 'Inserir',
      items: [
        { label: 'PDF de consulta…', onClick: openPdfPicker, disabled: noChapter },
        { label: 'Referência a página do PDF', keys: keys('mod+R'), onClick: () => notesRef.current?.insertRef(), disabled: textOnly },
        { label: 'Checklist', onClick: () => notesRef.current?.insertChecklist(), disabled: textOnly },
        { label: 'Tabela…', onClick: () => setTableDialog(true), disabled: textOnly },
        { label: 'Link', keys: keys('mod+K'), onClick: () => notesRef.current?.insertLink(), disabled: textOnly },
        { label: 'Imagem', onClick: () => notesRef.current?.insertImage(), disabled: textOnly },
      ],
    },
    {
      label: 'Ver',
      items: [
        { label: showSplit ? 'Fechar split view' : 'Split view', keys: keys('mod+\\'), onClick: toggleSplit },
        { label: showSide ? 'Esconder capítulos' : 'Capítulos (lateral)', keys: keys('mod+J'), onClick: toggleSide },
        { label: focusMode ? 'Sair do modo foco' : 'Modo foco', keys: keys('mod+.'), onClick: () => setFocusMode((v) => !v) },
        { label: 'Aumentar zoom', keys: keys('mod+='), onClick: () => changeZoom(0.1) },
        { label: 'Diminuir zoom', keys: keys('mod+-'), onClick: () => changeZoom(-0.1) },
      ],
    },
    {
      label: 'Estudo',
      items: [
        {
          label: study.state === 'paused' ? `Retomar contagem (hoje ${fmtStudy(study.todaySec)})` : `Pausar contagem (hoje ${fmtStudy(study.todaySec)})`,
          onClick: study.state === 'paused' ? study.onResume : study.onPause,
        },
        { label: '+ Sessão de estudo feita fora da app…', onClick: study.onAdd },
      ],
    },
  ];

  // ==========================================
  // DIVISOR DO SPLIT VIEW
  // ==========================================
  const onDividerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onDividerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !bodyRef.current) return;
    const rect = bodyRef.current.getBoundingClientRect();
    const max = rect.width - (showSide ? SIDE_W : 0) - 360;
    setSplitWidth(Math.round(Math.max(300, Math.min(max, rect.right - e.clientX - 5))));
  };
  const onDividerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
  };

  // ==========================================
  // CABEÇALHO
  // ==========================================
  const searchIndex = useMemo<SearchHit[]>(() => {
    const hits: SearchHit[] = [];
    subjectChips.forEach((s) => hits.push({ id: `s-${s.id}`, label: s.name, sublabel: 'Caderno da disciplina', href: `/faculdade/${s.id}/notebook` }));
    chapters.forEach((ch) =>
      hits.push({
        id: `c-${ch.id}`,
        label: `${ch.number} · ${ch.title || 'Sem título'}`,
        sublabel: `Capítulo · ${TABS.find(([id]) => id === ch.category)?.[1] ?? ''}`,
        href: `/faculdade/${subjectId}/notebook?tab=${ch.category}&chapter=${ch.id}`,
      })
    );
    libraryPdfs.forEach((doc) => hits.push({ id: `f-${doc.id}`, label: doc.title, sublabel: 'Biblioteca · PDF', href: doc.url, external: true }));
    return hits;
  }, [chapters, libraryPdfs, subjectChips, subjectId]);

  const handleLogout = useCallback(async () => {
    await flush();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [flush, router]);

  const profileUser = user
    ? {
        name: user.name.toUpperCase(),
        email: user.email,
        role: '—',
        institution: '—',
        code: `USR-${user.id.slice(0, 8).toUpperCase()}`,
        lastAccess: formatRelativeDate(user.lastSignInAt),
      }
    : null;

  const dateLabel = `${WEEKDAY_LONG[today.getDay()]}${today.getDay() === 0 || today.getDay() === 6 ? '' : '-feira'}, ${today.getDate()} de ${MONTHS_LONG[today.getMonth()]}`;

  // ==========================================
  // DIVISOR TÁTIL (iPad): arrastar para dividir notas e PDF
  // ==========================================
  const onTouchDividerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging || !bodyRef.current) return;
    const rect = bodyRef.current.getBoundingClientRect();
    if (device === 'tablet-v') {
      setSplitV(Math.round(Math.max(25, Math.min(80, ((e.clientY - rect.top) / rect.height) * 100))));
    } else {
      setSplitH(Math.round(Math.max(30, Math.min(75, ((e.clientX - rect.left) / rect.width) * 100))));
    }
  };

  // ==========================================
  // PEÇAS PARTILHADAS PELOS ARRANJOS
  // ==========================================
  const notesLayout: NotesLayout = device === 'phone' ? 'phone' : tablet ? 'tablet' : 'desktop';
  const chapterLabel = active ? `${active.number} · ${active.title || 'Sem título'}` : tabLabel;
  const editable = !!active && mode === 'EDIT';

  const sidebar = showSide ? (
    <>
      {touch && <button type="button" className={c.scrim} aria-label="Fechar capítulos" onClick={() => setMobileSide(false)} />}
      <ChapterSidebar
        overlay={touch}
        subjectId={subjectId}
        tabLabel={tabLabel}
        chapters={visibleChapters}
        totalInTab={inTab.length}
        selectedId={active?.id ?? ''}
        onSelect={selectChapter}
        liveWords={stats.words}
        query={query}
        onQuery={setQuery}
        searchRef={chapterSearchRef}
        creating={creating}
        onStartCreate={startCreate}
        onCancelCreate={() => setCreating(false)}
        onCreate={createChapter}
        onDelete={deleteChapter}
        outline={outline}
        currentHeading={stats.heading}
        onJump={(i) => notesRef.current?.scrollToHeading(i)}
        pdfName={active?.pdfName}
        onOpenPdf={() => openRef(pdfPage)}
        nextAssessment={nextAssessment}
      />
    </>
  ) : null;

  const main =
    loading && chapters.length === 0 ? (
      <div className={c.empty}>A carregar caderno…</div>
    ) : loadError ? (
      <div className={c.empty}>
        <span style={{ color: 'var(--ink)' }}>Não foi possível abrir o caderno.</span>
        <span>{loadError}</span>
        <button type="button" className={c.btn} onClick={load}>
          Tentar outra vez
        </button>
      </div>
    ) : active ? (
      <NotesPane
        ref={notesRef}
        revision={revision}
        chapter={active}
        mode={mode}
        onModeChange={setMode}
        paperStyle={paper}
        zoom={zoom}
        onZoomChange={setZoom}
        layout={notesLayout}
        onFormatState={setFormat}
        pdfName={active.pdfName}
        pdfPage={pdfPage}
        onUpdateContent={(html) => queueSave(active.id, { content: html }, { content: html })}
        onUpdateTitle={(title) => queueSave(active.id, { title }, { title })}
        onUpdateDrawing={(json) => queueSave(active.id, { drawing_data: json }, { drawingData: json })}
        onOpenRef={openRef}
        onCaretRef={caretRef}
        onStats={setStats}
        onOutline={setOutline}
      />
    ) : (
      <div className={c.empty} style={touch ? { padding: '0 18px' } : undefined}>
        <span style={{ color: 'var(--ink)', fontSize: 15 }}>Ainda não há capítulos em {tabLabel}.</span>
        <span>Cada capítulo é uma folha: escreves, desenhas com a caneta e ligas as páginas dos slides.</span>
        <button type="button" className={touch ? c.tFill : c.fill} onClick={startCreate}>
          + Novo capítulo
        </button>
      </div>
    );

  const pdfPane = (
    <PdfPane
      pdfUrl={active?.pdfUrl}
      pdfName={active?.pdfName}
      libraryPdfs={libraryPdfs}
      page={pdfPage}
      onPageChange={(p) => setPdfPage(Math.max(1, p))}
      linkedPages={linkedPages}
      follow={follow}
      onToggleFollow={() => setFollow((v) => !v)}
      onClose={toggleSplit}
      onPick={(doc) => setPdf(doc.url, doc.title)}
      onUpload={uploadPdf}
      onRemove={removePdf}
      uploading={uploading}
      selectRef={pdfSelectRef}
      hasChapter={!!active}
    />
  );

  const statusBar = (
    <StatusBar
      line={stats.line}
      col={stats.col}
      words={active ? stats.words : 0}
      paper={paper}
      modeLabel={mode === 'EDIT' ? 'A escrever' : 'A rever'}
      next={nextAssessment}
      deviceLabel={deviceLabel}
      sync={sync}
      onRefresh={refresh}
      refreshing={refreshing}
      zoom={zoom}
      onZoom={changeZoom}
      study={study}
    />
  );

  const manualDialog = manualOpen && (
    <ManualSessionDialog
      subjectId={subjectId}
      subjectLabel={subject?.name || subject?.code || 'Disciplina'}
      chapters={chapters}
      currentChapterId={active?.id ?? null}
      onSave={studyTimer.addManual}
      onClose={() => setManualOpen(false)}
    />
  );

  const subjectsForBar = subjectChips.length ? subjectChips : [{ id: subjectId, code: subject?.code || '…', name: subject?.name || '', dot: '#7fb0cb' }];

  // ==========================================
  // ARRANJOS TÁTEIS: iPhone, iPad vertical, iPad horizontal
  // ==========================================
  if (touch) {
    const touchBody = !showSplit
      ? { gridTemplateColumns: 'minmax(0, 1fr)' }
      : device === 'tablet-v'
        ? { gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: `minmax(0, ${splitV}fr) 14px minmax(0, ${100 - splitV}fr)` }
        : { gridTemplateColumns: `minmax(0, ${splitH}fr) 12px minmax(0, ${100 - splitH}fr)` };

    return (
      <div className={`${d.root} ${c.shell}`}>
        {tablet ? (
          <TabletBars
            subjectId={subjectId}
            subjects={subjectsForBar}
            hrefFor={hrefFor}
            tab={tab}
            onTab={changeTab}
            showExport={device === 'tablet-h'}
            onExport={exportPdf}
            onOptions={() => setOptionsOpen(true)}
            onChapters={toggleSide}
            chapterLabel={chapterLabel}
            format={format}
            editable={editable}
            onBlock={(tag) => notesRef.current?.block(tag)}
            onBold={() => notesRef.current?.exec('bold')}
            onItalic={() => notesRef.current?.exec('italic')}
            onRef={() => notesRef.current?.insertRef()}
            onInsertTable={(r, k) => notesRef.current?.insertTable(r, k)}
            onTableAction={(a) => notesRef.current?.tableAction(a)}
            split={showSplit}
            onToggleSplit={toggleSplit}
          />
        ) : (
          <PhoneBar
            subjectId={subjectId}
            subjectCode={subject?.code || '…'}
            chapterLabel={chapterLabel}
            subLabel={`${tabLabel} · ${syncText(sync)} · ${study.state === 'paused' ? 'Pausa' : study.state === 'class' ? 'Aula' : 'Estudo'} ${fmtStudy(study.todaySec)}`}
            onChapters={toggleSide}
            onPdf={() => setPdfSheetOpen(true)}
            onOptions={() => setOptionsOpen(true)}
          />
        )}

        <div ref={bodyRef} className={c.body} style={touchBody}>
          {sidebar}
          {main}
          {showSplit && (
            <>
              <div
                role="separator"
                aria-orientation={device === 'tablet-v' ? 'horizontal' : 'vertical'}
                title="Arrasta para redimensionar"
                className={`${c.dividerH} ${device === 'tablet-v' ? '' : c.dividerTouch} no-print`}
                style={
                  device === 'tablet-v'
                    ? undefined
                    : { cursor: 'col-resize', borderTop: 0, borderBottom: 0, borderLeft: '1px solid var(--line0)', borderRight: '1px solid var(--line0)' }
                }
                onPointerDown={onDividerDown}
                onPointerMove={onTouchDividerMove}
                onPointerUp={onDividerUp}
                onPointerCancel={onDividerUp}
              >
                <span />
              </div>
              {pdfPane}
            </>
          )}
        </div>

        {tablet && statusBar}
        {manualDialog}
        {device === 'phone' && (
          <PhoneFormatBar
            format={format}
            editable={editable}
            onBlock={(tag) => notesRef.current?.block(tag)}
            onExec={(cmd, value) => notesRef.current?.exec(cmd, value)}
            onChecklist={() => notesRef.current?.insertChecklist()}
            onInsertTable={(r, k) => notesRef.current?.insertTable(r, k)}
            onTableAction={(a) => notesRef.current?.tableAction(a)}
            onLink={() => notesRef.current?.insertLink()}
            onRef={() => notesRef.current?.insertRef()}
          />
        )}

        {pdfSheetOpen && device === 'phone' && (
          <PdfSheet
            pdfUrl={active?.pdfUrl}
            pdfName={active?.pdfName}
            page={pdfPage}
            onPageChange={(p) => setPdfPage(Math.max(1, p))}
            linkedPages={linkedPages}
            libraryPdfs={libraryPdfs}
            onPick={(doc) => setPdf(doc.url, doc.title)}
            onUpload={uploadPdf}
            uploading={uploading}
            hasChapter={!!active}
            onInsertRef={() => {
              setPdfSheetOpen(false);
              notesRef.current?.insertRef();
            }}
            onClose={() => setPdfSheetOpen(false)}
          />
        )}

        {optionsOpen && (
          <OptionsSheet
            menus={menus}
            paper={paper}
            onPaper={setPaper}
            modeEdit={mode === 'EDIT'}
            onToggleMode={() => setMode((m) => (m === 'EDIT' ? 'PREVIEW' : 'EDIT'))}
            tabs={device === 'phone' ? { tab, onTab: changeTab } : undefined}
            onClose={() => setOptionsOpen(false)}
          />
        )}

        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
      </div>
    );
  }

  // ==========================================
  // ARRANJO DE COMPUTADOR
  // ==========================================
  const columns: string[] = [];
  if (showSide && !narrow) columns.push(`${SIDE_W}px`);
  columns.push('minmax(320px, 1fr)');
  if (showSplit && !narrow) columns.push('10px', `minmax(0, ${splitWidth}px)`);
  const bodyStyle = narrow && showSplit
    ? { gridTemplateColumns: 'minmax(0, 1fr)', gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr)' }
    : { gridTemplateColumns: columns.join(' ') };

  return (
    <div className={`${d.root} ${c.shell}`}>
      <div className={`${c.chrome} no-print`}>
        <DensoHeader
          compact
          active="faculdade"
          dateLabel={narrow ? undefined : dateLabel}
          searchIndex={searchIndex}
          searchRef={globalSearchRef}
          userName={user?.name ?? null}
          userEmail={user?.email ?? null}
          onOpenProfile={() => setIsProfileOpen(true)}
          onLogout={handleLogout}
        />
      </div>

      <ContextBar
        subjectId={subjectId}
        subjects={subjectsForBar}
        tab={tab}
        onTab={changeTab}
        hrefFor={hrefFor}
        switchKeys={`${keys('mod+[')} e ${keys('mod+]')}`}
        canComplete={!!active}
        isCompleted={!!active?.isCompleted}
        onToggleCompleted={toggleCompleted}
        onExport={exportPdf}
      />

      <MenuBar
        menus={menus}
        sideOpen={showSide}
        onToggleSide={toggleSide}
        sideKeys={keys('mod+J')}
        paper={paper}
        onPaper={setPaper}
        split={showSplit}
        onToggleSplit={toggleSplit}
        splitKeys={keys('mod+\\')}
      />
      <TableSizeDialog open={tableDialog} onClose={() => setTableDialog(false)} onPick={(r, k) => notesRef.current?.insertTable(r, k)} />

      <div ref={bodyRef} className={c.body} style={bodyStyle}>
        {sidebar}
        {main}
        {showSplit && (
          <>
            {!narrow && (
              <div
                role="separator"
                aria-orientation="vertical"
                title="Arrasta para redimensionar"
                className={`${c.divider} ${dragging ? c.dividerOn : ''} no-print`}
                onPointerDown={onDividerDown}
                onPointerMove={onDividerMove}
                onPointerUp={onDividerUp}
                onPointerCancel={onDividerUp}
              >
                <span />
              </div>
            )}
            {pdfPane}
          </>
        )}
      </div>

      {statusBar}
      {manualDialog}

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} user={profileUser} />
    </div>
  );
}

export default function SubjectNotebookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const subjectId = decodeURIComponent(id);

  return (
    <Suspense fallback={<div style={{ background: '#0d0d0d', color: '#a7a29a', height: '100vh', padding: 24, fontSize: 13 }}>A carregar caderno…</div>}>
      <NotebookContent key={subjectId} subjectId={subjectId} />
    </Suspense>
  );
}
