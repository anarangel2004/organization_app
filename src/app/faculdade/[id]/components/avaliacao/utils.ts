import { AssessmentItem } from './types';

export function formatDateStr(isoString: string | null): string {
  if (!isoString) return 'DATA PENDENTE';
  try {
    const cleanDateStr = isoString.split('T')[0];
    const [year, month, day] = cleanDateStr.split('-').map(Number);
    if (!year || !month || !day) return 'DATA PENDENTE';

    const date = new Date(year, month - 1, day);
    return date
      .toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
      .toUpperCase()
      .replace(/\./g, '');
  } catch {
    return 'DATA PENDENTE';
  }
}

export function getItemEffectiveGrade(item: AssessmentItem): number | null {
  if (item.category === 'PRATICA' && item.has_defense) {
    const grade = item.grade;
    const defense = item.defense_grade;

    if (typeof grade === 'number' && typeof defense === 'number') {
      return Math.min(grade, defense);
    }
    if (typeof grade === 'number') return grade;
    if (typeof defense === 'number') return defense;
    return null;
  }
  return item.grade;
}