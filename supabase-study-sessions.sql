-- Organiza-me — sessões de estudo (fase 1 do /estudo)
-- Cada linha é um período de estudo numa disciplina (e, se houver, num
-- capítulo do caderno). As automáticas vêm do contador do caderno (só tempo
-- ativo, com mais de 2 minutos); as manuais do botão "+ sessão".
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cola este ficheiro → Run.
--
-- As colunas subject_id e chapter_id usam o mesmo tipo que subjects.id e
-- chapters.id têm na tua base de dados (text ou uuid), lido abaixo.

do $$
declare
  subject_type text;
  chapter_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into subject_type
  from pg_attribute a
  where a.attrelid = 'public.subjects'::regclass and a.attname = 'id';

  select format_type(a.atttypid, a.atttypmod) into chapter_type
  from pg_attribute a
  where a.attrelid = 'public.chapters'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.study_sessions (
      -- O id é gerado no dispositivo: uma sessão guardada sem rede e
      -- reenviada depois nunca fica em duplicado.
      id uuid primary key,
      subject_id %s not null references public.subjects (id) on delete cascade,
      chapter_id %s references public.chapters (id) on delete set null,
      started_at timestamptz not null,
      ended_at timestamptz not null,
      duration_seconds integer not null check (duration_seconds > 0 and duration_seconds <= 86400),
      source text not null default 'auto' check (source in ('auto', 'manual')),
      created_at timestamptz not null default now()
    )
  $f$, subject_type, chapter_type);
end
$$;

create index if not exists study_sessions_subject_started_idx
  on public.study_sessions (subject_id, started_at desc);
create index if not exists study_sessions_started_idx
  on public.study_sessions (started_at desc);

-- Mesma regra das outras tabelas: só quem tem sessão iniciada.
alter table public.study_sessions enable row level security;

drop policy if exists "study_sessions: utilizadores com sessão" on public.study_sessions;
create policy "study_sessions: utilizadores com sessão"
  on public.study_sessions
  for all
  to authenticated
  using (true)
  with check (true);

-- Permissões para a app (projetos Supabase recentes não as dão sozinhos).
grant select, insert, update, delete on table public.study_sessions to authenticated;
notify pgrst, 'reload schema';
