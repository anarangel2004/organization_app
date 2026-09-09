export interface Teacher {
  name: string;
  email: string;
}

export interface EvaluationMethod {
  teoricaWeight: number;
  praticaWeight: number;
  requiresAttendance: boolean;
}

export type ClassType = 'Teórica' | 'Prática' | 'Teórico-Prática';

export interface Schedule {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room: string;
  type: ClassType;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  color: string;
  teacherTeorica?: Teacher;
  teacherPratica?: Teacher;
  evaluation: EvaluationMethod;
  schedules: Schedule[];
  filesCount: number;
  nextEvaluation?: {
    title: string;
    date: string;
  };
}