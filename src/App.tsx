import { lazy, Suspense, useState } from 'react'
import { FilePlus2, List, BarChart3 } from 'lucide-react'
import NovaDespesa from './pages/NovaDespesa'
import Lancamentos from './pages/Lancamentos'
// Dashboard (recharts) carregado sob demanda para reduzir o bundle inicial
const Dashboard = lazy(() => import('./pages/Dashboard'))

const ABAS = [
  { id: 'nova', rotulo: 'Nova Despesa', Icone: FilePlus2 },
  { id: 'lista', rotulo: 'Lançamentos', Icone: List },
  { id: 'dash', rotulo: 'Dashboard & Excel', Icone: BarChart3 },
] as const
type AbaId = (typeof ABAS)[number]['id']

// Sem login: o sistema abre direto (acesso liberado pelas políticas em supabase/schema.sql)
export default function App() {
  const [aba, setAba] = useState<AbaId>('nova')

  return (
    <div className="min-h-screen md:pl-24">
      {/* Barra lateral (desktop) */}
      <aside className="hidden md:flex fixed left-3 top-3 bottom-3 w-[72px] flex-col items-center rounded-3xl bg-indigo-600 py-6 text-white">
        <nav className="flex flex-col gap-3">
          {ABAS.map(({ id, rotulo, Icone }) => (
            <button key={id} title={rotulo} onClick={() => setAba(id)}
              className={`p-3 rounded-2xl ${aba === id ? 'bg-white text-indigo-600' : 'hover:bg-indigo-500'}`}>
              <Icone size={22} />
            </button>
          ))}
        </nav>
      </aside>

      {/* Conteúdo */}
      <main className="mx-auto max-w-5xl p-4 pb-24 md:p-8">
        <header className="mb-4 md:hidden">
          <h1 className="text-lg font-semibold text-slate-800">Prestação de Contas</h1>
        </header>
        {aba === 'nova' && <NovaDespesa aoSalvar={() => setAba('lista')} />}
        {aba === 'lista' && <Lancamentos />}
        {aba === 'dash' && (
          <Suspense fallback={<p className="p-6 text-center text-slate-400">Carregando…</p>}><Dashboard /></Suspense>
        )}
      </main>

      {/* Barra inferior (celular) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 grid grid-cols-3 border-t border-slate-200 bg-white">
        {ABAS.map(({ id, rotulo, Icone }) => (
          <button key={id} onClick={() => setAba(id)}
            className={`flex flex-col items-center gap-1 py-2 text-xs ${aba === id ? 'text-indigo-600' : 'text-slate-400'}`}>
            <Icone size={20} />{rotulo}
          </button>
        ))}
      </nav>
    </div>
  )
}
