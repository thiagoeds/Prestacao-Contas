# Prestação de Contas
1. `cp .env.example .env` e preencha as chaves do Supabase.
2. `npm install && npm run dev`
3. Deploy: Netlify (build `npm run build`, pasta `dist`); defina as variáveis `VITE_*` no painel.

## Banco de dados (Supabase)
No Supabase, abra **SQL Editor → New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**.
O script cria a tabela `despesas`, o bucket privado `comprovantes` e as políticas de acesso (RLS).

## Acesso sem login
O sistema abre direto, sem usuário e senha. **Qualquer pessoa com o link do site pode ver, cadastrar e apagar despesas e comprovantes.**
Para voltar a exigir login, troque `to anon, authenticated` por `to authenticated` em `supabase/schema.sql`, rode o script de novo e restaure a tela de login (`src/pages/Login.tsx` no histórico do git).
