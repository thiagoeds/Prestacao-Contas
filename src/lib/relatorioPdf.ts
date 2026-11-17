// Relatório em PDF: resumo + lista de despesas + uma página por comprovante anexado.
import type { PDFDocument as Doc, PDFFont, PDFPage } from 'pdf-lib'
import { supabase } from './supabase'
import { CATEGORIAS, type Despesa } from './types'
import { brl, dataBR } from './format'

const A4: [number, number] = [595.28, 841.89]
const M = 40 // margem
const LARGURA = A4[0] - 2 * M

// As fontes padrão do PDF só aceitam o alfabeto WinAnsi (acentos do português incluídos);
// remove o que ficar de fora (emoji etc.) para não quebrar a geração.
const EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'
const limpar = (s: string) => [...s.replace(/\s+/g, ' ')].filter(c => c.charCodeAt(0) < 256 || EXTRAS.includes(c)).join('')

/** Corta o texto com reticências para caber na largura. */
function caber(texto: string, fonte: PDFFont, tam: number, largura: number) {
  let t = limpar(texto)
  if (fonte.widthOfTextAtSize(t, tam) <= largura) return t
  while (t && fonte.widthOfTextAtSize(t + '…', tam) > largura) t = t.slice(0, -1)
  return t + '…'
}

/** Imagem → JPEG via canvas (corrige a rotação da foto e aceita PNG/WEBP/etc.). */
async function imagemParaJpeg(blob: Blob): Promise<{ bytes: ArrayBuffer; w: number; h: number }> {
  const bmp = await createImageBitmap(blob)
  const esc = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * esc); c.height = Math.round(bmp.height * esc)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height) // fundo branco p/ PNG transparente
  ctx.drawImage(bmp, 0, 0, c.width, c.height)
  bmp.close()
  const jpeg = await new Promise<Blob>((ok, falha) => c.toBlob(b => b ? ok(b) : falha(new Error('toBlob')), 'image/jpeg', 0.85))
  return { bytes: await jpeg.arrayBuffer(), w: c.width, h: c.height }
}

/** Ajusta (w,h) dentro da caixa mantendo a proporção. */
function encaixar(w: number, h: number, maxW: number, maxH: number) {
  const e = Math.min(maxW / w, maxH / h, 1.5)
  return { w: w * e, h: h * e }
}

