-- =============================================================
-- Prestação de Contas — estrutura do banco no Supabase
-- Cole tudo no Supabase em: SQL Editor → New query → Run
-- Pode ser executado mais de uma vez sem erro.
--
-- ATENÇÃO: o sistema está SEM LOGIN. As políticas abaixo liberam
-- leitura, gravação e exclusão para qualquer pessoa que tenha a
-- chave pública (que vai embutida no site). Para voltar a exigir
-- login, troque "to anon, authenticated" por "to authenticated".
-- =============================================================

-- 1) Tabela de despesas
create table if not exists public.despesas (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  data_despesa    date not null,
  valor           numeric(12,2) not null check (valor > 0),
  categoria       text not null check (categoria in ('Combustível','Alimentação','Pequenos Vultos','Itens Comprados')),
  descricao       text not null default '',
  comprovante_url text -- path do arquivo no bucket 'comprovantes'
);

create index if not exists despesas_data_idx on public.despesas (data_despesa);

-- 2) Acesso à tabela (sem login)
alter table public.despesas enable row level security;

drop policy if exists "auth_all" on public.despesas;
drop policy if exists "acesso_publico" on public.despesas;
create policy "acesso_publico" on public.despesas
  for all to anon, authenticated using (true) with check (true);

-- 3) Bucket privado para os comprovantes (arquivos só abrem por URL assinada)
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

-- 4) Envio, visualização e exclusão de comprovantes (sem login)
drop policy if exists "auth_storage" on storage.objects;
drop policy if exists "acesso_publico_storage" on storage.objects;
create policy "acesso_publico_storage" on storage.objects
  for all to anon, authenticated
  using (bucket_id = 'comprovantes') with check (bucket_id = 'comprovantes');
