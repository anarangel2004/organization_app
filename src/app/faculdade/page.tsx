'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase'; // Import do cliente autenticado
import { getAllMirror, reconcileMirror } from '@/lib/offline/db';
import { isNetworkError } from '@/lib/offline/sync';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { formatRelativeDate } from '@/lib/utils';
import { PageHeader } from '@/components/ui/PageHeader';
import ProfileModal from '@/components/ui/ProfileModal';
import { HeaderSection } from './components/HeaderSection';
import { ScheduleSection } from './components/ScheduleSection'; // <-- SECÇÃO DO HORÁRIO
import { SubjectCard, type Subject } from './components/SubjectCard';
import { AddSubjectForm } from './components/AddSubjectForm';
import { FooterSection } from './components/FooterSection';

export default function FaculdadePage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Utilizador real da sessão Supabase (substitui os dados fictícios anteriores)
  const { user } = useCurrentUser();

  // Instância do Supabase pronta para enviar os cookies/sessão do utilizador
  // (criada uma única vez, para manter a referência estável entre renders)
  const [supabase] = useState(() => createClient());

  const fetchSubjects = useCallback(async () => {
    try {
      setLoading(true);
      // O Supabase aplica a regra de RLS automaticamente e traz apenas as TUAS disciplinas
      const { data, error } = await supabase.from('subjects').select('*');
      if (error) throw error;
      setSubjects(data || []);
      await reconcileMirror('subjects', data ?? []);
    } catch (err) {
      if (isNetworkError(err)) {
        // Sem rede: mostra a última cópia das disciplinas guardada localmente.
        const cached = await getAllMirror<Subject>('subjects');
        setSubjects(cached);
      } else {
        console.error('Erro ao carregar disciplinas:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    // Carregamento inicial único (equivalente a um fetch-on-mount); a regra
    // set-state-in-effect é pensada para efeitos que sincronizam com props/state
    // que mudam, não para o pedido inicial de dados ao servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSubjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- correr apenas uma vez ao montar
  }, []);

  // Dados de perfil derivados da sessão real (nome/email verdadeiros;
  // código e cargo mostram "—" enquanto não houver um perfil configurável)
  const profileUser = user
    ? {
        name: user.name.toUpperCase(),
        email: user.email,
        role: '—',
        institution: '—',
        code: `USR-${user.id.slice(0, 8).toUpperCase()}`,
        lastAccess: formatRelativeDate(user.lastSignInAt),
      }
    : null;

  return (
    <div className="min-h-screen bg-[#FCF9F2] text-[#111111] font-sans selection:bg-[#111111] selection:text-[#FCF9F2] flex flex-col justify-between">
      <main className="max-w-7xl mx-auto px-6 pt-10 pb-12 space-y-12 w-full flex-1">
        {/* CABEÇALHO NAVEGÁVEL COM BOTÃO VOLTAR */}
        <PageHeader
          title="Catálogo Curricular & Unidades"
          subtitle="Gestão de disciplinas, parâmetros monográficos e assiduidade"
          color="#111111"
          backHref="/"
          categoryCode="FACULDADE // DOSSIÊ PRINCIPAL"
        />

        {/* CABEÇALHO PRINCIPAL & ESTATÍSTICAS */}
        <HeaderSection
          stats={{
            totalSubjects: subjects.length,
            totalChapters: 6,
            academicYear: 'OUTONO 2026',
            lastSignIn: profileUser?.lastAccess ?? 'HOJE',
            user: profileUser
              ? {
                  name: profileUser.name,
                  email: profileUser.email,
                  code: profileUser.code,
                  role: profileUser.role,
                }
              : null,
          }}
          onOpenProfileModal={() => setIsProfileOpen(true)}
        />

        <hr className="border-[#D8D5CC]" />

        {/* SECÇÃO 01: HORÁRIO & AGENDA INTEGRADA */}
        <ScheduleSection />

        <hr className="border-[#D8D5CC]" />

        {/* LISTAGEM DE DISCIPLINAS */}
        <section className="space-y-6">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-5xl sm:text-6xl font-black uppercase text-[#111111] tracking-tight">
              DISCIPLINAS.
            </h2>
            <div className="font-mono text-[10px] tracking-widest text-[#767571] uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#111111] inline-block"></span>
              {subjects.length} DE {subjects.length} · ORDENADO POR PRÓXIMA AULA
            </div>
          </div>

          {loading ? (
            <div className="py-12 font-mono text-center text-xs tracking-widest uppercase text-[#767571]">
              A CARREGAR CATÁLOGO CURRICULAR...
            </div>
          ) : (
            <div className="border-b border-[#D8D5CC]">
              {subjects.map((sub, idx) => (
                <SubjectCard key={sub.id} subject={sub} index={idx} />
              ))}
            </div>
          )}

          {/* FORMULÁRIO */}
          <AddSubjectForm onSubjectAdded={fetchSubjects} />
        </section>
      </main>

      {/* RODAPÉ EDITORIAL */}
      <FooterSection />

      {/* MODAL DE PERFIL */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={profileUser}
      />
    </div>
  );
}
