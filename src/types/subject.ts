export type ClassType = 'T' | 'P' | 'TP';

export interface ClassSchedule {
  id: string;
  dayOfWeek: number; // 1 (Segunda) a 7 (Domingo)
  startTime: string; // "09:00"
  endTime: string;   // "11:00"
  room: string;      // "SALA 1"
  type: ClassType;   // 'T' | 'P' | 'TP'
}

export interface Deadline {
  id: string;
  title: string;
  date: string; // ISO format "YYYY-MM-DD"
  type?: string;
}

export interface SubjectData {
  id: string;
  name: string;
  code: string;
  teacherTeorica?: string;
  ects: number;
  academicYear: string; // ex: "2024/2025"
  degreeYear: number;   // ex: 1 (1º Ano)
  semester: number;     // 1 ou 2
  schedules: ClassSchedule[];
  deadlines: Deadline[];
}