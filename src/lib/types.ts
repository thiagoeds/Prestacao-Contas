export const CATEGORIAS = ['Combustível', 'Alimentação', 'Pequenos Vultos', 'Itens Comprados'] as const
export type Categoria = (typeof CATEGORIAS)[number]

export interface Despesa {
  id: string
  created_at: string
  data_despesa: string // YYYY-MM-DD
  valor: number
  categoria: Categoria
  descricao: string
  comprovante_url: string | null // path no bucket 'comprovantes'
}

// Cores dos badges e gráficos por categoria
export const COR_CATEGORIA: Record<Categoria, { badge: string; hex: string }> = {
  'Combustível': { badge: 'bg-amber-100 text-amber-700', hex: '#f59e0b' },
  'Alimentação': { badge: 'bg-emerald-100 text-emerald-700', hex: '#10b981' },
  'Pequenos Vultos': { badge: 'bg-sky-100 text-sky-700', hex: '#0ea5e9' },
  'Itens Comprados': { badge: 'bg-violet-100 text-violet-700', hex: '#8b5cf6' },
}
