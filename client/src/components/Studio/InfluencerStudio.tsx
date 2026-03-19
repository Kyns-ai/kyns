import React, { useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Wand2, Film, Music2, Sparkles, User, ArrowLeft } from 'lucide-react';
import { generateAndPoll } from './lib/studioApi';
import UploadPicker from './components/UploadPicker';
import GenerationResult from './components/GenerationResult';
import GenerationHistory from './components/GenerationHistory';
import type { HistoryEntry } from './components/GenerationHistory';

interface Influencer {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: number;
}

type ActionType = 'photo' | 'animate' | 'dance' | 'speak';

const STORAGE_KEY = 'kyns_influencers';

const DANCE_STYLES = [
  'tiktok_dance',
  'hip_hop',
  'salsa',
  'ballet',
  'breakdance',
  'robot',
  'shuffle',
  'wave',
  'pop',
  'lock',
] as const;

function loadInfluencers(): Influencer[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveInfluencers(list: Influencer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export default function InfluencerStudio() {
  const [influencers, setInfluencers] = useState<Influencer[]>(loadInfluencers);
  const [selected, setSelected] = useState<Influencer | null>(null);
  const [action, setAction] = useState<ActionType | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');

  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [duration, setDuration] = useState('5');
  const [danceStyle, setDanceStyle] = useState<string>('tiktok_dance');
  const [audioUrl, setAudioUrl] = useState('');
  const [resolution, setResolution] = useState('720');

  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [output, setOutput] = useState<Record<string, string> | undefined>();
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setInfluencers(loadInfluencers());
  }, []);

  const handleCreate = useCallback(() => {
    if (!newName.trim() || !newImageUrl) {
      return;
    }
    const entry: Influencer = {
      id: Date.now().toString(),
      name: newName.trim(),
      imageUrl: newImageUrl,
      createdAt: Date.now(),
    };
    const updated = [...influencers, entry];
    setInfluencers(updated);
    saveInfluencers(updated);
    setCreating(false);
    setNewName('');
    setNewImageUrl('');
    setSelected(entry);
  }, [newName, newImageUrl, influencers]);

  const handleDelete = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const updated = influencers.filter((inf) => inf.id !== id);
      setInfluencers(updated);
      saveInfluencers(updated);
      if (selected?.id === id) {
        setSelected(null);
        setAction(null);
      }
    },
    [influencers, selected],
  );

  const handleGenerate = useCallback(async () => {
    if (!selected) {
      return;
    }
    setStatus('processing');
    setError('');
    setOutput(undefined);

    try {
      let endpoint: string;
      let params: Record<string, string | number | boolean> = {};
      let modelName: string;

      switch (action) {
        case 'photo':
          endpoint = 'flux-pulid';
          modelName = 'Flux PuLID';
          params = { prompt: prompt.trim(), image_url: selected.imageUrl, aspect_ratio: aspectRatio };
          break;
        case 'animate':
          endpoint = 'wan2.2-image-to-video';
          modelName = 'Wan 2.2 I2V';
          params = {
            prompt: prompt.trim(),
            image_url: selected.imageUrl,
            duration,
            aspect_ratio: aspectRatio,
          };
          break;
        case 'dance':
          endpoint = 'ai-dance-effects';
          modelName = 'Dance Effects';
          params = { image_url: selected.imageUrl, name: danceStyle };
          break;
        case 'speak':
          endpoint = 'infinitetalk-image-to-video';
          modelName = 'InfiniteTalk';
          params = { image_url: selected.imageUrl, audio_url: audioUrl, resolution };
          break;
        default:
          return;
      }

      const result = await generateAndPoll(endpoint, params, setStatus as (s: string) => void);
      setOutput(result);
      setStatus('completed');
      setHistory((prev) => [
        {
          id: Date.now().toString(),
          output: result,
          model: modelName,
          prompt: prompt.trim() || action || '',
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('failed');
    }
  }, [selected, action, prompt, aspectRatio, duration, danceStyle, audioUrl, resolution]);

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    setOutput(entry.output);
    setStatus('completed');
  }, []);

  const canGenerate = (() => {
    if (!selected || !action || status === 'processing') {
      return false;
    }
    switch (action) {
      case 'photo':
        return !!prompt.trim();
      case 'animate':
        return !!prompt.trim();
      case 'dance':
        return true;
      case 'speak':
        return !!audioUrl;
      default:
        return false;
    }
  })();

  const ACTIONS: { id: ActionType; label: string; desc: string; icon: React.ReactNode }[] = [
    { id: 'photo', label: 'Gerar Foto', desc: 'Nova foto mantendo o rosto', icon: <Sparkles className="h-5 w-5" /> },
    { id: 'animate', label: 'Animar', desc: 'Transformar em vídeo', icon: <Film className="h-5 w-5" /> },
    { id: 'dance', label: 'Dançar', desc: 'Animar dançando', icon: <Wand2 className="h-5 w-5" /> },
    { id: 'speak', label: 'Falar', desc: 'Lip sync com áudio', icon: <Music2 className="h-5 w-5" /> },
  ];

  return (
    <div className="flex h-full flex-col lg:flex-row">
      {/* Left Sidebar — Influencer List */}
      <div className="flex w-full flex-col border-b border-white/10 lg:w-72 lg:flex-shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="text-sm font-medium text-gray-300">Meus Influenciadores</h2>
          <button
            type="button"
            onClick={() => setCreating(!creating)}
            className="rounded-lg bg-purple-600 p-1.5 text-white transition-colors hover:bg-purple-500"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Create Form */}
        {creating && (
          <div className="flex flex-col gap-3 border-b border-white/10 p-4">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do influenciador"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500"
            />
            <UploadPicker accept="image" value={newImageUrl} onChange={setNewImageUrl} label="Foto" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={!newName.trim() || !newImageUrl}
                className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:opacity-50"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewName('');
                  setNewImageUrl('');
                }}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-400 transition-colors hover:text-white"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Influencer List */}
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {influencers.length === 0 && !creating && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <User className="h-10 w-10 text-gray-600" />
              <p className="text-sm text-gray-500">Nenhum influenciador criado</p>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="text-sm text-purple-400 transition-colors hover:text-purple-300"
              >
                Criar o primeiro
              </button>
            </div>
          )}
          {influencers.map((inf) => (
            <button
              key={inf.id}
              type="button"
              onClick={() => {
                setSelected(inf);
                setAction(null);
                setStatus('idle');
                setOutput(undefined);
              }}
              className={`group flex items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-white/10 ${
                selected?.id === inf.id ? 'border-2 border-purple-500 bg-purple-500/10' : 'border-2 border-transparent'
              }`}
            >
              <img
                src={inf.imageUrl}
                alt={inf.name}
                className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{inf.name}</p>
                <p className="text-xs text-gray-500">
                  {new Date(inf.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => handleDelete(inf.id, e)}
                className="rounded p-1 text-gray-600 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Right Panel — Actions & Content */}
      <div className="flex flex-1 flex-col overflow-y-auto p-4">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <User className="h-12 w-12 text-gray-600" />
            <p className="text-gray-400">Selecione um influenciador para começar</p>
          </div>
        ) : !action ? (
          /* Action Selection */
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <img
                src={selected.imageUrl}
                alt={selected.name}
                className="h-16 w-16 rounded-xl object-cover"
              />
              <div>
                <h3 className="text-lg font-medium text-white">{selected.name}</h3>
                <p className="text-sm text-gray-400">Escolha uma ação</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {ACTIONS.map((act) => (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => setAction(act.id)}
                  className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-all hover:border-purple-500/50 hover:bg-white/10"
                >
                  <div className="rounded-lg bg-purple-500/20 p-3 text-purple-400">{act.icon}</div>
                  <span className="text-sm font-medium text-white">{act.label}</span>
                  <span className="text-xs text-gray-400">{act.desc}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Action Form */
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => {
                setAction(null);
                setStatus('idle');
                setOutput(undefined);
              }}
              className="flex items-center gap-2 self-start text-sm text-gray-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar às ações
            </button>

            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
              <img src={selected.imageUrl} alt={selected.name} className="h-10 w-10 rounded-lg object-cover" />
              <div>
                <p className="text-sm font-medium text-white">{selected.name}</p>
                <p className="text-xs text-purple-400">
                  {ACTIONS.find((a) => a.id === action)?.label}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 lg:flex-row">
              {/* Controls */}
              <div className="flex w-full flex-col gap-3 lg:w-72 lg:flex-shrink-0">
                {(action === 'photo' || action === 'animate') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-400">Prompt</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder={
                        action === 'photo'
                          ? 'Descreva a cena (ex: na praia ao pôr do sol)'
                          : 'Descreva o movimento (ex: acenando para a câmera)'
                      }
                      rows={3}
                      className="resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500"
                    />
                  </div>
                )}

                {(action === 'photo' || action === 'animate') && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-400">Aspect Ratio</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                    >
                      {['1:1', '16:9', '9:16', '4:3', '3:4'].map((r) => (
                        <option key={r} value={r} className="bg-gray-900">{r}</option>
                      ))}
                    </select>
                  </div>
                )}

                {action === 'animate' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-400">Duration</label>
                    <select
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                    >
                      <option value="3" className="bg-gray-900">3s</option>
                      <option value="5" className="bg-gray-900">5s</option>
                    </select>
                  </div>
                )}

                {action === 'dance' && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-400">Dance Style</label>
                    <select
                      value={danceStyle}
                      onChange={(e) => setDanceStyle(e.target.value)}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                    >
                      {DANCE_STYLES.map((s) => (
                        <option key={s} value={s} className="bg-gray-900">
                          {s.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {action === 'speak' && (
                  <>
                    <UploadPicker accept="audio" value={audioUrl} onChange={setAudioUrl} label="Áudio" />
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-gray-400">Resolution</label>
                      <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                      >
                        <option value="512" className="bg-gray-900">480p</option>
                        <option value="720" className="bg-gray-900">720p</option>
                      </select>
                    </div>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!canGenerate}
                  className="flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Wand2 className="h-4 w-4" />
                  {status === 'processing' ? 'Gerando...' : 'Gerar'}
                </button>
              </div>

              {/* Result */}
              <div className="flex flex-1 flex-col gap-4">
                <GenerationResult status={status} output={output} error={error} />
                <GenerationHistory entries={history} onSelect={handleHistorySelect} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
