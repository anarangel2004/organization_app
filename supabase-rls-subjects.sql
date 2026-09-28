-- Organiza-me — proteger a tabela subjects (RLS)
-- A tabela subjects podia ser lida sem sessão iniciada, só com a chave
-- pública (a que vai no browser). As outras tabelas (chapters, assessments…)
-- já só respondem a quem tem sessão; este script põe subjects igual.
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cola este ficheiro → Run.

-- 1) Ligar o RLS: sem regras, ninguém lê nem escreve (exceto o painel do Supabase).
alter table public.subjects enable row level security;

-- 2) Quem tem sessão iniciada pode ler, criar, editar e apagar disciplinas.
drop policy if exists "subjects: utilizadores com sessão" on public.subjects;
create policy "subjects: utilizadores com sessão"
  on public.subjects
  for all
  to authenticated
  using (true)
  with check (true);

-- Para confirmar: estas duas consultas mostram que tabelas têm RLS ligado
-- e que regras existem. Todas as tabelas da app devem ter rowsecurity = true.
-- select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
-- select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' order by tablename;
