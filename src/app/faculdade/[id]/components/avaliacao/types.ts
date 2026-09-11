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