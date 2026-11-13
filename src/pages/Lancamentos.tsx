import { useEffect, useState } from 'react'
import { Eye, Trash2 } from 'lucide-react'
import { Card, inputCls } from '../components/ui'
import { CATEGORIAS, COR_CATEGORIA, type Despesa } from '../lib/types'
import { brl, dataBR, mesAtual } from '../lib/format'
import { buscarPorMes, excluirDespesa, urlComprovante } from '../lib/despesas'

export default function Lancamentos() {
  const [mes, setMes] = useState(mesAtual())
  const [cat, setCat] = useState('')
  const [lista, setLista] = useState<Despesa[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [versao, setVersao] = useState(0) // incrementa para recarregar após exclusão
  const carregar = () => setVersao(v => v + 1)

  useEffect(() => {
    if (!mes) return // campo de mês apagado
    let ativo = true // ignora respostas antigas se o filtro mudar no meio da busca
    setCarregando(true); setErro('')
    buscarPorMes(mes, cat || undefined)
      .then(d => { if (ativo) setLista(d) })
      .catch(e => { console.error(e); if (ativo) { setLista([]); setErro('Erro ao carregar lançamentos.') } })
      .finally(() => { if (ativo) setCarregando(false) })
    return () => { ativo = false }
  }, [mes, cat, versao])

  async function ver(d: Despesa) {
    if (!d.comprovante_url) return
    // Abre a aba antes do await para o navegador do celular não bloquear o pop-up
    const aba = window.open('', '_blank')
    try { const url = await urlComprovante(d.comprovante_url); if (aba) aba.location.href = url }
    catch { aba?.close(); alert('Não foi possível abrir o comprovante.') }
  }

  async function excluir(d: Despesa) {
    if (!confirm(`Excluir "${d.descricao}" (${brl(d.valor)})? Essa ação remove também o anexo.`)) return
    try { await excluirDespesa(d); carregar() } catch { alert('Erro ao excluir.') }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap gap-3">
        <input type="month" className={`${inputCls} sm:w-auto`} value={mes} onChange={e => setMes(e.target.value)} />
        <select className={`${inputCls} sm:w-auto`} value={cat} onChange={e => setCat(e.target.value)}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
        </select>
        <p className="ml-auto self-center font-semibold text-slate-800">
          {brl(lista.reduce((s, d) => s + Number(d.valor), 0))}
        </p>
      </Card>

      <Card className="divide-y divide-slate-100 !p-0">
        {carregando && <p className="p-6 text-center text-slate-400">Carregando…</p>}
        {erro && <p className="p-6 text-center text-red-600">{erro}</p>}
        {!carregando && !erro && lista.length === 0 && <p className="p-6 text-center text-slate-400">Nenhum lançamento neste período.</p>}
        {lista.map(d => (
          <div key={d.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>{dataBR(d.data_despesa)}</span>
                <span className={`rounded-full px-2 py-0.5 ${COR_CATEGORIA[d.categoria].badge}`}>{d.categoria}</span>
              </div>
              <p className="truncate text-slate-800">{d.descricao}</p>
            </div>
            <span className="font-semibold text-slate-800">{brl(d.valor)}</span>
            <button title="Ver NFe" disabled={!d.comprovante_url} onClick={() => ver(d)}
              className="p-2 text-indigo-600 disabled:text-slate-300"><Eye size={20} /></button>
            <button title="Excluir" onClick={() => excluir(d)} className="p-2 text-red-500"><Trash2 size={20} /></button>
          </div>
        ))}
      </Card>
    </div>
  )
}
