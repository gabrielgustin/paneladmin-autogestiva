'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

const inputClass =
  'h-11 w-full rounded-lg border border-brand-foreground/15 bg-brand-foreground/10 px-3 text-sm text-brand-foreground outline-none placeholder:text-brand-foreground/40 focus:border-orange'

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'No se pudo iniciar sesión')
      router.push('/clientes')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-brand-foreground/15 bg-brand p-6 shadow-2xl">
      <div className="mb-6 flex size-10 items-center justify-center rounded-lg bg-orange text-orange-foreground">
        <Lock className="size-5" aria-hidden="true" />
      </div>
      <h1 className="text-2xl font-black tracking-tight">Acceso administrador</h1>
      <p className="mt-2 text-sm text-brand-foreground/65">Ingresá para ver y editar tu cartera de clientes.</p>
      <div className="mt-6 grid gap-4">
        <label className="text-xs font-semibold text-brand-foreground/65">
          Email
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={`${inputClass} mt-2`} />
        </label>
        <label className="text-xs font-semibold text-brand-foreground/65">
          Contraseña
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} mt-2`} />
        </label>
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
      <button disabled={loading} className="mt-6 h-11 w-full rounded-full bg-orange text-sm font-bold text-orange-foreground disabled:opacity-60">
        {loading ? 'Ingresando…' : 'Ingresar'}
      </button>
    </form>
  )
}
