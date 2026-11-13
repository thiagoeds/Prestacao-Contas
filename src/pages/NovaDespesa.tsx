import { useState } from 'react'
import { Camera, Paperclip, X } from 'lucide-react'
import { Card, inputCls, btnPrimario } from '../components/ui'
import { CATEGORIAS, COR_CATEGORIA, type Categoria } from '../lib/types'
import { hoje } from '../lib/format'
import { criarDespesa, enviarComprovante } from '../lib/despesas'

export default function NovaDespesa({ aoSalvar }: { aoSalvar: () => void }) {
  const [data, setData] = useState(hoje())
  const [valor, setValor] = useState('') // guardado em centavos (só dígitos)
  const [categoria, setCategoria] = useState<Categoria>('Alimentação')
  const [descricao, setDescricao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // Máscara BRL: digita-se só números, exibe como 1.234,56
  const valorNum = Number(valor || 0) / 100
  const valorTxt = valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (valorNum <= 0) return setErro('Informe um valor maior que zero.')
    setEnviando(true); setErro('')
    try {
      const path = arquivo ? await enviarComprovante(arquivo) : null
      await criarDespesa({ data_despesa: data, valor: valorNum, categoria, descricao, comprovante_url: path })
      aoSalvar()
    } catch (err) {
      setErro('Não foi possível salvar. Tente novamente.')
      console.error(err)
    } finally { setEnviando(false) }
  }

  return (
    <Card className="max-w-lg mx-auto">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Nova despesa</h2>
      <form onSubmit={salvar} className="space-y-4">
        <label className="block text-sm text-slate-600">Data da despesa
          <input type="date" required className={inputCls} value={data} onChange={e => setData(e.target.value)} />
        </label>

        <label className="block text-sm text-slate-600">Valor (R$)
          <input inputMode="numeric" required className={inputCls} value={valorTxt}
            onChange={e => setValor(e.target.value.replace(/\D/g, '').slice(0, 10))} />
        </label>

        <div>
          <span className="text-sm text-slate-600">Categoria</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {CATEGORIAS.map(c => (
              <button type="button" key={c} onClick={() => setCategoria(c)}
                className={`rounded-xl border px-3 py-2 text-sm ${categoria === c
                  ? `${COR_CATEGORIA[c].badge} border-transparent font-medium ring-2 ring-indigo-500`
                  : 'border-slate-200 text-slate-600'}`}>{c}</button>
            ))}
          </div>
        </div>

        <label className="block text-sm text-slate-600">Descrição / itens
          <textarea required rows={3} className={inputCls} value={descricao} onChange={e => setDescricao(e.target.value)} />
        </label>

        {/* Dois inputs: com capture o celular abre SÓ a câmera (sem PDF/galeria),
            então a câmera fica em um botão separado da seleção de arquivo. */}
        <div>
          <span className="text-sm text-slate-600">Anexo da NFe / recibo</span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <Camera size={18} /> Tirar foto
              <input type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm text-indigo-700">
              <Paperclip size={18} /> Imagem ou PDF
              <input type="file" accept="image/*,application/pdf" className="hidden"
                onChange={e => setArquivo(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          {arquivo && (
            <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
              <span className="truncate">{arquivo.name}</span>
              <button type="button" onClick={() => setArquivo(null)} className="text-slate-400" title="Remover anexo"><X size={16} /></button>
            </p>
          )}
        </div>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className={`${btnPrimario} w-full`} disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar despesa'}</button>
      </form>
    </Card>
  )
}
