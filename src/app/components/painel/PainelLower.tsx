'use client';

import Link from 'next/link';
import s from './painel.module.css';
import { SectionHead, Tip } from './ui';
import { daysBetween, fmtEuro, fmtNum, shortDate } from './painelData';
import {
  MOCK_BILLABLE_HOURS,
  MOCK_DEADLINE_PREP,
  MOCK_EXPENSES,
  MOCK_STUDY_HOURS,
} from './mockData';
import type { CtxFilter } from './PainelTop';

// ==========================================
// PRAZOS (próximos 14 dias)
// ==========================================
export interface DeadlineItem {
  id: string;
  cat: 'prazo' | 'trab';
  date: Date;
  title: string;
  typeLabel: string;
  desc: string;
  href: string;
}

const HORIZON = 14;

export function Deadlines({ items, today, ctx }: { items: DeadlineItem[]; today: Date; ctx: CtxFilter }) {
  const visible = items.filter((d) => ctx === 'all' || d.cat === 'trab');
  const cards = visible.slice(0, 3);

  return (
    <section className={s.inner} style={{ paddingTop: 66 }}>
      <SectionHead title="PRAZOS" aside={`próximos ${HORIZON} dias`} />

      <div style={{ position: 'relative', height: 73, marginTop: 18, marginRight: 8 }}>
        <div style={{ position: 'absolute', left: 0, right: 0, top: 38, height: 1, background: 'var(--ink)' }} />
        {Array.from({ length: HORIZON + 1 }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            style={{ position: 'absolute', left: `${(i / HORIZON) * 100}%`, top: 32, width: 1, height: 7, background: 'var(--mut)' }}
          />
        ))}
        {visible.map((d, i) => {
          const pct = (Math.min(daysBetween(today, d.date), HORIZON) / HORIZON) * 100;
          const align = pct > 92 ? 'translateX(-100%)' : pct < 6 ? 'none' : 'translateX(-50%)';
          return (
            <div key={d.id}>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: 33,
                  width: 10,
                  height: 10,
                  marginLeft: -5,
                  background: d.cat === 'prazo' ? 'var(--gelo)' : 'var(--bone)',
                }}
              />
              {/* Rótulos só para os três primeiros, para não se sobreporem. */}
              {i < 3 && (
                <span style={{ position: 'absolute', left: `${pct}%`, top: 7, transform: align, fontSize: 12, color: 'var(--acc)', whiteSpace: 'nowrap' }}>
                  {shortDate(d.date)}
                </span>
              )}
            </div>
          );
        })}
        <span className={s.muted} style={{ position: 'absolute', left: 0, top: 51, fontSize: 12 }}>
          hoje, {shortDate(today)}
        </span>
      </div>

      {cards.length === 0 ? (
        <p className={s.muted} style={{ margin: '25px 0 0', fontSize: 14 }}>
          Sem prazos nos próximos {HORIZON} dias.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '40px 20px', marginTop: 25 }}>
          {cards.map((d, i) => {
            const days = daysBetween(today, d.date);
            const prep = MOCK_DEADLINE_PREP[i] ?? MOCK_DEADLINE_PREP[0];
            return (
              <div key={d.id} className={s.hv}>
                <Link href={d.href} style={{ display: 'block', width: '100%' }}>
                  <span style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                    <span
                      className={`${s.serif} ${s.tm}`}
                      style={{ fontWeight: 600, fontSize: 'clamp(66px, 6.3vw, 91px)', lineHeight: 0.85, letterSpacing: '-.03em', color: 'var(--acc)' }}
                    >
                      {days}
                    </span>
                    <span className={s.muted} style={{ fontSize: 12, paddingBottom: 5 }}>
                      {days === 1 ? 'dia' : 'dias'}
                    </span>
                  </span>
                  <span style={{ display: 'block', marginTop: 17, fontSize: 18, fontWeight: 500, lineHeight: 1.25 }}>{d.title}</span>
                  <span className={s.muted} style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                    {d.typeLabel}, {shortDate(d.date)}
                  </span>
                  <span style={{ display: 'block', marginTop: 18, height: 7, background: 'var(--hair2)' }}>
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${prep.prep}%`,
                        background: d.cat === 'prazo' ? 'var(--petro2)' : 'var(--bone)',
                      }}
                    />
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 12 }}>
                    <span>{prep.prep}% preparado*</span>
                    <span className={s.muted}>{prep.state}</span>
                  </span>
                </Link>
                <Tip
                  tone={d.cat === 'prazo' ? 'v' : 'p'}
                  title={d.title}
                  style={{ ...(i === cards.length - 1 && i > 0 ? { right: 0 } : { left: 0 }), top: 'calc(100% - 37px)', width: 266 }}
                >
                  {d.desc}
                </Tip>
              </div>
            );
          })}
        </div>
      )}
      {cards.length > 0 && (
        <p className={s.muted} style={{ margin: '18px 0 0', fontSize: 11 }}>
          * A preparação é um valor de exemplo: as avaliações ainda não guardam progresso.
        </p>
      )}
    </section>
  );
}

// ==========================================
// BALANÇO (valores de exemplo)
// ==========================================
function Meter({ label, done, target, color }: { label: string; done: number; target: number; color: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 12 }}>{label}</span>
        <span className={s.serif} style={{ fontWeight: 600, fontSize: 22, lineHeight: 1 }}>
          {fmtNum(done)}
          <span className={s.muted} style={{ fontFamily: 'var(--font-hanken), sans-serif', fontWeight: 400, fontSize: 12, marginLeft: 5 }}>
            de {target} h
          </span>
        </span>
      </div>
      <div style={{ height: 8, background: 'var(--hair2)', marginTop: 8 }}>
        <div style={{ height: '100%', width: `${Math.min(100, (done / target) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export function Balance() {
  const expensesTotal = MOCK_EXPENSES.reduce((sum, e) => sum + e.amount, 0);

  return (
    <section className={s.inner} style={{ paddingTop: 66 }}>
      <div style={{ maxWidth: 531 }}>
        <SectionHead title="BALANÇO" aside="esta semana" />
        <p className={s.muted} style={{ margin: '8px 0 0', fontSize: 11 }}>
          Valores de exemplo: ainda não há registo de horas nem de despesas.
        </p>
        <div style={{ marginTop: 13, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <Meter label="Horas faturáveis" done={MOCK_BILLABLE_HOURS.done} target={MOCK_BILLABLE_HOURS.target} color="var(--bone)" />
          <Meter label="Horas de estudo" done={MOCK_STUDY_HOURS.done} target={MOCK_STUDY_HOURS.target} color="var(--petro2)" />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginTop: 20,
            paddingTop: 12,
            borderTop: '1px solid var(--hair)',
          }}
        >
          <span className={s.muted} style={{ fontSize: 12 }}>Total acumulado</span>
          <span className={s.serif} style={{ fontWeight: 600, fontSize: 40, lineHeight: 1, color: 'var(--acc)' }}>
            {fmtNum(MOCK_BILLABLE_HOURS.done + MOCK_STUDY_HOURS.done)} h
          </span>
        </div>

        <h3 className={s.serif} style={{ margin: '46px 0 0', fontWeight: 600, fontSize: 23, lineHeight: 1, letterSpacing: '-.01em' }}>
          Despesas do mês
        </h3>
        <div style={{ marginTop: 10, borderTop: '1px solid var(--hair)' }}>
          {MOCK_EXPENSES.map((e) => (
            <div key={e.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid var(--hair)', fontSize: 13 }}>
              <span>{e.label}</span>
              <span>{fmtEuro(e.amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 12 }}>
            <span className={s.muted} style={{ fontSize: 12 }}>Total do mês</span>
            <span className={s.serif} style={{ fontWeight: 600, fontSize: 27, lineHeight: 1 }}>{fmtEuro(expensesTotal)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function PainelFooter() {
  return (
    <footer className={s.inner} style={{ marginTop: 80, paddingBottom: 40 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          gap: 23,
          borderTop: '1px solid var(--hair)',
          paddingTop: 23,
        }}
      >
        <p className={`${s.serif} ${s.muted}`} style={{ margin: 0, fontWeight: 500, fontSize: 16, lineHeight: 1.5, maxWidth: 470 }}>
          Composto em Hanken Grotesk e Newsreader, sobre preto, com grão. Feito para uma pessoa só, que divide os dias
          entre a sala de aula e o trabalho.
        </p>
        <nav
          aria-label="Ligações úteis"
          style={{ minWidth: 190, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, alignItems: 'flex-start' }}
        >
          <Link className={s.nl} href="/faculdade">Disciplinas</Link>
          <Link className={s.nl} href="/trabalho">Projetos e tarefas</Link>
        </nav>
      </div>
    </footer>
  );
}
