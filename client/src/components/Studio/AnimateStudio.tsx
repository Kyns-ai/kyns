import React, { useState, useCallback, useEffect } from 'react';
import { Camera, Play, Sparkles, Wand2 } from 'lucide-react';
import { generateAndPoll } from './lib/studioApi';
import UploadPicker from './components/UploadPicker';
import GenerationResult from './components/GenerationResult';
import GenerationHistory from './components/GenerationHistory';
import type { HistoryEntry } from './components/GenerationHistory';

type AnimationType = 'free' | 'dance' | 'cinematic' | 'speak';

interface SavedInfluencer {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: number;
}

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

const CINEMATIC_EFFECTS = [
  'zoom_in',
  'zoom_out',
  'pan_left',
  'pan_right',
  'rotate',
  'shake',
  'slow_motion',
] as const;

const SPEAK_MODELS = [
  { id: 'wan2.2-speech-to-video', name: 'Wan 2.2 Speech' },
  { id: 'infinitetalk-image-to-video', name: 'InfiniteTalk' },
] as const;

function loadInfluencers(): SavedInfluencer[] {
  try {
    const stored = localStorage.getItem('kyns_influencers');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

const STEPS = [
  { num: 1, label: 'Upload sua foto', icon: <Camera className="h-5 w-5" /> },
  { num: 2, label: 'Escolha a animação', icon: <Play className="h-5 w-5" /> },
  { num: 3, label: 'Gere o vídeo', icon: <Sparkles className="h-5 w-5" /> },
];

export default function AnimateStudio() {
  const [imageUrl, setImageUrl] = useState('');
  const [animType, setAnimType] = useState<AnimationType>('free');
  const [prompt, setPrompt] = useState('');
  const [danceStyle, setDanceStyle] = useState<string>('tiktok_dance');
  const [cinematicEffect, setCinematicEffect] = useState<string>('zoom_in');
  const [duration, setDuration] = useState('5');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [audioUrl, setAudioUrl] = useState('');
  const [speakModel, setSpeakModel] = useState(SPEAK_MODELS[0].id);
  const [resolution, setResolution] = useState('720');

  const [influencers, setInfluencers] = useState<SavedInfluencer[]>([]);
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [output, setOutput] = useState<Record<string, string> | undefined>();
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setInfluencers(loadInfluencers());
  }, []);

  const handleInfluencerSelect = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const inf = loadInfluencers().find((i) => i.id === e.target.value);
    if (inf) {
      setImageUrl(inf.imageUrl);
    }
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!imageUrl) {
      return;
    }
    setStatus('processing');
    setError('');
    setOutput(undefined);

    try {
      let endpoint: string;
      let params: Record<string, string | number | boolean> = {};
      let modelName: string;

      switch (animType) {
        case 'free':
          endpoint = 'wan2.2-image-to-video';
          modelName = 'Wan 2.2 I2V';
          params = { prompt: prompt.trim(), image_url: imageUrl, duration, aspect_ratio: aspectRatio };
          break;
        case 'dance':
          endpoint = 'ai-dance-effects';
          modelName = 'Dance Effects';
          params = { image_url: imageUrl, name: danceStyle };
          break;
        case 'cinematic':
          endpoint = 'ai-video-effects';
          modelName = 'Video Effects';
          params = { prompt: cinematicEffect, image_url: imageUrl };
          break;
        case 'speak':
          endpoint = speakModel;
          modelName = SPEAK_MODELS.find((m) => m.id === speakModel)?.name ?? speakModel;
          params = { image_url: imageUrl, audio_url: audioUrl, resolution };
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
          prompt: prompt.trim() || animType,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('failed');
    }
  }, [imageUrl, animType, prompt, danceStyle, cinematicEffect, duration, aspectRatio, audioUrl, speakModel, resolution]);

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    setOutput(entry.output);
    setStatus('completed');
  }, []);

  const canGenerate = (() => {
    if (!imageUrl || status === 'processing') {
      return false;
    }
    switch (animType) {
      case 'free':
        return !!prompt.trim();
      case 'dance':
        return true;
      case 'cinematic':
        return true;
      case 'speak':
        return !!audioUrl;
      default:
        return false;
    }
  })();

  const currentStep = !imageUrl ? 1 : animType ? 3 : 2;

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Steps Header */}
      <div className="flex items-center justify-center gap-2 sm:gap-4">
        {STEPS.map((step, idx) => (
          <React.Fragment key={step.num}>
            {idx > 0 && (
              <div
                className={`hidden h-px w-8 sm:block ${
                  currentStep >= step.num ? 'bg-purple-500' : 'bg-white/10'
                }`}
              />
            )}
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-2 sm:px-4 sm:py-3 ${
                currentStep >= step.num
                  ? 'border border-purple-500/30 bg-purple-500/10'
                  : 'border border-white/10 bg-white/5'
              }`}
            >
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  currentStep >= step.num
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/10 text-gray-500'
                }`}
              >
                {step.num}
              </div>
              <div className="hidden sm:flex sm:items-center sm:gap-1.5">
                <span className={currentStep >= step.num ? 'text-purple-400' : 'text-gray-600'}>
                  {step.icon}
                </span>
                <span
                  className={`text-sm font-medium ${
                    currentStep >= step.num ? 'text-white' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          </React.Fragment>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Controls Column */}
        <div className="flex w-full flex-col gap-4 lg:w-80 lg:flex-shrink-0">
          {/* Step 1: Image */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <h3 className="mb-3 text-sm font-medium text-white">1. Foto de Referência</h3>
            <UploadPicker accept="image" value={imageUrl} onChange={setImageUrl} />
            {influencers.length > 0 && (
              <div className="mt-3 flex flex-col gap-1">
                <label className="text-xs text-gray-400">Ou usar influenciador salvo:</label>
                <select
                  onChange={handleInfluencerSelect}
                  defaultValue=""
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                >
                  <option value="" disabled className="bg-gray-900">
                    Selecionar...
                  </option>
                  {influencers.map((inf) => (
                    <option key={inf.id} value={inf.id} className="bg-gray-900">
                      {inf.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Preview"
                className="mt-3 h-32 w-full rounded-lg object-cover"
              />
            )}
          </div>

          {/* Step 2: Animation Type */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <h3 className="mb-3 text-sm font-medium text-white">2. Tipo de Animação</h3>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'free' as const, label: 'Animar Livre', desc: 'Prompt + movimento' },
                  { id: 'dance' as const, label: 'Dançar', desc: 'Escolha o estilo' },
                  { id: 'cinematic' as const, label: 'Efeitos', desc: 'Câmera e efeitos' },
                  { id: 'speak' as const, label: 'Falar', desc: 'Lip sync com áudio' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAnimType(opt.id)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    animType === opt.id
                      ? 'border-purple-500 bg-purple-500/20'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <p
                    className={`text-sm font-medium ${
                      animType === opt.id ? 'text-purple-300' : 'text-white'
                    }`}
                  >
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-400">{opt.desc}</p>
                </button>
              ))}
            </div>

            {/* Animation-specific controls */}
            <div className="mt-3 flex flex-col gap-3">
              {animType === 'free' && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-gray-400">Prompt</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Descreva o movimento..."
                      rows={3}
                      className="resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">Duration</label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                      >
                        <option value="3" className="bg-gray-900">3s</option>
                        <option value="5" className="bg-gray-900">5s</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">Aspect Ratio</label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                      >
                        {['16:9', '9:16', '1:1'].map((r) => (
                          <option key={r} value={r} className="bg-gray-900">{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {animType === 'dance' && (
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

              {animType === 'cinematic' && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-400">Effect</label>
                  <select
                    value={cinematicEffect}
                    onChange={(e) => setCinematicEffect(e.target.value)}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                  >
                    {CINEMATIC_EFFECTS.map((eff) => (
                      <option key={eff} value={eff} className="bg-gray-900">
                        {eff.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {animType === 'speak' && (
                <>
                  <UploadPicker accept="audio" value={audioUrl} onChange={setAudioUrl} label="Áudio" />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">Modelo</label>
                      <select
                        value={speakModel}
                        onChange={(e) => setSpeakModel(e.target.value)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                      >
                        {SPEAK_MODELS.map((m) => (
                          <option key={m.id} value={m.id} className="bg-gray-900">
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-gray-400">Resolution</label>
                      <select
                        value={resolution}
                        onChange={(e) => setResolution(e.target.value)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                      >
                        <option value="512" className="bg-gray-900">480p</option>
                        <option value="720" className="bg-gray-900">720p</option>
                        <option value="1024" className="bg-gray-900">1024p</option>
                      </select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Step 3: Generate */}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4 text-base font-bold text-white shadow-lg shadow-purple-500/25 transition-all hover:shadow-purple-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            <Wand2 className="h-5 w-5" />
            {status === 'processing' ? 'Gerando vídeo...' : '3. Gerar Vídeo'}
          </button>
        </div>

        {/* Result Column */}
        <div className="flex flex-1 flex-col gap-4">
          <GenerationResult status={status} output={output} error={error} />
          <GenerationHistory entries={history} onSelect={handleHistorySelect} />
        </div>
      </div>
    </div>
  );
}
