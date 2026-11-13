export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// '2025-03-09' -> '09/03/2025' (sem converter fuso)
export const dataBR = (iso: string) => iso.split('-').reverse().join('/')

export const hoje = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
export const mesAtual = () => hoje().slice(0, 7) // YYYY-MM

// Primeiro e último dia de um mês 'YYYY-MM'
export const limitesDoMes = (ym: string) => {
  const [a, m] = ym.split('-').map(Number)
  const fim = new Date(a, m, 0).getDate()
  return { ini: `${ym}-01`, fim: `${ym}-${String(fim).padStart(2, '0')}` }
}
