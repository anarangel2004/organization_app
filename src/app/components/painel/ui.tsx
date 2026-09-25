import type { CSSProperties, ReactNode } from 'react';
import s from './painel.module.css';
import type { PainelCat } from './painelData';

export type TipTone = 'v' | 'p' | 'm' | 'e';

const TONE_CLASS: Record<TipTone, string> = { v: s.tcV, p: s.tcP, m: s.tcM, e: s.tcE };

export const CAT_TONE: Record<PainelCat, TipTone> = { fac: 'v', trab: 'p', prazo: 'm', pessoal: 'e' };

// Cartão flutuante do design: aparece com hover/foco no `.hv` pai.
export function Tip({
  tone,
  title,
  children,
  style,
  titleSize,
}: {
  tone: TipTone;
  title: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  titleSize?: number;
}) {
  return (
    <div className={`${s.tip} ${TONE_CLASS[tone]}`} role="tooltip" style={style}>
      <div className={s.tipTitle} style={titleSize ? { fontSize: titleSize } : undefined}>
        {title}
      </div>
      <div className={s.tipBody}>{children}</div>
    </div>
  );
}

// Preenchimento/contorno de cada categoria (quadrados, blocos, pontos).
export const CAT_SWATCH: Record<PainelCat, { bg: string; border: string; fg: string }> = {
  fac: { bg: 'var(--petro)', border: '1px solid var(--petro2)', fg: 'var(--onfill)' },
  trab: { bg: 'var(--bone)', border: '1px solid var(--bone)', fg: 'var(--inkdark)' },
  prazo: { bg: 'var(--gelo)', border: '1px solid var(--gelo)', fg: 'var(--inkdark)' },
  pessoal: { bg: 'transparent', border: '1px solid var(--ink)', fg: 'var(--ink)' },
};

export function Swatch({ cat, size = 12, round = false }: { cat: PainelCat; size?: number; round?: boolean }) {
  const sw = CAT_SWATCH[cat];
  return (
    <span
      aria-hidden="true"
      className={round ? s.round : undefined}
      style={{ flex: 'none', display: 'inline-block', width: size, height: size, background: sw.bg, border: sw.border }}
    />
  );
}

export function SectionHead({ title, aside, as = 'h2' }: { title: ReactNode; aside?: ReactNode; as?: 'h2' | 'h3' }) {
  const Tag = as;
  return (
    <div className={s.sectionHead}>
      <Tag className={s.sectionTitle}>{title}</Tag>
      {aside !== undefined && <span style={{ fontSize: 14 }} className={s.muted}>{aside}</span>}
    </div>
  );
}
