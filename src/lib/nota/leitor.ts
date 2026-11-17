// Leitura do comprovante no próprio navegador (sem IA):
// 1) QR Code / código de barras  2) OCR (Tesseract) + regras  3) CNPJ na BrasilAPI
import type { Worker } from 'tesseract.js'
import type { Categoria } from '../types'
import { categoriaPorCnae, interpretarQr, interpretarTexto, type Chave, type TipoComprovante } from './interpretar'

export type Origem = 'nota' | 'cnpj' | 'foto' // nota = QR Code; cnpj = cadastro da empresa; foto = OCR
export interface Campo<T> { valor: T; origem: Origem }

export interface Leitura {
  tipo: TipoComprovante
  chave?: Chave
  urlConsulta?: string // link da SEFAZ no QR Code (para a consulta da fase 2)
  qrLido: boolean
  valor?: Campo<number>
  data?: Campo<string>
  categoria?: Campo<Categoria>
  estabelecimento?: Campo<string>
  aviso?: string
}

/* ---------------- Imagem ---------------- */

async function carregarImagem(arquivo: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(arquivo)
  } catch {
    // Alguns navegadores não decodificam via createImageBitmap; tenta pela tag <img>
    const url = URL.createObjectURL(arquivo)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally { URL.revokeObjectURL(url) }
  }
}

/** Desenha a imagem (ou um recorte vertical dela) em um canvas com lado maior = maxLado. */
function desenhar(img: ImageBitmap | HTMLImageElement, maxLado: number, cinza = false, recorteY = 0) {
  const w0 = img.width, h0 = Math.round(img.height * (1 - recorteY)), y0 = img.height - h0
  const esc = Math.min(1, maxLado / Math.max(w0, h0))
  const c = document.createElement('canvas')
  c.width = Math.round(w0 * esc); c.height = Math.round(h0 * esc)
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  if (cinza) ctx.filter = 'grayscale(1) contrast(1.4)'
  ctx.drawImage(img, 0, y0, w0, h0, 0, 0, c.width, c.height)
  return { canvas: c, ctx }
}

/* ---------------- QR Code ---------------- */

interface Detector { detect(src: CanvasImageSource): Promise<{ rawValue: string }[]> }

async function lerCodigo(img: ImageBitmap | HTMLImageElement): Promise<string | null> {
  // Leitor nativo (Chrome/Android): lê QR Code e o código de barras da DANFE
  const BD = (window as unknown as { BarcodeDetector?: { new (o: object): Detector; getSupportedFormats(): Promise<string[]> } }).BarcodeDetector
  if (BD) {
    try {
      const suportados = await BD.getSupportedFormats()
      const formatos = ['qr_code', 'code_128'].filter(f => suportados.includes(f))
      if (formatos.length) {
        const achados = await new BD({ formats: formatos }).detect(img)
        const util = achados.find(a => interpretarQr(a.rawValue))
        if (util) return util.rawValue
      }
    } catch { /* segue para o jsQR */ }
  }
  // jsQR (funciona em qualquer navegador): tenta alguns tamanhos e o terço inferior ampliado
  const { default: jsQR } = await import('jsqr')
  const tentativas: [number, number][] = [[1200, 0], [1800, 0], [1600, 0.5], [800, 0]]
  for (const [lado, recorte] of tentativas) {
    const { canvas, ctx } = desenhar(img, lado, false, recorte)
    const d = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const r = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' })
    if (r?.data) return r.data
    await new Promise(res => setTimeout(res)) // não trava a tela entre as tentativas
  }
  return null
}

/* ---------------- OCR ---------------- */

let workerOcr: Promise<Worker> | null = null
function obterWorker() {
  if (!workerOcr) {
    workerOcr = import('tesseract.js').then(t => t.createWorker('por'))
    workerOcr.catch(() => { workerOcr = null }) // permite tentar de novo se o download falhar
  }
  return workerOcr
}

async function lerTexto(img: ImageBitmap | HTMLImageElement): Promise<string> {
  const { canvas } = desenhar(img, 2000, true)
  const worker = await obterWorker()
  const { data } = await worker.recognize(canvas)
  return data.text
}

/* ---------------- CNPJ ---------------- */

type Empresa = { nome: string; categoria?: Categoria }
const CHAVE_CACHE = 'cache-cnpj-v1'

// Cache local: os mesmos postos e restaurantes se repetem, então evita consultar de novo
function lerCache(): Record<string, Empresa> {
  try { return JSON.parse(localStorage.getItem(CHAVE_CACHE) || '{}') } catch { return {} }
}
function gravarCache(cnpj: string, e: Empresa) {
  try { localStorage.setItem(CHAVE_CACHE, JSON.stringify({ ...lerCache(), [cnpj]: e })) } catch { /* sem armazenamento */ }
}

