'use client';

// Campos de data e hora sempre em formato português (dd/mm/aaaa e 24h).
// Os <input type="date|time"> do browser seguem a língua do browser (em
// inglês mostram mm/dd/yyyy e AM/PM) e ignoram a língua da página, por isso
// estes campos são de texto; o botão do calendário abre o seletor nativo.
//
// Valores trocados com o resto da app: data "AAAA-MM-DD", hora "HH:MM"
// ('' quando vazio), iguais aos dos inputs nativos que substituem.

import { useRef, useState, type CSSProperties } from 'react';

interface BaseProps {
  className?: string;
  // Classe extra quando o texto escrito não é válido.
  invalidClassName?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

// ==========================================
// DATA
// ==========================================
function isoToText(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

// "5/11/2026", "05112026", "5-11-26" → "2026-11-05"; inválido → null.
function textToIso(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\D*(\d{1,2})\D*(\d{2}|\d{4})$/) ?? text.replace(/\D/g, '').match(/^(\d{2})(\d{2})(\d{4})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Põe as barras enquanto se escreve: "0511" → "05/11", "05112026" → "05/11/2026".
function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DateField({
  value,
  onChange,
  className,
  invalidClassName,
  style,
  disabled,
  autoFocus,
  'aria-label': ariaLabel,
}: BaseProps & { value: string; onChange: (iso: string) => void }) {
  const [text, setText] = useState(() => isoToText(value));
  const [prev, setPrev] = useState(value);
  const pickerRef = useRef<HTMLInputElement>(null);

  // O valor mudou por fora (outro item aberto, calendário): mostra-o.
  if (value !== prev) {
    setPrev(value);
    setText(isoToText(value));
  }

  const invalid = text !== '' && textToIso(text) === null;

  const commit = (t: string) => {
    if (t.trim() === '') {
      if (value !== '') onChange('');
      return;
    }
    const iso = textToIso(t);
    if (iso) {
      setText(isoToText(iso));
      if (iso !== value) onChange(iso);
    }
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  return (
    <span style={{ position: 'relative', display: 'block', ...style }}>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/aaaa"
        aria-label={ariaLabel}
        disabled={disabled}
        autoFocus={autoFocus}
        className={`${className ?? ''} ${invalid && invalidClassName ? invalidClassName : ''}`}
        value={text}
        onChange={(e) => {
          const t = maskDate(e.target.value);
          setText(t);
          // Grava logo que a data fica completa (não é preciso sair do campo).
          const iso = textToIso(t);
          if (iso && iso !== value) onChange(iso);
          if (t === '' && value !== '') onChange('');
        }}
        onBlur={() => commit(text)}
        onKeyDown={(e) => e.key === 'Enter' && commit(text)}
        style={{ width: '100%', paddingRight: 38 }}
      />
      <button
        type="button"
        aria-label="Abrir calendário"
        disabled={disabled}
        onClick={openPicker}
        style={{
          position: 'absolute',
          right: 1,
          top: 1,
          bottom: 1,
          width: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: 0,
          color: 'inherit',
          opacity: 0.8,
          padding: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
          <rect x="1.7" y="2.7" width="12.6" height="11.6" />
          <path d="M1.7 6.3h12.6M5 1v3M11 1v3" />
        </svg>
      </button>
      {/* Seletor nativo escondido, só para o calendário. */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={textToIso(text) ?? value}
        onChange={(e) => {
          setText(isoToText(e.target.value));
          onChange(e.target.value);
        }}
        style={{ position: 'absolute', right: 0, bottom: 0, width: 1, height: 1, opacity: 0, pointerEvents: 'none', border: 0, padding: 0 }}
      />
    </span>
  );
}

// ==========================================
// HORA (24h)
// ==========================================
// "9", "930", "9:30", "9h30", "0930" → "09:30"; inválido → null.
function textToTime(text: string): string | null {
  const t = text.trim().toLowerCase().replace('h', ':');
  let h: number;
  let m: number;
  const sep = t.match(/^(\d{1,2})[:.](\d{1,2})?$/);
  if (sep) {
    h = Number(sep[1]);
    m = sep[2] ? Number(sep[2]) : 0;
  } else if (/^\d{1,4}$/.test(t)) {
    if (t.length <= 2) {
      h = Number(t);
      m = 0;
    } else {
      h = Number(t.slice(0, t.length - 2));
      m = Number(t.slice(-2));
    }
  } else return null;
  if (h > 23 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function maskTime(raw: string): string {
  // Deixa escrever "9:30" ou "930"; só acrescenta ":" depois de 2 algarismos seguidos.
  const clean = raw.replace(/[^\d:h.]/gi, '').slice(0, 5);
  if (/^\d{3,4}$/.test(clean)) return `${clean.slice(0, 2)}:${clean.slice(2)}`;
  return clean;
}

export function TimeField({
  value,
  onChange,
  className,
  invalidClassName,
  style,
  disabled,
  autoFocus,
  placeholder = 'hh:mm',
  'aria-label': ariaLabel,
}: BaseProps & { value: string; onChange: (time: string) => void; placeholder?: string }) {
  const [text, setText] = useState(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    setPrev(value);
    setText(value);
  }

  const invalid = text !== '' && textToTime(text) === null;

  const commit = () => {
    if (text.trim() === '') {
      if (value !== '') onChange('');
      return;
    }
    const t = textToTime(text);
    if (t) {
      setText(t);
      if (t !== value) onChange(t);
    }
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`${className ?? ''} ${invalid && invalidClassName ? invalidClassName : ''}`}
      value={text}
      onChange={(e) => {
        const t = maskTime(e.target.value);
        setText(t);
        // Hora completa (hh:mm): grava logo.
        if (/^\d{2}:\d{2}$/.test(t)) {
          const ok = textToTime(t);
          if (ok && ok !== value) onChange(ok);
        }
        if (t === '' && value !== '') onChange('');
      }}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
      style={style}
    />
  );
}
