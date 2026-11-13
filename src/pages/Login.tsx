import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Card, inputCls, btnPrimario } from '../components/ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true); setErro('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
    if (error) setErro('E-mail ou senha incorretos.')
    setEnviando(false)
  }

  return (
    <div className="min-h-screen grid place-items-center p-4">
      <Card className="w-full max-w-sm">
        {/* <form> permite Enter em qualquer campo e o preenchimento automático do navegador */}
        <form onSubmit={entrar} className="space-y-4">
          <h1 className="text-xl font-semibold text-slate-800">Prestação de Contas</h1>
          <input className={inputCls} type="email" autoComplete="username" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} />
          <input className={inputCls} type="password" autoComplete="current-password" placeholder="Senha" value={senha}
            onChange={e => setSenha(e.target.value)} />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <button className={`${btnPrimario} w-full`} disabled={enviando || !email || !senha}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </Card>
    </div>
  )
}
