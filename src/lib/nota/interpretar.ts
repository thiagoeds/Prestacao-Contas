// Regras puras (sem navegador) para interpretar o QR Code, a chave de acesso
// e o texto lido por OCR de NF-e / NFC-e e comprovantes de cartão.
import type { Categoria } from '../types'

const UFS: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
}

export interface Chave {
  chave: string
  uf: string
  ano: number
  mes: number
  cnpj: string
  modelo: '55' | '65' | string // 55 = NF-e, 65 = NFC-e
  numero: number
}

/** Dígito verificador módulo 11 da chave de acesso (pesos 2..9 da direita p/ esquerda). */
function dvChave(base43: string) {
  let soma = 0, peso = 2
  for (let i = base43.length - 1; i >= 0; i--) {
    soma += Number(base43[i]) * peso
    peso = peso === 9 ? 2 : peso + 1
  }
  const resto = soma % 11
  return resto < 2 ? 0 : 11 - resto
}

/** Valida e decompõe a chave de 44 dígitos. */
export function interpretarChave(texto: string): Chave | null {
  const chave = texto.replace(/\D/g, '')
  if (chave.length !== 44 || dvChave(chave.slice(0, 43)) !== Number(chave[43])) return null
  const uf = UFS[chave.slice(0, 2)]
  const mes = Number(chave.slice(4, 6))
  if (!uf || mes < 1 || mes > 12) return null
  return {
    chave, uf, mes,
    ano: 2000 + Number(chave.slice(2, 4)),
    cnpj: chave.slice(6, 20),
    modelo: chave.slice(20, 22),
    numero: Number(chave.slice(25, 34)),
  }
}

export interface DadosQr {
  chave: Chave
  url?: string
  valor?: number // só vem no QR em notas emitidas offline (contingência) ou no QR v1
  data?: string // YYYY-MM-DD, idem
}

const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function dataValida(a: number, m: number, d: number) {
  const dt = new Date(a, m - 1, d)
  return dt.getFullYear() === a && dt.getMonth() === m - 1 && dt.getDate() === d
}

/**
 * Interpreta o conteúdo do QR Code (NFC-e v1, v2 ou v3) ou do código de barras da DANFE (44 dígitos).
 * v2/v3 online:  ?p=CHAVE|versão|ambiente|...            (sem valor nem dia)
 * v2/v3 offline: ?p=CHAVE|versão|ambiente|DIA|VALOR|...  (com dia e valor)
 * v1:            ?chNFe=CHAVE&...&dhEmi=<hex>&vNF=VALOR
 */
