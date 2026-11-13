import type { ReactNode } from 'react'

// Cartão padrão do layout
export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-6 ${className}`}>{children}</div>
)

export const inputCls =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500'
export const btnPrimario =
  'rounded-xl bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50'
