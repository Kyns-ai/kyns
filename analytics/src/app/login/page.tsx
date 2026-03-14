'use client'

import { useState, FormEvent, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'password' | 'totp'

export default function LoginPage() {
  const [step, setStep] = useState<Step>('password')
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [challengeToken, setChallengeToken] = useState('')
  const [useBackup, setUseBackup] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const totpInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'totp' && totpInputRef.current) {
      totpInputRef.current.focus()
    }
  }, [step, useBackup])

  async function handlePassword(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()

      if (res.status === 429) {
        setError(data.error)
        return
      }

      if (!res.ok && !data.totpRequired) {
        setError('Senha incorreta')
        return
      }

      if (data.totpRequired) {
        setChallengeToken(data.challengeToken)
        setStep('totp')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Erro de conexao')
    } finally {
      setLoading(false)
    }
  }

  async function handleTotp(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/verify-totp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode, challengeToken }),
      })

      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        const data = await res.json()
        if (res.status === 401 && data.error?.includes('Challenge')) {
          setError('Sessao expirada. Faca login novamente.')
          setStep('password')
          setPassword('')
          setTotpCode('')
          setChallengeToken('')
        } else {
          setError(useBackup ? 'Codigo de backup invalido' : 'Codigo incorreto')
        }
      }
    } catch {
      setError('Erro de conexao')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 mb-4">
            <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">KYNS Analytics</h1>
          <p className="text-gray-400 text-sm mt-1">Admin Dashboard</p>
        </div>

        {step === 'password' && (
          <form onSubmit={handlePassword} className="bg-surface-800 rounded-2xl p-6 border border-white/5 shadow-2xl">
            <label className="block text-sm font-medium text-gray-300 mb-2">Senha de acesso</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoFocus
              required
              className="w-full bg-surface-700 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
            />

            {error && (
              <p className="mt-3 text-sm text-red-400 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Verificando...' : 'Continuar'}
            </button>
          </form>
        )}

        {step === 'totp' && (
          <form onSubmit={handleTotp} className="bg-surface-800 rounded-2xl p-6 border border-white/5 shadow-2xl">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span className="text-sm font-medium text-gray-300">Verificacao em duas etapas</span>
            </div>

            <label className="block text-sm font-medium text-gray-300 mb-2">
              {useBackup ? 'Codigo de backup (8 caracteres)' : 'Codigo do autenticador (6 digitos)'}
            </label>
            <input
              ref={totpInputRef}
              type="text"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder={useBackup ? 'ABCD1234' : '000000'}
              maxLength={useBackup ? 8 : 6}
              autoComplete="one-time-code"
              required
              className="w-full bg-surface-700 border border-white/10 rounded-xl px-4 py-3 text-white text-center text-lg font-mono tracking-widest placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all"
            />

            {error && (
              <p className="mt-3 text-sm text-red-400 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Verificando...' : 'Verificar'}
            </button>

            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => { setUseBackup(!useBackup); setTotpCode(''); setError('') }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {useBackup ? 'Usar codigo do app' : 'Usar codigo de backup'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('password'); setPassword(''); setTotpCode(''); setError('') }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                Voltar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