export function interpretarQr(conteudo: string): DadosQr | null {
  const texto = conteudo.trim()
  const url = /^https?:\/\//i.test(texto) ? texto : undefined

  // QR v1 (parâmetros nomeados)
  const ch1 = texto.match(/chNFe=(\d{44})/i)
  if (ch1) {
    const chave = interpretarChave(ch1[1])
    if (!chave) return null
    const r: DadosQr = { chave, url }
    const v = texto.match(/vNF=([\d.]+)/i)
    if (v) r.valor = Number(v[1])
    const dh = texto.match(/dhEmi=([0-9a-f]+)/i)
    if (dh) {
      const s = dh[1].match(/../g)!.map(h => String.fromCharCode(parseInt(h, 16))).join('')
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (m) r.data = `${m[1]}-${m[2]}-${m[3]}`
    }
    return r
  }

  // QR v2/v3 (parâmetro p com campos separados por |)
  const p = texto.match(/[?&]p=([^&#\s]+)/i)
  if (p) {
    const partes = decodeURIComponent(p[1]).split('|')
    const chave = interpretarChave(partes[0])
    if (!chave) return null
    const r: DadosQr = { chave, url }
    const dia = Number(partes[3])
    // Offline tem 8 campos (online tem 3 a 5): CHAVE|versão|amb|DIA|VALOR|...
    if (partes.length >= 8 && /^\d{1,2}$/.test(partes[3]) && /^\d+(\.\d{1,2})?$/.test(partes[4])) {
      r.valor = Number(partes[4])
      if (dataValida(chave.ano, chave.mes, dia)) r.data = iso(chave.ano, chave.mes, dia)
    }
    return r
  }

  // Código de barras da DANFE (só a chave)
  const chave = interpretarChave(texto)
  return chave ? { chave, url } : null
}

/* ------------------------------------------------------------------ */
/* CNPJ                                                               */
/* ------------------------------------------------------------------ */

export function cnpjValido(cnpj: string) {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false
  const dv = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = pesos.reduce((s, p, i) => s + p * Number(base[i]), 0)
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }
  return dv(c.slice(0, 12)) === Number(c[12]) && dv(c.slice(0, 13)) === Number(c[13])
}

/** Sugere a categoria pela atividade principal (CNAE) do estabelecimento. */
export function categoriaPorCnae(cnae: number | string | undefined): Categoria | undefined {
  const c = String(cnae ?? '').replace(/\D/g, '')
  if (!c) return
  const comeca = (...pref: string[]) => pref.some(p => c.startsWith(p))
  if (comeca('473')) return 'Combustível' // postos de combustível e lubrificantes
  if (comeca('561', '562', '4711', '4712', '4721', '4722', '4723', '4724', '4729', '1091'))
    return 'Alimentação' // restaurantes, lanchonetes, padarias, supermercados
  if (comeca('5223', '5229', '5221', '4921', '4922', '4923', '4924', '4929', '4950', '7711'))
    return 'Pequenos Vultos' // estacionamento, pedágio, transporte, aluguel de carro
  if (comeca('45', '46', '47')) return 'Itens Comprados' // comércio em geral
}

/* ------------------------------------------------------------------ */
/* Texto do OCR                                                       */
/* ------------------------------------------------------------------ */

export type TipoComprovante = 'nfce' | 'nfe' | 'pix' | 'cartao' | 'desconhecido'

export interface DadosTexto {
  tipo: TipoComprovante
  valor?: number
  data?: string
  cnpj?: string
  chave?: Chave
  categoria?: Categoria
  recebedor?: string // Pix: nome de quem recebeu
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

// Valor monetário: 1.234,56 | 1234,56 | 50.00 | 50, 00
const RE_VALOR = /(\d{1,3}(?:[.\s]\d{3})+|\d+)\s?[,.]\s?(\d{2})(?!\d)/g

function valoresNaLinha(linha: string) {
  return [...linha.matchAll(RE_VALOR)]
    .map(m => Number(m[1].replace(/[.\s]/g, '') + '.' + m[2]))
    .filter(v => v > 0 && v < 1_000_000)
}

// Ordem de preferência das linhas que costumam trazer o total
const CHAVES_TOTAL = ['VALOR A PAGAR', 'VALOR PAGO', 'TOTAL A PAGAR', 'VALOR TOTAL', 'VALOR APROVADO', 'TOTAL R', 'VALOR:', 'VALOR', 'TOTAL']
const IGNORAR_LINHA = /TRIBUT|ITENS|DESCONTO|TROCO|IMPOSTO|LEI\b|ACRESC|PARCELA|SALDO|LIMITE|QTD|QTDE/

function extrairValor(linhas: string[]): number | undefined {
  for (const chave of CHAVES_TOTAL) {
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i]
      if (!l.includes(chave) || IGNORAR_LINHA.test(l)) continue
      const v = valoresNaLinha(l)
      if (v.length) return v[v.length - 1]
      const prox = linhas[i + 1] && !IGNORAR_LINHA.test(linhas[i + 1]) ? valoresNaLinha(linhas[i + 1]) : []
      if (prox.length) return prox[prox.length - 1]
    }
  }
  // Último recurso: maior valor precedido de R$
  const comRs = linhas.filter(l => /R\s?\$/.test(l) && !IGNORAR_LINHA.test(l)).flatMap(valoresNaLinha)
  return comRs.length ? Math.max(...comRs) : undefined
}

const MESES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']

function extrairData(linhas: string[]): string | undefined {
  const hoje = new Date()
  const candidatas: { iso: string; prioridade: number }[] = []
  linhas.forEach(l => {
    for (const m of l.matchAll(/(\d{2})\s?[/.-]\s?(\d{2})\s?[/.-]\s?(\d{4}|\d{2})(?!\d)/g)) {
      const d = Number(m[1]), mes = Number(m[2])
      const a = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])
      if (a < 2015 || !dataValida(a, mes, d) || new Date(a, mes - 1, d) > hoje) continue
      candidatas.push({ iso: iso(a, mes, d), prioridade: /EMISS|DATA/.test(l) ? 0 : 1 })
    }
    // Mês por extenso (comum em comprovantes de Pix): 17 NOV 2026 | 17 de novembro de 2026 | 17/nov/2026
    for (const m of l.matchAll(/\b(\d{1,2})\s*(?:DE\s+|[/.-]\s*)?(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*\.?\s*(?:DE\s+|[/.-]\s*)?(\d{4})\b/g)) {
      const d = Number(m[1]), mes = MESES.indexOf(m[2]) + 1, a = Number(m[3])
      if (a < 2015 || !dataValida(a, mes, d) || new Date(a, mes - 1, d) > hoje) continue
      candidatas.push({ iso: iso(a, mes, d), prioridade: /EMISS|DATA/.test(l) ? 0 : 1 })
    }
  })
  candidatas.sort((x, y) => x.prioridade - y.prioridade)
  return candidatas[0]?.iso
}

function extrairCnpj(texto: string): string | undefined {
  for (const m of texto.matchAll(/(\d{2})\s?\.?\s?(\d{3})\s?\.?\s?(\d{3})\s?\/?\s?(\d{4})\s?-?\s?(\d{2})/g)) {
    const c = m.slice(1).join('')
    if (cnpjValido(c)) return c
  }
}

