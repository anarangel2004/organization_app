-- Organiza-me — estudo, fase 5
--  1. study_blocks: o plano da semana passa a poder ser fixado e editado
--     (mover, apagar, marcar como feito). Enquanto não mexes, o plano é só
--     uma sugestão refeita sozinha; ao mexer, os blocos da semana ficam aqui.
--  2. Definições novas: pausa entre blocos, o que fazer com restos curtos
--     e lembretes antes de cada bloco.
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cola este ficheiro → Run.
-- Precisa dos ficheiros das fases anteriores corridos antes.

do $$
declare
  subject_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into subject_type
  from pg_attribute a
  where a.attrelid = 'public.subjects'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.study_blocks (
      id uuid primary key,
      subject_id %s not null references public.subjects (id) on delete cascade,
      week_start date not null,          -- segunda-feira da semana do plano
      date date not null,
      start_time time not null,
      end_time time not null,
      status text not null default 'planned' check (status in ('planned', 'done')),
      reason text,
      created_at timestamptz not null default now(),
      check (end_time > start_time)
    )
  $f$, subject_type);
end
$$;

create index if not exists study_blocks_week_idx on public.study_blocks (week_start, date);

alter table public.study_blocks enable row level security;
drop policy if exists "study_blocks: utilizadores com sessão" on public.study_blocks;
create policy "study_blocks: utilizadores com sessão"
  on public.study_blocks for all to authenticated using (true) with check (true);

alter table public.study_settings
  add column if not exists break_minutes integer not null default 10 check (break_minutes between 0 and 60),
  add column if not exists short_blocks text not null default 'allow' check (short_blocks in ('allow', 'round')),
  add column if not exists reminders boolean not null default false,
  add column if not exists reminder_minutes integer not null default 10 check (reminder_minutes between 0 and 120);

-- Permissões para a app (este projeto não as dá sozinho a tabelas novas).
grant select, insert, update, delete on table public.study_blocks to authenticated;
grant select, insert, update, delete on table public.study_sessions to authenticated;
grant select, insert, update, delete on table public.study_settings to authenticated;
notify pgrst, 'reload schema';
