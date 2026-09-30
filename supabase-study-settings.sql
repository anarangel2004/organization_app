-- Organiza-me — definições do estudo (fase 2 do /estudo)
-- Uma só linha (id = 'default') com as horas por ECTS e as datas do
-- semestre. Fica na base de dados para ser igual no computador, iPad e iPhone.
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cola este ficheiro → Run.

create table if not exists public.study_settings (
  id text primary key default 'default',
  hours_per_ects numeric not null default 28 check (hours_per_ects between 20 and 40),
  semester_start date,   -- primeiro dia de aulas
  semester_end date,     -- último dia de aulas
  exams_end date,        -- fim da época de exames
  updated_at timestamptz not null default now()
);

insert into public.study_settings (id) values ('default') on conflict (id) do nothing;

alter table public.study_settings enable row level security;

drop policy if exists "study_settings: utilizadores com sessão" on public.study_settings;
create policy "study_settings: utilizadores com sessão"
  on public.study_settings
  for all
  to authenticated
  using (true)
  with check (true);
