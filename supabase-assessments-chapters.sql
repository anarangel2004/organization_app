-- Organiza-me — capítulos do caderno de cada teste
-- Em cada avaliação escolhes os capítulos do caderno que tens de fazer para
-- estar preparada. A preparação (na Visão Geral) é concluídos ÷ escolhidos,
-- e o plano da página Estudo passa a seguir estes capítulos.
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cola este ficheiro → Run.
-- A coluna é opcional: sem ela (ou vazia) tudo continua como antes.

alter table public.assessments
  add column if not exists chapter_ids jsonb;
