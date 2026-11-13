import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

const raiz = ReactDOM.createRoot(document.getElementById('root')!)

// Sem as variáveis do Supabase o app não funciona: mostra instruções em vez de tela branca
const url: string = import.meta.env.VITE_SUPABASE_URL ?? ''
const chave: string = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
// Valores do .env.example ('SEU-PROJETO', 'SUA-CHAVE') contam como não preenchidos
const configurado = url && chave && !url.includes('SEU-PROJETO') && !chave.includes('SUA-CHAVE')

if (!configurado) {
  raiz.render(
    <div className="min-h-screen grid place-items-center p-4">
      <div className="max-w-md rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-3 text-slate-700">
        <h1 className="text-lg font-semibold text-slate-800">Configuração do Supabase ausente</h1>
        <p>Crie o arquivo <code className="rounded bg-slate-100 px-1">.env</code> na raiz do projeto (copie o <code className="rounded bg-slate-100 px-1">.env.example</code>) com:</p>
        <pre className="rounded-xl bg-slate-100 p-3 text-sm overflow-x-auto">VITE_SUPABASE_URL=...{'\n'}VITE_SUPABASE_ANON_KEY=...</pre>
        <p className="text-sm text-slate-500">Os valores ficam no Supabase em Project Settings → API. Depois reinicie o <code>npm run dev</code>. No Netlify, defina as mesmas variáveis no painel.</p>
      </div>
    </div>
  )
} else {
  // Import dinâmico: o cliente do Supabase só é criado quando as variáveis existem
  import('./App').then(({ default: App }) =>
    raiz.render(<React.StrictMode><App /></React.StrictMode>)
  )
}
