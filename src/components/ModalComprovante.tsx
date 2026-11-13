import { useEffect, useState } from 'react'
import { ExternalLink, X } from 'lucide-react'
import { urlComprovante } from '../lib/despesas'

/**
 * Exibe o comprovante (imagem ou PDF) dentro do app usando uma URL assinada de 60s.
 * Um modal evita o bloqueio de pop-ups que o navegador aplica a window.open.
 */
export default function ModalComprovante({ path, aoFechar }: { path: string; aoFechar: () => void }) {
  const [url, setUrl] = useState('')
  const [erro, setErro] = useState('')
  const ehPdf = path.toLowerCase().endsWith('.pdf')

  useEffect(() => {
    let ativo = true
    urlComprovante(path)
      .then(u => { if (ativo) setUrl(u) })
      .catch(e => { console.error(e); if (ativo) setErro('Não foi possível carregar o comprovante.') })
    return () => { ativo = false }
  }, [path])

  // Fecha com a tecla Esc
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aoFechar])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3" onClick={aoFechar}>
      <div className="flex max-h-full w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 className="font-medium text-slate-800">Comprovante</h3>
          <div className="flex items-center gap-1">
            {/* Link clicado pelo usuário não é bloqueado como pop-up */}
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir em nova aba"
                className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50"><ExternalLink size={18} /></a>
            )}
            <button onClick={aoFechar} title="Fechar" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
          </div>
        </div>
        <div className="min-h-[200px] overflow-auto p-3">
          {erro && <p className="p-6 text-center text-red-600">{erro}</p>}
          {!erro && !url && <p className="p-6 text-center text-slate-400">Carregando…</p>}
          {url && (ehPdf
            ? <iframe src={url} title="Comprovante PDF" className="h-[75vh] w-full rounded-lg" />
            : <img src={url} alt="Comprovante" className="mx-auto max-h-[75vh] rounded-lg object-contain" />)}
        </div>
      </div>
    </div>
  )
}
