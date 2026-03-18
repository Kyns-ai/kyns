'use client'

import { useState } from 'react'
import useSWR from 'swr'
import Header from '@/components/layout/Header'
import SectionCard from '@/components/ui/SectionCard'
import Modal from '@/components/ui/Modal'
import Toggle from '@/components/ui/Toggle'
import type { AdminCharacter } from '@/lib/queries/admin-characters'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export default function AgentsPage() {
  const { data: characters, mutate } = useSWR<AdminCharacter[]>('/api/admin/characters', fetcher)
  const [editing, setEditing] = useState<AdminCharacter | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [dragging, setDragging] = useState<string | null>(null)

  const patchCharacter = async (id: string, updates: Record<string, unknown>) => {
    setSaving(true)
    try {
      await fetch(`/api/admin/characters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      mutate()
      setToast('Salvo!')
      setTimeout(() => setToast(''), 2500)
    } finally {
      setSaving(false)
    }
  }

  const duplicate = async (id: string) => {
    await fetch(`/api/admin/characters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'duplicate' }),
    })
    mutate()
    setToast('Character duplicado!')
    setTimeout(() => setToast(''), 2500)
  }

  const handleDrop = async (targetId: string) => {
    if (!dragging || !characters || dragging === targetId) return
    const list = [...characters]
    const fromIdx = list.findIndex((c) => c.id === dragging)
    const toIdx = list.findIndex((c) => c.id === targetId)
    const [moved] = list.splice(fromIdx, 1)
    list.splice(toIdx, 0, moved)
    const orderedIds = list.map((c) => c.id)
    await fetch('/api/admin/characters', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderedIds }),
    })
    mutate()
    setDragging(null)
  }

  return (
    <>
      <Header title="Gestão de Characters" />
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      <div className="p-6 space-y-6">
        <SectionCard
          title={`Characters ${characters ? `(${characters.length})` : ''}`}
          subtitle="Arraste para reordenar • Clique para editar"
        >
          {!characters && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
              ))}
            </div>
          )}
          <div className="space-y-2">
            {characters?.map((c) => (
              <div
                key={c.id}
                draggable
                onDragStart={() => setDragging(c.id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(c.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-grab active:cursor-grabbing ${
                  dragging === c.id
                    ? 'border-accent/50 bg-accent/5'
                    : 'border-white/5 bg-white/3 hover:border-white/10'
                }`}
              >
                <svg className="w-4 h-4 text-gray-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>

                {c.avatar ? (
                  <img src={c.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-accent">{c.name.charAt(0)}</span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{c.name}</span>
                    {c.proOnly && (
                      <span className="text-xs px-1.5 py-0.5 bg-yellow-500/15 text-yellow-400 rounded">Pro</span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>{c.messageCount.toLocaleString()} msgs</span>
                    <span>{c.uniqueUsers} users</span>
                    <span>abandono {c.abandonRate}%</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <Toggle
                    size="sm"
                    checked={c.isActive}
                    onChange={(v) => patchCharacter(c.id, { isActive: v })}
                  />
                  <button
                    onClick={() => setEditing(c)}
                    className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded"
                  >Editar</button>
                  <button
                    onClick={() => duplicate(c.id)}
                    className="text-xs px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-300 rounded"
                  >Duplicar</button>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Editar Character" size="xl">
        {editing && (
          <CharacterEditor
            character={editing}
            onSave={async (updates) => {
              await patchCharacter(editing.id, updates)
              setEditing(null)
            }}
            saving={saving}
          />
        )}
      </Modal>
    </>
  )
}

function CharacterEditor({ character, onSave, saving }: {
  character: AdminCharacter
  onSave: (updates: Record<string, unknown>) => void
  saving: boolean
}) {
  const [name, setName] = useState(character.name)
  const [description, setDescription] = useState(character.description)
  const [instructions, setInstructions] = useState(character.instructions)
  const [isActive, setIsActive] = useState(character.isActive)
  const [proOnly, setProOnly] = useState(character.proOnly)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex items-end gap-4">
          <Toggle checked={isActive} onChange={setIsActive} label="Ativo" />
          <Toggle checked={proOnly} onChange={setProOnly} label="Pro only" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">Descrição</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">
          System Prompt / Instructions
          <span className="ml-2 text-gray-600">{instructions.length} chars</span>
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={12}
          className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          disabled={saving}
          onClick={() => onSave({ name, description, instructions, isActive, proOnly })}
          className="px-4 py-2 bg-accent hover:bg-accent/80 text-white text-sm rounded-lg disabled:opacity-50"
        >
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </div>
  )
}
