'use client';

// Perfil: conta (nome, email, último acesso, terminar sessão) e as
// definições do estudo (horas por ECTS, semestre, disponibilidade, blocos).
// Usa as variáveis do estilo "denso" da página onde está aberto.

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import d from '@/app/components/denso/denso.module.css';
import { StudySettingsPanel } from '@/app/estudo/EstudoView';

interface ProfileModalUser {
  name: string;
  email: string;
  role: string;
  institution: string;
  code: string;
  lastAccess: string;
}

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: ProfileModalUser | null;
  // Abre já na secção do estudo (ex.: botão "Definições" do /estudo).
  focusStudy?: boolean;
}

export default function ProfileModal({ isOpen, onClose, user, focusStudy = false }: ProfileModalProps) {
  const router = useRouter();
  const studyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (focusStudy) window.setTimeout(() => studyRef.current?.scrollIntoView({ block: 'start' }), 50);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose, focusStudy]);

  if (!isOpen) return null;

  const name = user?.name || 'A carregar…';
  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    onClose();
    router.push('/login');
    router.refresh();
  };

  return (
    <div
      role="presentation"
      onClick={onClose}
      data-study-ignore
      style={{ position: 'fixed', inset: 0, zIndex: 96, background: 'rgba(0,0,0,0.65)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: 'max(16px, env(safe-area-inset-top)) 12px 16px', overflowY: 'auto' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Perfil"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(640px, 100%)', background: 'var(--panel, #111)', color: 'var(--ink, #efe9df)', border: '1px solid #262626', display: 'flex', flexDirection: 'column', margin: 'auto 0' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--line, #2a2a2a)' }}>
          <h2 className={d.h2}>PERFIL</h2>
          <button type="button" className={`${d.btnGhost} ${d.sm}`} onClick={onClose}>
            Fechar ✕
          </button>
        </div>

        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {/* Conta */}
          <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span
                className={d.round}
                aria-hidden="true"
                style={{ width: 52, height: 52, flex: 'none', background: 'var(--ink, #efe9df)', color: 'var(--bg, #0d0d0d)', fontSize: 22, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {name.charAt(0).toUpperCase()}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span className={d.serif} style={{ fontSize: 22, lineHeight: 1.15 }}>{name.charAt(0) + name.slice(1).toLowerCase()}</span>
                {user?.email && <span className={d.ellipsis} style={{ fontSize: 13, color: 'var(--mut)' }}>{user.email}</span>}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[
                ['CÓDIGO', user?.code ?? '—'],
                ['ÚLTIMO ACESSO', user?.lastAccess ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className={d.row} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, letterSpacing: '0.08em', color: 'var(--mut2)' }}>{k}</span>
                  <span>{v}</span>
                </div>
              ))}
            </div>
            <button type="button" className={`${d.btnLine} ${d.sm}`} onClick={handleLogout} style={{ alignSelf: 'flex-start' }}>
              Terminar sessão
            </button>
          </section>

          {/* Estudo */}
          <div ref={studyRef} style={{ scrollMarginTop: 16 }}>
            <StudySettingsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
