-- Organiza-me — permissões das tabelas novas (estudo e turnos)
-- Nos projetos Supabase recentes, uma tabela criada por SQL não fica
-- acessível à app até ter permissões para o papel "authenticated" (quem
-- tem sessão iniciada). Sem isto, a app recebe "permission denied" / 401.
-- O RLS continua ligado: as regras "só com sessão" de cada tabela mantêm-se.
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cola este ficheiro → Run.
-- Pode correr-se mais do que uma vez.

grant select, insert, update, delete on table public.study_sessions to authenticated;
grant select, insert, update, delete on table public.study_settings to authenticated;
grant select, insert, update, delete on table public.work_shifts to authenticated;

-- Pede ao Supabase para recarregar a lista de tabelas e colunas.
notify pgrst, 'reload schema';
