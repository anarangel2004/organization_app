import { AssessmentItem } from '@/types';

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

/**
 * Formata uma data ISO como distância relativa em português
 * (ex: "HOJE", "HÁ 2 DIAS", "HÁ 3 SEMANAS"). Usado para mostrar o
 * último acesso real do utilizador (Supabase `last_sign_in_at`).
 */
export function formatRelativeDate(isoString: string | null): string {
  if (!isoString) return 'DESCONHECIDO';

  try {
    const then = new Date(isoString).getTime();
    const now = Date.now();
    const diffMs = Math.max(0, now - then);
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return 'AGORA';
    if (diffMinutes < 60) return `HÁ ${diffMinutes} MIN`;
    if (diffHours < 24) return `HÁ ${diffHours}H`;
    if (diffDays === 1) return 'HÁ 1 DIA';
    if (diffDays < 7) return `HÁ ${diffDays} DIAS`;

    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks === 1) return 'HÁ 1 SEMANA';
    if (diffDays < 30) return `HÁ ${diffWeeks} SEMANAS`;

    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths <= 1) return 'HÁ 1 MÊS';
    return `HÁ ${diffMonths} MESES`;
  } catch {
    return 'DESCONHECIDO';
  }
}
