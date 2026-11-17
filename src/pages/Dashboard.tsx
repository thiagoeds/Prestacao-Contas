import { useEffect, useMemo, useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card, inputCls, btnPrimario } from '../components/ui'
import { CATEGORIAS, COR_CATEGORIA, type Despesa } from '../lib/types'
import { brl, limitesDoMes, mesAtual } from '../lib/format'
import { buscarDespesas } from '../lib/despesas'
import { exportarExcel } from '../lib/excel'

export default function Dashboard() {
  const m = limitesDoMes(mesAtual())
  const [ini, setIni] = useState(m.ini)
  const [fim, setFim] = useState(m.fim)
  const [dados, setDados] = useState<Despesa[]>([])

  const [erro, setErro] = useState('')
  const [gerandoPdf, setGerandoPdf] = useState('') // progresso do relatório PDF

  // PDF com resumo, lista e uma página por comprovante (carregado sob demanda)
  async function baixarPdf() {
    setGerandoPdf('Preparando…')
    try {
      const { exportarPdf } = await import('../lib/relatorioPdf')
      await exportarPdf(dados, ini, fim, setGerandoPdf)
    } catch (e) {
      console.error(e); alert('Erro ao gerar o PDF.')
    } finally { setGerandoPdf('') }
  }

  useEffect(() => {
    if (!ini || !fim || ini > fim) return // período incompleto ou invertido
    let ativo = true // descarta respostas de filtros antigos
    setErro('')
    buscarDespesas(ini, fim)
      .then(d => { if (ativo) setDados(d) })
      .catch(e => { console.error(e); if (ativo) { setDados([]); setErro('Erro ao carregar dados do período.') } })
    return () => { ativo = false }
  }, [ini, fim])

  const total = dados.reduce((s, d) => s + Number(d.valor), 0)

  // Total por categoria (ranking)
  const porCategoria = useMemo(() =>
    CATEGORIAS.map(c => ({ nome: c, total: dados.filter(d => d.categoria === c).reduce((s, d) => s + Number(d.valor), 0) }))
      .sort((a, b) => b.total - a.total), [dados])
  const maior = porCategoria[0]?.total > 0 ? porCategoria[0].nome : '—'

  // Evolução: por dia se o período ≤ 31 dias, senão por mês
  const evolucao = useMemo(() => {
    const mensal = (new Date(fim).getTime() - new Date(ini).getTime()) / 864e5 > 31
    const mapa = new Map<string, number>()
    dados.forEach(d => {
      const k = mensal ? d.data_despesa.slice(0, 7) : d.data_despesa
      mapa.set(k, (mapa.get(k) ?? 0) + Number(d.valor))
    })
    return [...mapa].sort().map(([k, v]) => ({
      rotulo: mensal ? k.split('-').reverse().join('/') : k.slice(8) + '/' + k.slice(5, 7), total: v,
    }))
  }, [dados, ini, fim])

  const kpis = [
    { t: 'Total gasto no período', v: brl(total) },
    { t: 'Lançamentos', v: String(dados.length) },
    { t: 'Maior categoria de gasto', v: maior },
  ]

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-slate-600">De<input type="date" className={inputCls} value={ini} onChange={e => setIni(e.target.value)} /></label>
        <label className="text-sm text-slate-600">Até<input type="date" className={inputCls} value={fim} onChange={e => setFim(e.target.value)} /></label>
        <div className="ml-auto flex flex-wrap gap-2">
          <button className={`${btnPrimario} flex items-center gap-2`} disabled={!dados.length || !!gerandoPdf} onClick={baixarPdf}>
            {gerandoPdf ? <><Loader2 size={18} className="animate-spin" /> {gerandoPdf}</> : <><FileText size={18} /> Relatório PDF com comprovantes</>}
          </button>
          <button className="flex items-center gap-2 rounded-xl border border-indigo-200 px-4 py-2.5 font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50" disabled={!dados.length}
            onClick={() => exportarExcel(dados, `${ini}_a_${fim}`).catch(() => alert('Erro ao gerar o Excel.'))}>
            <Download size={18} /> Excel (.xlsx)
          </button>
        </div>
        {ini > fim && <p className="w-full text-sm text-red-600">A data inicial deve ser anterior à final.</p>}
        {erro && <p className="w-full text-sm text-red-600">{erro}</p>}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map(k => (
          <Card key={k.t}><p className="text-sm text-slate-500">{k.t}</p><p className="mt-1 text-2xl font-semibold text-slate-800">{k.v}</p></Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-medium text-slate-700">Evolução dos gastos</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="rotulo" fontSize={12} /><YAxis fontSize={12} width={50} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="total" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <h3 className="mb-3 font-medium text-slate-700">Gastos por categoria</h3>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={porCategoria} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" fontSize={12} /><YAxis type="category" dataKey="nome" fontSize={12} width={110} />
                <Tooltip formatter={(v: number) => brl(v)} />
                <Bar dataKey="total" radius={[0, 6, 6, 0]}>
                  {porCategoria.map(c => <Cell key={c.nome} fill={COR_CATEGORIA[c.nome].hex} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