export async function exportarPdf(despesas: Despesa[], ini: string, fim: string, aoProgredir?: (msg: string) => void) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const pdf: Doc = await PDFDocument.create()
  pdf.setTitle(`Prestação de Contas ${dataBR(ini)} a ${dataBR(fim)}`)
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold)
  const cinza = rgb(0.4, 0.45, 0.5), escuro = rgb(0.1, 0.12, 0.16), linhaCor = rgb(0.88, 0.9, 0.93)

  // Ordem cronológica; o nº de cada despesa é o mesmo da página do comprovante
  const lista = [...despesas].sort((a, b) => a.data_despesa.localeCompare(b.data_despesa) || a.created_at.localeCompare(b.created_at))
  const total = lista.reduce((s, d) => s + Number(d.valor), 0)

  let pag: PDFPage = pdf.addPage(A4)
  let y = A4[1] - M
  const texto = (t: string, x: number, tam = 10, fonte = normal, cor = escuro) =>
    pag.drawText(limpar(t), { x, y, size: tam, font: fonte, color: cor })
  const direita = (t: string, xFim: number, tam = 10, fonte = normal) =>
    pag.drawText(limpar(t), { x: xFim - fonte.widthOfTextAtSize(limpar(t), tam), y, size: tam, font: fonte, color: escuro })
  const traco = () => pag.drawLine({ start: { x: M, y: y - 4 }, end: { x: A4[0] - M, y: y - 4 }, thickness: 0.5, color: linhaCor })

  /* ---------- Capa / resumo ---------- */
  texto('Prestação de Contas', M, 20, negrito); y -= 22
  texto(`Período: ${dataBR(ini)} a ${dataBR(fim)}   ·   Gerado em ${new Date().toLocaleString('pt-BR')}`, M, 10, normal, cinza); y -= 30

  texto('Resumo por categoria', M, 13, negrito); y -= 18
  for (const c of CATEGORIAS) {
    const v = lista.filter(d => d.categoria === c).reduce((s, d) => s + Number(d.valor), 0)
    texto(c, M); direita(brl(v), M + 260); traco(); y -= 16
  }
  texto('TOTAL GERAL', M, 11, negrito); direita(brl(total), M + 260, 11, negrito); y -= 32

  /* ---------- Tabela de despesas ---------- */
  const col = { n: M, data: M + 28, cat: M + 92, desc: M + 190, valor: M + 430, anexo: M + 440 }
  const cabecalho = () => {
    texto('Nº', col.n, 9, negrito, cinza); texto('Data', col.data, 9, negrito, cinza); texto('Categoria', col.cat, 9, negrito, cinza)
    texto('Descrição', col.desc, 9, negrito, cinza); direita('Valor', col.valor, 9, negrito); texto('Comprovante', col.anexo, 9, negrito, cinza)
    traco(); y -= 16
  }
  texto(`Despesas (${lista.length})`, M, 13, negrito); y -= 18
  cabecalho()
  lista.forEach((d, i) => {
    if (y < M + 20) { pag = pdf.addPage(A4); y = A4[1] - M; cabecalho() }
    texto(String(i + 1), col.n, 9); texto(dataBR(d.data_despesa), col.data, 9); texto(d.categoria, col.cat, 9)
    pag.drawText(caber(d.descricao, normal, 9, col.valor - col.desc - 70), { x: col.desc, y, size: 9, font: normal, color: escuro })
    direita(brl(Number(d.valor)), col.valor, 9)
    texto(d.comprovante_url ? 'Anexo' : 'Sem anexo', col.anexo, 9, normal, d.comprovante_url ? escuro : cinza)
    traco(); y -= 15
  })

  /* ---------- Páginas dos comprovantes ---------- */
  const comAnexo = lista.map((d, i) => ({ d, n: i + 1 })).filter(x => x.d.comprovante_url)
  const topoComprovante = (d: Despesa, n: number, extra = '') => {
    pag = pdf.addPage(A4); y = A4[1] - M
    texto(`Comprovante da despesa nº ${n}${extra}`, M, 13, negrito); y -= 16
    texto(`${dataBR(d.data_despesa)}  ·  ${d.categoria}  ·  ${brl(Number(d.valor))}`, M, 10, normal, cinza); y -= 14
    pag.drawText(caber(d.descricao, normal, 10, LARGURA), { x: M, y, size: 10, font: normal, color: cinza }); y -= 14
  }

  for (const [k, { d, n }] of comAnexo.entries()) {
    aoProgredir?.(`Incluindo comprovante ${k + 1} de ${comAnexo.length}…`)
    try {
      const { data: blob, error } = await supabase.storage.from('comprovantes').download(d.comprovante_url!)
      if (error || !blob) throw error ?? new Error('download vazio')
      const ehPdf = blob.type === 'application/pdf' || /\.pdf$/i.test(d.comprovante_url!)

      if (ehPdf) {
        const origem = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
        const indices = origem.getPageIndices()
        const paginas = await pdf.embedPdf(origem, indices)
        paginas.forEach((p, i) => {
          topoComprovante(d, n, paginas.length > 1 ? ` (página ${i + 1} de ${paginas.length})` : '')
          const { w, h } = encaixar(p.width, p.height, LARGURA, y - M)
          pag.drawPage(p, { x: M + (LARGURA - w) / 2, y: y - 8 - h, width: w, height: h })
        })
      } else {
        const img = await imagemParaJpeg(blob)
        const emb = await pdf.embedJpg(img.bytes)
        topoComprovante(d, n)
        const { w, h } = encaixar(img.w, img.h, LARGURA, y - M - 8)
        pag.drawImage(emb, { x: M + (LARGURA - w) / 2, y: y - 8 - h, width: w, height: h })
      }
    } catch (e) {
      console.error('Comprovante não incluído', d.comprovante_url, e)
      topoComprovante(d, n); y -= 20
      texto('Não foi possível incluir este comprovante no relatório.', M, 11, negrito, rgb(0.75, 0.2, 0.2))
    }
  }

  /* ---------- Rodapé com numeração ---------- */
  const paginas = pdf.getPages()
  paginas.forEach((p, i) => {
    const t = `Página ${i + 1} de ${paginas.length}`
    p.drawText(t, { x: A4[0] - M - normal.widthOfTextAtSize(t, 8), y: 20, size: 8, font: normal, color: cinza })
  })

  aoProgredir?.('Gerando o arquivo…')
  const bytes = await pdf.save()
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }))
  const a = document.createElement('a')
  a.href = url; a.download = `prestacao-contas-${ini}_a_${fim}.pdf`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