function extrairChave(linhas: string[]): Chave | undefined {
  // A chave aparece em blocos de 4 dígitos; junta linhas vizinhas porque às vezes quebra
  for (let i = 0; i < linhas.length; i++) {
    for (const trecho of [linhas[i], linhas[i] + ' ' + (linhas[i + 1] ?? '')]) {
      const digitos = trecho.replace(/[^\d]/g, '')
      for (let j = 0; j + 44 <= digitos.length; j++) {
        const c = interpretarChave(digitos.slice(j, j + 44))
        if (c) return c
      }
    }
  }
}

function categoriaPorPalavras(t: string): Categoria | undefined {
  if (/POSTO|GASOLINA|ETANOL|DIESEL|COMBUSTIVE|GNV|ALCOOL COMUM/.test(t)) return 'Combustível'
  if (/ESTACIONAMENTO|PEDAGIO|\bUBER\b|\b99\s?POP|TAXI|ESTACIONAR/.test(t)) return 'Pequenos Vultos'
  if (/RESTAURANTE|LANCHONETE|PADARIA|REFEICAO|ALMOCO|PIZZARIA|CHURRASC|SELF.?SERVICE|MARMITEX|LANCHE|CAFE|BAR\b/.test(t))
    return 'Alimentação'
}

/** Extrai tipo, valor, data, CNPJ e chave do texto bruto lido por OCR. */
export function interpretarTexto(textoOriginal: string): DadosTexto {
  const t = semAcento(textoOriginal)
  const linhas = t.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  let tipo: TipoComprovante = 'desconhecido'
  if (/NFC-?E|CONSUMIDOR ELETRONICA|NOTA FISCAL DE CONSUMIDOR/.test(t)) tipo = 'nfce'
  else if (/DANFE|NOTA FISCAL ELETRONICA/.test(t)) tipo = 'nfe'
  else if (/\bPIX\b|ID DA TRANSACAO|\bE2E\b|END TO END|CHAVE ALEATORIA/.test(t)) tipo = 'pix'
  else if (/VIA (DO )?CLIENTE|VIA CLIENTE|\bAUT(ORIZACAO)?\b|CREDITO|DEBITO|\bDOC\b|\bNSU\b/.test(t)) tipo = 'cartao'

  // No Pix o comprovante traz quem recebeu e quem pagou: prioriza o bloco do recebedor
  const rec = tipo === 'pix' ? blocoRecebedor(linhas) : undefined

  return {
    tipo,
    valor: extrairValor(linhas),
    data: extrairData(linhas),
    cnpj: (rec && extrairCnpj(rec.texto)) || extrairCnpj(t),
    chave: extrairChave(linhas),
    categoria: categoriaPorPalavras(rec?.texto ?? t) ?? categoriaPorPalavras(t),
    recebedor: rec?.nome,
  }
}

const RE_RECEBEDOR = /^(DESTINO|PARA\b|RECEBEDOR|FAVORECIDO|DADOS DO RECEBEDOR|DADOS DO FAVORECIDO|QUEM RECEBEU|BENEFICIARIO)/
const RE_PAGADOR = /^(ORIGEM|DE\b|PAGADOR|DADOS DO PAGADOR|QUEM PAGOU|REMETENTE|DADOS DE QUEM PAGOU)/
const RE_ROTULO = /^(NOME|CPF|CNPJ|INSTITUICAO|BANCO|AGENCIA|CONTA|CHAVE|TIPO|ID|VALOR|DATA)\b/

/** Trecho do comprovante de Pix entre o rótulo do recebedor e o do pagador, e o nome do recebedor. */
function blocoRecebedor(linhas: string[]): { texto: string; nome?: string } | undefined {
  const ini = linhas.findIndex(l => RE_RECEBEDOR.test(l))
  if (ini < 0) return
  let fim = linhas.findIndex((l, i) => i > ini && RE_PAGADOR.test(l))
  if (fim < 0) fim = linhas.length
  const bloco = linhas.slice(ini, fim)

  let nome: string | undefined
  const naMesmaLinha = bloco[0].replace(RE_RECEBEDOR, '').replace(/^[\s:–-]+/, '').trim() // "Para: Fulano"
  if (naMesmaLinha.length > 2 && !RE_ROTULO.test(naMesmaLinha)) nome = naMesmaLinha
  if (!nome) {
    const iNome = bloco.findIndex(l => /^NOME\b/.test(l))
    const resto = iNome >= 0 ? bloco[iNome].replace(/^NOME\s*:?\s*/, '').trim() : ''
    nome = resto.length > 2 ? resto
      : iNome >= 0 ? bloco[iNome + 1]
      : bloco.slice(1).find(l => !RE_ROTULO.test(l) && /[A-Z]{3}/.test(l) && !/\d{3}/.test(l))
  }
  return { texto: bloco.join('\n'), nome: nome?.trim() || undefined }
}
