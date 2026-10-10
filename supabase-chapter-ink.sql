-- Organiza-me — traços do caderno gravados por zonas da folha
-- Antes, o desenho de cada capítulo ia inteiro na coluna chapters.drawing_data
-- e era reenviado todo a cada pausa da caneta. Num capítulo grande (8 MB e
-- mais) o Supabase desistia ("upstream request timeout") e ficava sobrecarregado.
-- Aqui cada linha é uma zona da folha (2048 px de altura) de um capítulo: ao
-- escrever, só a zona onde se escreveu é gravada.
--
-- Como aplicar: Supabase Dashboard → SQL Editor → cola este ficheiro → Run.
-- Depois, ao abrir cada capítulo, a app passa o desenho antigo para aqui sozinha.
--
-- A coluna chapter_id usa o mesmo tipo que chapters.id tem na tua base de dados.

do $$
declare
  chapter_type text;
begin
  select format_type(a.atttypid, a.atttypmod) into chapter_type
  from pg_attribute a
  where a.attrelid = 'public.chapters'::regclass and a.attname = 'id';

  execute format($f$
    create table if not exists public.chapter_ink (
      -- "<chapter_id>:<zona>", gerado na app (gravar duas vezes não duplica).
      id text primary key,
      chapter_id %s not null references public.chapters (id) on delete cascade,
      region integer not null check (region >= 0),
      strokes jsonb not null default '[]'::jsonb,
      updated_at timestamptz not null default now()
    )
  $f$, chapter_type);
end
$$;

create index if not exists chapter_ink_chapter_idx on public.chapter_ink (chapter_id);

-- Mesma regra das outras tabelas: só quem tem sessão iniciada.
alter table public.chapter_ink enable row level security;

drop policy if exists "chapter_ink: utilizadores com sessão" on public.chapter_ink;
create policy "chapter_ink: utilizadores com sessão"
  on public.chapter_ink
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on table public.chapter_ink to authenticated;
notify pgrst, 'reload schema';
