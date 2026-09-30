-- Organiza-me — plano de estudo (fase 3 do /estudo)
--  1. Turnos de trabalho (nova tabela work_shifts): semanais (dia da semana)
--     ou num dia concreto. Aparecem no Trabalho e na Visão Geral, e o plano
--     de estudo não marca blocos por cima deles.
--  2. Definições do plano em study_settings: disponibilidade, máximo de
--     horas por dia, tamanho dos blocos, margem das aulas e períodos
--     "indisponível" soltos (ginásio, viagem…).
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cola este ficheiro → Run.
-- Precisa do supabase-study-settings.sql corrido antes.

-- 1. TURNOS -------------------------------------------------------------
-- project_id usa o mesmo tipo que work_projects.id (text ou uuid).
do $$
declare
  project_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into project_type
  from pg_attribute a
  where a.attrelid = 'public.work_projects'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.work_shifts (
      id uuid primary key default gen_random_uuid(),
      title text not null default 'Turno',
      weekday smallint check (weekday between 0 and 6), -- 0 = domingo (semanal)
      date date,                                        -- ou um dia concreto
      start_time time not null,
      end_time time not null,
      place text,
      project_id %s references public.work_projects (id) on delete set null,
      created_at timestamptz not null default now(),
      check (weekday is not null or date is not null),
      check (end_time > start_time)
    )
  $f$, project_type);
end
$$;

alter table public.work_shifts enable row level security;
drop policy if exists "work_shifts: utilizadores com sessão" on public.work_shifts;
create policy "work_shifts: utilizadores com sessão"
  on public.work_shifts for all to authenticated using (true) with check (true);

-- 2. DEFINIÇÕES DO PLANO ---------------------------------------------------
alter table public.study_settings
  add column if not exists weekday_start time not null default '09:00',
  add column if not exists weekday_end time not null default '22:00',
  add column if not exists weekend_start time not null default '10:00',
  add column if not exists weekend_end time not null default '19:00',
  add column if not exists max_hours_day numeric not null default 5 check (max_hours_day between 0.5 and 12),
  add column if not exists block_min integer not null default 120 check (block_min between 15 and 180),
  add column if not exists block_max integer not null default 150 check (block_max between 15 and 240),
  add column if not exists class_margin integer not null default 15 check (class_margin between 0 and 60),
  -- [{ "weekday": 2, "date": null, "start": "18:00", "end": "20:00", "label": "Ginásio" }, …]
  add column if not exists unavailable jsonb not null default '[]'::jsonb;

-- Permissões para a app (projetos Supabase recentes não as dão sozinhos).
grant select, insert, update, delete on table public.work_shifts to authenticated;
notify pgrst, 'reload schema';
