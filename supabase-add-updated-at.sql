-- Atelier Agenda — updated_at real na tabela subjects
-- A Visão Geral de cada disciplina mostrava "ÚLTIMA ATUALIZAÇÃO: HÁ 2 DIAS"
-- fixo (inventado). Este script cria a coluna e um trigger que a atualiza
-- sozinha sempre que a linha é editada, para o valor passar a ser real.
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cola este ficheiro → Run.

alter table public.subjects
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at
  before update on public.subjects
  for each row
  execute function public.set_updated_at();
