import { CATEGORIAS, type Despesa } from './types'
import { dataBR } from './format'

/** Gera e baixa o relatório .xlsx com duas abas. */
export async function exportarExcel(despesas: Despesa[], periodo: string) {
  // Carrega a SheetJS só quando o botão é clicado (deixa o app inicial mais leve)
  const XLSX = await import('xlsx')
  const linhas = despesas.map(d => ({
    Data: dataBR(d.data_despesa),
    Categoria: d.categoria,
    Descrição: d.descricao,
    Valor: Number(d.valor),
    'Status do Anexo': d.comprovante_url ? 'Com Anexo' : 'Sem Anexo',
  }))
  const ws1 = XLSX.utils.json_to_sheet(linhas)
  ws1['!cols'] = [{ wch: 12 }, { wch: 18 }, { wch: 45 }, { wch: 14 }, { wch: 16 }]
  // Formata a coluna Valor (D) como moeda
  for (let r = 2; r <= linhas.length + 1; r++) if (ws1[`D${r}`]) ws1[`D${r}`].z = '"R$" #,##0.00'

  const resumo = CATEGORIAS.map(c => ({
    Categoria: c as string,
    'Total (R$)': despesas.filter(d => d.categoria === c).reduce((s, d) => s + Number(d.valor), 0),
  }))
  resumo.push({ Categoria: 'TOTAL GERAL', 'Total (R$)': resumo.reduce((s, r) => s + r['Total (R$)'], 0) })
  const ws2 = XLSX.utils.json_to_sheet(resumo)
  ws2['!cols'] = [{ wch: 22 }, { wch: 16 }]
  for (let r = 2; r <= resumo.length + 1; r++) if (ws2[`B${r}`]) ws2[`B${r}`].z = '"R$" #,##0.00'

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, 'Despesas')
  XLSX.utils.book_append_sheet(wb, ws2, 'Resumo por Categoria')
  XLSX.writeFile(wb, `prestacao-contas-${periodo}.xlsx`)
}
