-- Organiza-me — hora e duração dos testes
-- A tabela assessments só guardava a data (due_date). Estas duas colunas
-- guardam a hora de início e a duração, para os testes aparecerem na
-- grelha da semana no sítio certo e com o tamanho certo.
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cola este ficheiro → Run.
-- As colunas são opcionais: as avaliações antigas ficam sem hora.

alter table public.assessments
  add column if not exists due_time time,
  add column if not exists duration_minutes integer
    check (duration_minutes is null or (duration_minutes > 0 and duration_minutes <= 720));
