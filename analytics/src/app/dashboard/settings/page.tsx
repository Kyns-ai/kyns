'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

interface SetupData {
  configured: boolean
  qrDataUrl?: string
  secret?: string
  backupCodes?: string[]
  backupCodesRemaining?: number
}

export default function SettingsPage() {
  const { data, mutate } = useSWR<SetupData>('/api/auth/totp/setup', fetcher)
  const [step, setStep] = useState<'idle' | 'setup' | 'confirm' | 'disable'>('idle')
  const [confirmCode, setConfirmCode] = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showBackupCodes, setShowBackupCodes] = useState(false)

  async function startSetup() {
    setStep('setup')
    setError('')
    setSuccess('')
    await mutate()
  }

  async function handleConfirm() {
    if (!confirmCode || !/^\d{6}$/.test(confirmCode)) {
      setError('Digite o codigo de 6 digitos do seu autenticador')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/totp/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: confirmCode }),
      })
      if (res.ok) {
        setSuccess('2FA ativado com sucesso!')
        setStep('idle')
        setConfirmCode('')
        await mutate()
      } else {
        const d = await res.json()
        setError(d.error || 'Codigo invalido')
      }
    } catch {
      setError('Erro de conexao')
    } finally {
      setLoading(false)
    }
  }

  async function handleDisable() {
    if (!disableCode) {
      setError('Digite um codigo TOTP ou backup para desativar')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: disableCode }),
      })
      if (res.ok) {
        setSuccess('2FA desativado.')
        setStep('idle')
        setDisableCode('')
        await mutate()
      } else {
        const d = await res.json()
        setError(d.error || 'Codigo invalido')
      }
    } catch {
      setError('Erro de conexao')
    } finally {
      setLoading(false)
    }
  }

  const isConfigured = data?.configured === true

  return (
    <>
      <Header title="Configuracoes" />

      <div className="p-6 space-y-6">
        {success && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
            {success}
          </div>
        )}

        <SectionCard
          title="Autenticacao em duas etapas (2FA)"
          subtitle="Proteja sua conta com Google Authenticator"
        >
          <div className="space-y-4">
            {/* Status */}
            <div className="flex items-center justify-between p-4 bg-white/3 rounded-lg border border-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${isConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                <div>
                  <p className="text-sm text-white font-medium">
                    {isConfigured ? '2FA ativado' : '2FA desativado'}
                  </p>
                  {isConfigured && data?.backupCodesRemaining !== undefined && (
                    <p className="text-xs text-gray-500">
                      {data.backupCodesRemaining} codigos de backup restantes
                    </p>
                  )}
                </div>
              </div>
              {!isConfigured && step === 'idle' && (
                <button
                  onClick={startSetup}
                  className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg transition-colors"
                >
                  Ativar 2FA
                </button>
              )}
              {isConfigured && step === 'idle' && (
                <button
                  onClick={() => { setStep('disable'); setError(''); setSuccess('') }}
                  className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm rounded-lg transition-colors"
                >
                  Desativar 2FA
                </button>
              )}
            </div>

            {/* Setup flow */}
            {step === 'setup' && data && !data.configured && (
              <div className="space-y-6">
                <div className="p-4 bg-accent/5 border border-accent/20 rounded-xl">
                  <p className="text-sm text-accent font-medium mb-2">Passo 1: Escaneie o QR Code</p>
                  <p className="text-xs text-gray-400 mb-4">
                    Abra o Google Authenticator e escaneie o codigo abaixo.
                  </p>
                  {data.qrDataUrl && (
                    <div className="flex justify-center">
                      <img src={data.qrDataUrl} alt="TOTP QR Code" className="w-48 h-48 rounded-lg" />
                    </div>
                  )}
                  <div className="mt-4">
                    <p className="text-xs text-gray-500 mb-1">Ou insira manualmente:</p>
                    <code className="block bg-surface-900 px-3 py-2 rounded text-xs text-accent font-mono break-all select-all">
                      {data.secret}
                    </code>
                  </div>
                </div>

                <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-yellow-400 font-medium">Passo 2: Salve os codigos de backup</p>
                    <button
                      onClick={() => setShowBackupCodes(!showBackupCodes)}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      {showBackupCodes ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Guarde estes codigos em lugar seguro. Cada um pode ser usado uma unica vez se perder acesso ao app.
                  </p>
                  {showBackupCodes && data.backupCodes && (
                    <div className="grid grid-cols-2 gap-2">
                      {data.backupCodes.map((code, i) => (
                        <code key={i} className="bg-surface-900 px-3 py-2 rounded text-xs text-white font-mono text-center select-all">
                          {code}
                        </code>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 bg-white/3 border border-white/5 rounded-xl">
                  <p className="text-sm text-white font-medium mb-2">Passo 3: Confirme</p>
                  <p className="text-xs text-gray-400 mb-3">
                    Digite o codigo de 6 digitos que aparece no seu autenticador.
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                      className="flex-1 bg-surface-900 border border-white/10 rounded-lg px-4 py-2.5 text-white text-center font-mono text-lg tracking-widest placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <button
                      onClick={handleConfirm}
                      disabled={loading}
                      className="px-6 py-2.5 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Verificando...' : 'Confirmar'}
                    </button>
                  </div>
                  {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                </div>

                <button
                  onClick={() => { setStep('idle'); setError('') }}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Cancelar
                </button>
              </div>
            )}

            {/* Disable flow */}
            {step === 'disable' && (
              <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl space-y-3">
                <p className="text-sm text-red-400 font-medium">Desativar 2FA</p>
                <p className="text-xs text-gray-400">
                  Digite o codigo atual do autenticador ou um codigo de backup para confirmar.
                </p>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    placeholder="Codigo TOTP ou backup"
                    maxLength={8}
                    className="flex-1 bg-surface-900 border border-white/10 rounded-lg px-4 py-2.5 text-white text-center font-mono tracking-widest placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-red-500/50"
                  />
                  <button
                    onClick={handleDisable}
                    disabled={loading}
                    className="px-6 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg disabled:opacity-50 transition-colors"
                  >
                    {loading ? 'Desativando...' : 'Desativar'}
                  </button>
                </div>
                {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
                <button
                  onClick={() => { setStep('idle'); setError('') }}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </SectionCard>

        {/* IP Restriction info */}
        <SectionCard title="Restricao de IP" subtitle="Controle de acesso por endereco IP">
          <div className="p-4 bg-white/3 rounded-lg border border-white/5">
            <p className="text-sm text-white font-medium mb-1">ALLOWED_IPS</p>
            <p className="text-xs text-gray-400 mb-3">
              Configure a variavel de ambiente <code className="bg-white/5 px-1 rounded">ALLOWED_IPS</code> no Railway
              com os IPs permitidos (separados por virgula). Quando configurado, qualquer acesso de outro IP recebe 403.
            </p>
            <p className="text-xs text-gray-500">
              Status: {process.env.ALLOWED_IPS ? 'Ativo' : 'Nao configurado (todos os IPs permitidos)'}
            </p>
          </div>
        </SectionCard>

        {/* Session info */}
        <SectionCard title="Sessao" subtitle="Configuracoes de seguranca da sessao">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white/3 rounded-lg">
              <p className="text-xs text-gray-500">Duracao da sessao</p>
              <p className="text-lg font-semibold text-white mt-1">4 horas</p>
            </div>
            <div className="p-3 bg-white/3 rounded-lg">
              <p className="text-xs text-gray-500">IP binding</p>
              <p className="text-lg font-semibold text-white mt-1">Ativo</p>
              <p className="text-xs text-gray-500 mt-0.5">Sessao vinculada ao IP do login</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </>
  )
}
