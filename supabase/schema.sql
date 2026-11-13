-- =============================================================
-- Prestação de Contas — estrutura do banco no Supabase
-- Cole tudo no Supabase em: SQL Editor → New query → Run
-- Pode ser executado mais de uma vez sem erro.
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

-- 2) Segurança: só usuários logados acessam a tabela
alter table public.despesas enable row level security;

drop policy if exists "auth_all" on public.despesas;
create policy "auth_all" on public.despesas
  for all to authenticated using (true) with check (true);

-- 3) Bucket privado para os comprovantes
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

-- 4) Só usuários logados enviam, veem e apagam comprovantes
drop policy if exists "auth_storage" on storage.objects;
create policy "auth_storage" on storage.objects
  for all to authenticated
  using (bucket_id = 'comprovantes') with check (bucket_id = 'comprovantes');
