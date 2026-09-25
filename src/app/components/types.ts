// Tipos partilhados pela página principal e pelos seus componentes.

export interface AgendaRow {
  id: string;
  kind: 'AULA' | 'PRAZO' | 'TAREFA';
  time: string | null;
  endTime?: string | null;
  title: string;
  subtitle: string;
  color?: string;
}

export interface UpcomingRow {
  id: string;
  kind: 'PRAZO' | 'TAREFA';
  date: Date;
  title: string;
  subtitle: string;
}

export interface WeekDayCell {
  date: Date;
  dayLabel: string;
  dateLabel: string;
  isToday: boolean;
  isPast: boolean;
  status: 'CONCLUÍDO' | 'HOJE' | 'CRÍTICO' | 'PROGRAMADO' | 'FLEXÍVEL';
  rows: AgendaRow[];
}

export interface SearchEntry {
  id: string;
  label: string;
  sublabel: string;
  href: string;
}

export interface TickerItem {
  id: string;
  text: string;
  tag: string;
}

// Forma mínima do utilizador exigida pelo UserProfileMenu/ProfileModal
// partilhados (src/components/ui/), reunida num só tipo para a home page.
export interface HomeProfileUser {
  name: string;
  email: string;
  role: string;
  institution: string;
  code: string;
  lastAccess: string;
}