async function consultarCnpj(cnpj: string): Promise<Empresa | null> {
  const emCache = lerCache()[cnpj]
  if (emCache) return emCache
  const e = await consultarBrasilApi(cnpj)
  if (e?.nome) gravarCache(cnpj, e)
  return e
}

async function consultarBrasilApi(cnpj: string): Promise<Empresa | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: ctrl.signal })
    if (!r.ok) return null
    const j = await r.json() as { razao_social?: string; nome_fantasia?: string; cnae_fiscal?: number }
    return { nome: (j.nome_fantasia || j.razao_social || '').trim(), categoria: categoriaPorCnae(j.cnae_fiscal) }
  } catch { return null } finally { clearTimeout(t) }
}

const titulo = (s: string) => s.toLowerCase().replace(/(^|\s)\S/g, l => l.toUpperCase())

/* ---------------- Fluxo completo ---------------- */

/** Lê o comprovante e devolve os campos encontrados, cada um com a sua origem. */
export async function analisarComprovante(arquivo: File, aoProgredir?: (etapa: string) => void): Promise<Leitura> {
  const res: Leitura = { tipo: 'desconhecido', qrLido: false }
  let img: ImageBitmap | HTMLImageElement
  try {
    img = await carregarImagem(arquivo)
  } catch {
    return { ...res, aviso: 'Não foi possível abrir a imagem para leitura. Preencha os dados manualmente.' }
  }

  // 1) QR Code / código de barras
  aoProgredir?.('Procurando o QR Code…')
  const codigo = await lerCodigo(img).catch(() => null)
  const qr = codigo ? interpretarQr(codigo) : null
  if (qr) {
    res.qrLido = true
    res.chave = qr.chave
    res.urlConsulta = qr.url
    res.tipo = qr.chave.modelo === '55' ? 'nfe' : 'nfce'
    if (qr.valor) res.valor = { valor: qr.valor, origem: 'nota' }
    if (qr.data) res.data = { valor: qr.data, origem: 'nota' }
  }

  // 2) OCR do texto (só se ainda faltar valor ou data)
  let cnpjTexto: string | undefined
  let categoriaTexto: Categoria | undefined
  let recebedor: string | undefined
  if (!res.valor || !res.data) {
    aoProgredir?.('Lendo o texto da foto…')
    try {
      const t = interpretarTexto(await lerTexto(img))
      if (!res.qrLido) res.tipo = t.tipo
      if (!res.chave && t.chave) { res.chave = t.chave; if (res.tipo === 'desconhecido') res.tipo = t.chave.modelo === '55' ? 'nfe' : 'nfce' }
      if (!res.valor && t.valor) res.valor = { valor: t.valor, origem: 'foto' }
      // A chave diz o mês/ano da nota: só aceita a data do OCR se bater com ela
      if (!res.data && t.data) {
        const ok = !res.chave || t.data.startsWith(`${res.chave.ano}-${String(res.chave.mes).padStart(2, '0')}`)
        if (ok) res.data = { valor: t.data, origem: 'foto' }
      }
      cnpjTexto = t.cnpj
      categoriaTexto = t.categoria
      recebedor = t.recebedor
    } catch (e) {
      console.warn('OCR falhou', e)
    }
  }

  // 3) Estabelecimento e categoria pelo CNPJ
  const cnpj = res.chave?.cnpj ?? cnpjTexto
  if (cnpj) {
    aoProgredir?.('Consultando o estabelecimento…')
    const emp = await consultarCnpj(cnpj)
    if (emp?.nome) res.estabelecimento = { valor: titulo(emp.nome), origem: 'cnpj' }
    if (emp?.categoria) res.categoria = { valor: emp.categoria, origem: 'cnpj' }
  }
  if (!res.categoria && categoriaTexto) res.categoria = { valor: categoriaTexto, origem: 'foto' }
  if (!res.estabelecimento && recebedor) res.estabelecimento = { valor: titulo(recebedor), origem: 'foto' }

  // Avisos para o usuário
  if (res.tipo === 'pix')
    res.aviso = 'Comprovante de Pix não é documento fiscal. Confira os dados e, se possível, anexe também a nota.'
  else if (!res.qrLido && (res.tipo === 'cartao' || res.tipo === 'desconhecido'))
    res.aviso = 'Comprovante sem QR Code fiscal. Confira os dados preenchidos ou fotografe a nota fiscal.'
  else if (!res.qrLido)
    res.aviso = 'Não consegui ler o QR Code. Os dados foram lidos do texto da foto — confira antes de salvar.'
  else if (!res.valor || !res.data)
    res.aviso = 'Nota identificada pelo QR Code. Confira valor e data, que foram lidos do texto da foto.'

  if ('close' in img) img.close()
  return res
}
