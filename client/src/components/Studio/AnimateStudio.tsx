import React, { useCallback, useEffect, useState } from 'react';
import { Check, Clock, Monitor, Sparkles } from 'lucide-react';
import { useLocalize } from '~/hooks';
import GenerationHistory from './components/GenerationHistory';
import GenerationResult from './components/GenerationResult';
import UploadPicker from './components/UploadPicker';
import type { HistoryEntry } from './components/GenerationHistory';
import { generateAndPoll } from './lib/studioApi';

const WAN_ANIMATE_ENDPOINT = 'wan2.2-animate';

type AnimateMode = 'animate' | 'replace';

interface SavedInfluencer {
  id: string;
  name: string;
  imageUrl: string;
  createdAt: number;
}

function loadInfluencers(): SavedInfluencer[] {
  try {
    const stored = localStorage.getItem('kyns_influencers');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function AnimateStudio() {
  const localize = useLocalize();
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [mode, setMode] = useState<AnimateMode>('animate');
  const [resolution, setResolution] = useState<'480p' | '720p'>('480p');
  const [influencers, setInfluencers] = useState<SavedInfluencer[]>([]);
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [output, setOutput] = useState<string | null>(null);
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
    if (!imageUrl || !videoUrl) {
      return;
    }
    setStatus('processing');
    setError('');
    setOutput(null);

    const modelLabel =
      mode === 'replace'
        ? localize('com_studio_animate_model_replace_name')
        : localize('com_studio_animate_model_animate_name');

    try {
      const params: Record<string, string | number | boolean> = {
        image_url: imageUrl,
        video_url: videoUrl,
        mode,
        resolution,
      };

      const result = await generateAndPoll(WAN_ANIMATE_ENDPOINT, params, setStatus as (s: string) => void);
      setOutput(result);
      setStatus('completed');
      setHistory((prev) => [
        {
          id: Date.now().toString(),
          output: result,
          model: modelLabel,
          prompt: mode,
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('failed');
    }
  }, [imageUrl, videoUrl, mode, resolution, localize]);

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    setOutput(entry.output);
    setStatus('completed');
  }, []);

  const canGenerate = Boolean(imageUrl && videoUrl) && status !== 'processing';

  const lime = {
    border: 'border-lime-400/35',
    ring: 'ring-lime-400/50',
    text: 'text-lime-400',
    bgSel: 'bg-lime-400/15',
    iconSel: 'text-lime-400',
    btn: 'bg-lime-400 text-black hover:bg-lime-300',
  };

  const modelOptions: { id: AnimateMode; nameKey: string; descKey: string }[] = [
    {
      id: 'replace',
      nameKey: 'com_studio_animate_model_replace_name',
      descKey: 'com_studio_animate_model_replace_desc',
    },
    {
      id: 'animate',
      nameKey: 'com_studio_animate_model_animate_name',
      descKey: 'com_studio_animate_model_animate_desc',
    },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 text-white">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="flex w-full flex-shrink-0 flex-col gap-4 lg:w-80">
          <div
            className={`rounded-xl border border-dashed ${lime.border} bg-[#141414] p-4`}
            role="region"
            aria-label={localize('com_studio_animate_upload_image_title')}
          >
            <p className="text-sm font-medium text-white">{localize('com_studio_animate_upload_image_title')}</p>
            <p className="mb-3 text-xs text-gray-500">{localize('com_studio_animate_upload_image_hint')}</p>
            <UploadPicker accept="image" value={imageUrl} onChange={setImageUrl} />
            {influencers.length > 0 && (
              <div className="mt-3 flex flex-col gap-1">
                <label htmlFor="kyns-animate-influencer" className="text-xs text-gray-500">
                  {localize('com_studio_animate_saved_character')}
                </label>
                <select
                  id="kyns-animate-influencer"
                  onChange={handleInfluencerSelect}
                  defaultValue=""
                  className={`rounded-lg border ${lime.border} bg-white/5 px-3 py-2 text-sm text-white outline-none focus:ring-2 ${lime.ring}`}
                >
                  <option value="" disabled className="bg-gray-900">
                    —
                  </option>
                  {influencers.map((inf) => (
                    <option key={inf.id} value={inf.id} className="bg-gray-900">
                      {inf.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {imageUrl ? (
              <img src={imageUrl} alt="" className="mt-3 h-24 w-full rounded-lg object-cover" />
            ) : null}
          </div>

          <div
            className={`rounded-xl border border-dashed ${lime.border} bg-[#141414] p-4`}
            role="region"
            aria-label={localize('com_studio_animate_upload_video_title')}
          >
            <p className="text-sm font-medium text-white">{localize('com_studio_animate_upload_video_title')}</p>
            <p className="mb-3 text-xs text-gray-500">{localize('com_studio_animate_upload_video_hint')}</p>
            <UploadPicker accept="video" value={videoUrl} onChange={setVideoUrl} />
            {videoUrl ? (
              <video src={videoUrl} muted className="mt-3 h-24 w-full rounded-lg object-cover" playsInline />
            ) : null}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
              {localize('com_studio_animate_model_label')}
            </p>
            <div className="flex flex-col gap-2">
              {modelOptions.map((opt) => {
                const selected = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    className={`relative flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                      selected
                        ? `border-lime-400/60 ${lime.bgSel} ring-1 ring-lime-400/30`
                        : 'border-white/10 bg-[#1a1a1a] hover:border-white/20'
                    }`}
                  >
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                        selected ? 'bg-lime-400/20' : 'bg-white/5'
                      }`}
                      aria-hidden
                    >
                      <Sparkles className={`h-5 w-5 ${selected ? lime.iconSel : 'text-gray-500'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">{localize(opt.nameKey)}</p>
                      <p className="text-xs text-gray-500">{localize(opt.descKey)}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
                          <Monitor className="h-3 w-3" />
                          {localize('com_studio_animate_spec_resolution')}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-400">
                          <Clock className="h-3 w-3" />
                          {localize('com_studio_animate_spec_duration')}
                        </span>
                      </div>
                    </div>
                    {selected ? (
                      <Check className={`h-5 w-5 flex-shrink-0 ${lime.iconSel}`} aria-hidden />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="kyns-animate-resolution" className="text-xs font-medium text-gray-500">
              {localize('com_studio_animate_resolution')}
            </label>
            <select
              id="kyns-animate-resolution"
              value={resolution}
              onChange={(e) => setResolution(e.target.value as '480p' | '720p')}
              className={`rounded-xl border ${lime.border} bg-[#141414] px-3 py-3 text-sm text-white outline-none focus:ring-2 ${lime.ring}`}
            >
              <option value="480p" className="bg-gray-900">
                {localize('com_studio_animate_resolution_480')}
              </option>
              <option value="720p" className="bg-gray-900">
                {localize('com_studio_animate_resolution_720')}
              </option>
            </select>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`rounded-xl px-6 py-4 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${lime.btn}`}
          >
            {status === 'processing'
              ? localize('com_studio_animate_generating')
              : localize('com_studio_animate_generate')}
          </button>

          <a
            href="https://muapi.ai/playground/wan2.2-animate"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-xs text-gray-500 underline decoration-gray-600 underline-offset-2 hover:text-lime-400/90"
          >
            {localize('com_studio_animate_explore')}
          </a>
        </aside>

        <main className="flex min-h-[420px] flex-1 flex-col gap-4 rounded-2xl border border-white/10 bg-[#0d0d0d] p-6 lg:p-10">
          {output || status === 'processing' || status === 'failed' ? (
            <GenerationResult status={status} output={output} error={error} />
          ) : (
            <div className="mx-auto flex max-w-xl flex-col items-center text-center">
              <span
                className={`mb-4 inline-flex items-center gap-1.5 rounded-full border ${lime.border} px-3 py-1 text-xs font-medium ${lime.text}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {localize('com_studio_animate_badge')}
              </span>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                <span className="text-white">{localize('com_studio_animate_headline_1')}</span>
                <br />
                <span className={lime.text}>{localize('com_studio_animate_headline_2')}</span>
              </h2>
              <p className="mt-3 text-sm text-gray-500">{localize('com_studio_animate_subhead')}</p>
              <div className="mt-10 w-full text-left">
                <h3 className="mb-4 text-center text-xs font-bold tracking-widest text-white">
                  {localize('com_studio_animate_steps_title')}{' '}
                  <span className={lime.text}>{localize('com_studio_animate_steps_highlight')}</span>
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      n: 1,
                      title: localize('com_studio_animate_step1_title'),
                      desc: localize('com_studio_animate_step1_desc'),
                    },
                    {
                      n: 2,
                      title: localize('com_studio_animate_step2_title'),
                      desc: localize('com_studio_animate_step2_desc'),
                    },
                    {
                      n: 3,
                      title: localize('com_studio_animate_step3_title'),
                      desc: localize('com_studio_animate_step3_desc'),
                    },
                  ].map((step) => (
                    <div
                      key={step.n}
                      className="relative rounded-xl border border-white/10 bg-[#141414] p-4 pt-8"
                    >
                      <span className="absolute left-3 top-3 flex h-6 w-6 items-center justify-center bg-lime-400 text-xs font-bold text-black">
                        {step.n}
                      </span>
                      <p className="text-[11px] font-bold leading-snug text-white">{step.title}</p>
                      <p className="mt-2 text-[11px] leading-snug text-gray-500">{step.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <GenerationHistory entries={history} onSelect={handleHistorySelect} />
        </main>
      </div>
    </div>
  );
}
