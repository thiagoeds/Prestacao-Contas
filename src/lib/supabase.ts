import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Falha cedo com mensagem clara (evita tela branca sem explicação no deploy)
if (!url || !chave) {
  throw new Error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env (ou no painel do Netlify).')
}

// Cliente único do Supabase (variáveis definidas no .env / painel do Netlify)
export const supabase = createClient(url, chave)
