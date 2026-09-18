// ==========================================
// 1. DISCIPLINAS & HORÁRIOS
// ==========================================
export type ClassType = 'T' | 'P' | 'TP' | 'Teórica' | 'Prática' | 'Teórico-Prática';

export interface Teacher {
  name: string;
  email: string;
}

export interface EvaluationMethod {
  teoricaWeight: number;
  praticaWeight: number;
  requiresAttendance: boolean;
}

export interface ClassSchedule {
  id?: string;
  dayOfWeek: number | string;
  startTime: string;
  endTime: string;
  room: string;
  type: ClassType;
}
export type Schedule = ClassSchedule;

export interface Deadline {
  id: string;
  title: string;
  date: string;
  daysRemaining?: number;
  location?: string;
  isCritical?: boolean;
  type?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  color?: string;
  teacherTeorica?: Teacher | string;
  teacherPratica?: Teacher | string;
  ects?: number;
  academicYear?: string;
  degreeYear?: number;
  semester?: number;
  evaluation?: EvaluationMethod;
  schedules: ClassSchedule[];
  deadlines?: Deadline[];
  filesCount?: number;
  nextEvaluation?: {
    title: string;
    date: string;
  };
  updatedAt?: string | null;
}
export type SubjectData = Subject;

// ==========================================
// 2. AVALIAÇÕES
// ==========================================
export interface AssessmentItem {
  id: string;
  subject_id: string;
  title: string;
  category: 'TEORICA' | 'PRATICA';
  weight_percent: number;
  due_date: string | null;
  grade: number | null;
  has_defense: boolean;
  defense_grade: number | null;
  defense_date: string | null;
  volume_ref: string | null;
  file_name: string | null;
  file_url: string | null;
  created_at?: string;
}

export interface AvaliacaoSectionProps {
  subjectId?: string;
  onRefresh?: () => void;
}

// ==========================================
// 3. CADERNOS & CAPÍTULOS (NOTEBOOKS)
// ==========================================
export type NotebookTab = 'TEORICAS' | 'PRATICAS' | 'TESTES';
export type PaperStyle = 'PAUTADO' | 'QUADRICULA' | 'LISO';

export interface Chapter {
  id: string;
  subjectId: string;
  number: string;
  title: string;
  category: NotebookTab;
  content: string;
  drawingData?: string;
  pdfUrl?: string;
  pdfName?: string;
  isCompleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}
export type ChapterData = Chapter;