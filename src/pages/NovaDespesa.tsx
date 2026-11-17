import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle2, Loader2, Paperclip, RefreshCw, ScanLine, X } from 'lucide-react'
import { Card, inputCls, btnPrimario } from '../components/ui'
import { CATEGORIAS, COR_CATEGORIA, type Categoria } from '../lib/types'
import { hoje } from '../lib/format'
import { criarDespesa, enviarComprovante, prepararArquivo } from '../lib/despesas'
import type { Leitura, Origem } from '../lib/nota/leitor'

// Fluxo: 1) captura da foto → 2) leitura automática → 3) conferir e salvar → volta ao 1
type Etapa = 'captura' | 'lendo' | 'form'
type CampoLido = 'valor' | 'data' | 'categoria' | 'descricao'

// Selo ao lado do rótulo dizendo de onde veio o dado preenchido automaticamente
function Selo({ origem }: { origem?: Origem }) {
  if (!origem) return null
  const confiavel = origem !== 'foto'
  return (
    <span className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${confiavel ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
      {confiavel ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
      {origem === 'nota' ? 'da nota fiscal' : origem === 'cnpj' ? 'pelo CNPJ' : 'lido da foto — confira'}
    </span>
  )
}

const NOME_TIPO = { nfce: 'NFC-e', nfe: 'NF-e', cartao: 'Comprovante de cartão', desconhecido: 'Comprovante' }

export default function NovaDespesa({ aoVerLancamentos }: { aoVerLancamentos: () => void }) {
  const [etapa, setEtapa] = useState<Etapa>('captura')
  const [data, setData] = useState(hoje())
  const [valor, setValor] = useState('') // guardado em centavos (só dígitos)
  const [categoria, setCategoria] = useState<Categoria>('Alimentação')
  const [descricao, setDescricao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [previa, setPrevia] = useState('') // URL da miniatura da foto
  const [ampliada, setAmpliada] = useState(false)
  const [preparando, setPreparando] = useState(false) // comprimindo a imagem
  const [etapaLeitura, setEtapaLeitura] = useState('')
  const [leitura, setLeitura] = useState<Leitura | null>(null)
  const [origens, setOrigens] = useState<Partial<Record<CampoLido, Origem>>>({})
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')
  const [salvou, setSalvou] = useState(false)
  const arquivoAtual = useRef(0) // ignora compressões de arquivos já trocados
  const leituraAtual = useRef(0) // ignora leituras canceladas ("pular") ou de arquivos trocados
  const editados = useRef(new Set<CampoLido>()) // campos mexidos à mão não são sobrescritos

  // Máscara BRL: digita-se só números, exibe como 1.234,56
  const valorNum = Number(valor || 0) / 100
  const valorTxt = valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })

  useEffect(() => () => { if (previa) URL.revokeObjectURL(previa) }, [previa])

  function editar(campo: CampoLido) {
    editados.current.add(campo)
    setOrigens(o => ({ ...o, [campo]: undefined }))
  }

  // Preenche só os campos que o usuário ainda não alterou
  function aplicarLeitura(l: Leitura) {
    const novas: Partial<Record<CampoLido, Origem>> = {}
    const livre = (c: CampoLido) => !editados.current.has(c)
    if (l.valor && livre('valor')) { setValor(String(Math.round(l.valor.valor * 100))); novas.valor = l.valor.origem }
    if (l.data && livre('data')) { setData(l.data.valor); novas.data = l.data.origem }
    if (l.categoria && livre('categoria')) { setCategoria(l.categoria.valor); novas.categoria = l.categoria.origem }
    if (l.estabelecimento && livre('descricao')) { setDescricao(l.estabelecimento.valor); novas.descricao = l.estabelecimento.origem }
    setOrigens(novas)
  }

  // Limpa tudo para a próxima despesa
  function limparFormulario() {
    arquivoAtual.current++; leituraAtual.current++
    editados.current.clear()
    setData(hoje()); setValor(''); setCategoria('Alimentação'); setDescricao('')
    setArquivo(null); setPrevia(''); setPreparando(false)
    setLeitura(null); setOrigens({}); setErro(''); setEtapaLeitura('')
  }

  // Foto escolhida: comprime para o envio e, se for imagem, lê os dados antes de abrir o formulário
  async function escolherArquivo(original: File | undefined) {
    if (!original) return
    limparFormulario()
    setSalvou(false)
    const idArq = arquivoAtual.current, idLeit = leituraAtual.current
    const ehImagem = original.type.startsWith('image/')
    if (ehImagem) setPrevia(URL.createObjectURL(original))

    setPreparando(true)
    prepararArquivo(original).then(f => {
      if (idArq !== arquivoAtual.current) return
      setArquivo(f); setPreparando(false)
    })

    if (!ehImagem) { setEtapa('form'); return } // PDF: direto para o formulário

    setEtapa('lendo'); setEtapaLeitura('Preparando a leitura…')
    let l: Leitura
    try {
      const { analisarComprovante } = await import('../lib/nota/leitor')
      l = await analisarComprovante(original, e => { if (idLeit === leituraAtual.current) setEtapaLeitura(e) })
    } catch (e) {
      console.error(e)
      l = { tipo: 'desconhecido', qrLido: false, aviso: 'Não foi possível ler o comprovante. Preencha os dados manualmente.' }
    }
    if (idLeit !== leituraAtual.current) return // usuário pulou ou trocou a foto
    setLeitura(l); aplicarLeitura(l); setEtapa('form')
  }

  // "Pular": abandona a leitura e abre o formulário vazio (a foto continua anexada)
  function pularLeitura() {
    leituraAtual.current++
    setEtapa('form')
  }

  function semComprovante() {
    limparFormulario(); setSalvou(false); setEtapa('form')
  }

  function voltarParaCaptura() {
    limparFormulario(); setEtapa('captura')
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (valorNum <= 0) return setErro('Informe um valor maior que zero.')
    setEnviando(true); setErro('')
    try {
      const path = arquivo ? await enviarComprovante(arquivo) : null
      await criarDespesa({ data_despesa: data, valor: valorNum, categoria, descricao, comprovante_url: path })
      limparFormulario(); setSalvou(true); setEtapa('captura') // pronto para a próxima nota
    } catch (err) {
      setErro('Não foi possível salvar. Tente novamente.')
      console.error(err)
    } finally { setEnviando(false) }
  }

  /* ---------------- Etapa 1: captura ---------------- */
  if (etapa === 'captura') return (
    <Card className="max-w-lg mx-auto">
      {salvou && (
        <div className="mb-4 flex items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <span className="flex items-center gap-2"><CheckCircle2 size={18} /> Despesa salva!</span>
          <button type="button" onClick={aoVerLancamentos} className="font-medium underline">Ver lançamentos</button>
        </div>
      )}
      <h2 className="text-lg font-semibold text-slate-800">Nova despesa</h2>
      <p className="mb-4 text-sm text-slate-500">Fotografe a NFC-e, NF-e ou o comprovante. Os dados são preenchidos automaticamente.</p>

      {/* Dois inputs: com capture o celular abre SÓ a câmera (sem PDF/galeria) */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-3 py-8 text-white hover:bg-indigo-700">
          <Camera size={32} /> <span className="font-medium">Tirar foto</span>
          <input type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { escolherArquivo(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl bg-indigo-50 px-3 py-8 text-indigo-700 hover:bg-indigo-100">
          <Paperclip size={32} /> <span className="font-medium">Imagem ou PDF</span>
          <input type="file" accept="image/*,application/pdf" className="hidden"
            onChange={e => { escolherArquivo(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      </div>
      <button type="button" onClick={semComprovante} className="mt-4 w-full text-center text-sm text-slate-500 underline">
        Lançar sem comprovante
      </button>
    </Card>
  )

  /* ---------------- Etapa 2: lendo ---------------- */
  if (etapa === 'lendo') return (
    <Card className="max-w-lg mx-auto text-center">
      {previa && <img src={previa} alt="Comprovante" className="mx-auto mb-4 max-h-64 rounded-xl object-contain" />}
      <p className="flex items-center justify-center gap-2 font-medium text-indigo-700">
        <ScanLine size={20} className="animate-pulse" /> {etapaLeitura}
      </p>
      <p className="mt-1 text-xs text-slate-400">A primeira leitura no aparelho pode demorar um pouco mais.</p>
      <button type="button" onClick={pularLeitura} className="mt-5 text-sm text-slate-500 underline">
        Pular e preencher manualmente
      </button>
    </Card>
  )

  /* ---------------- Etapa 3: conferir e salvar ---------------- */
  return (
    <Card className="max-w-lg mx-auto">
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Confira os dados</h2>

      {/* Comprovante anexado */}
      <div className="mb-4 flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2">
        {previa
          ? <button type="button" onClick={() => setAmpliada(true)} title="Ampliar">
              <img src={previa} alt="Miniatura do comprovante" className="h-24 w-20 shrink-0 rounded-lg object-cover" />
            </button>
          : <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-lg bg-white text-xs text-slate-400">
              {arquivo || preparando ? 'PDF' : 'Sem anexo'}
            </div>}
        <div className="min-w-0 flex-1 text-sm">
          {leitura
            ? <p className="text-slate-700"><b>{NOME_TIPO[leitura.tipo]}</b>
                {leitura.chave && <> · {leitura.chave.uf} · nº {leitura.chave.numero} · {String(leitura.chave.mes).padStart(2, '0')}/{leitura.chave.ano}</>}
              </p>
            : <p className="truncate text-slate-600">{arquivo?.name ?? (preparando ? 'Preparando o arquivo…' : 'Despesa sem comprovante')}</p>}
          {preparando && <p className="mt-1 flex items-center gap-1 text-xs text-indigo-600"><Loader2 size={12} className="animate-spin" /> Preparando o arquivo…</p>}
          {previa && <p className="mt-1 text-xs text-slate-400">Toque na foto para ampliar</p>}
          <button type="button" onClick={voltarParaCaptura} className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-indigo-600">
            <RefreshCw size={14} /> {arquivo || preparando ? 'Trocar foto' : 'Anexar comprovante'}
          </button>
        </div>
      </div>

      {leitura?.aviso && (
        <p className="mb-4 flex gap-2 rounded-xl bg-amber-50 p-2 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {leitura.aviso}
        </p>
      )}

      <form onSubmit={salvar} className="space-y-4">
        <label className="block text-sm text-slate-600">
          <span>Data da despesa<Selo origem={origens.data} /></span>
          <input type="date" required className={inputCls} value={data}
            onChange={e => { editar('data'); setData(e.target.value) }} />
        </label>

        <label className="block text-sm text-slate-600">
          <span>Valor (R$)<Selo origem={origens.valor} /></span>
          <input inputMode="numeric" required className={inputCls} value={valorTxt}
            onChange={e => { editar('valor'); setValor(e.target.value.replace(/\D/g, '').slice(0, 10)) }} />
        </label>

        <div>
          <span className="text-sm text-slate-600">Categoria<Selo origem={origens.categoria} /></span>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {CATEGORIAS.map(c => (
              <button type="button" key={c} onClick={() => { editar('categoria'); setCategoria(c) }}
                className={`rounded-xl border px-3 py-2 text-sm ${categoria === c
                  ? `${COR_CATEGORIA[c].badge} border-transparent font-medium ring-2 ring-indigo-500`
                  : 'border-slate-200 text-slate-600'}`}>{c}</button>
            ))}
          </div>
        </div>

        <label className="block text-sm text-slate-600">
          <span>Descrição / itens<Selo origem={origens.descricao} /></span>
          <textarea required rows={3} className={inputCls} value={descricao}
            onChange={e => { editar('descricao'); setDescricao(e.target.value) }} />
        </label>

        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <button className={`${btnPrimario} w-full`} disabled={enviando || preparando}>
          {enviando ? 'Salvando…' : 'Salvar despesa'}
        </button>
      </form>

      {/* Foto ampliada para comparar com os campos */}
      {ampliada && previa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setAmpliada(false)}>
          <img src={previa} alt="Comprovante ampliado" className="max-h-full max-w-full rounded-lg object-contain" />
          <button type="button" className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-slate-700" title="Fechar"><X size={20} /></button>
        </div>
      )}
    </Card>
  )
}
