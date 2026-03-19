import React, { useState, useCallback } from 'react';
import { Wand2 } from 'lucide-react';
import { lipsyncModels } from './lib/models';
import { generateAndPoll } from './lib/studioApi';
import ModelPicker from './components/ModelPicker';
import ParamControls from './components/ParamControls';
import UploadPicker from './components/UploadPicker';
import GenerationResult from './components/GenerationResult';
import GenerationHistory from './components/GenerationHistory';
import type { HistoryEntry } from './components/GenerationHistory';
import type { StudioModel } from './lib/models';

export default function LipSyncStudio() {
  const [model, setModel] = useState<StudioModel>(lipsyncModels[0]);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [params, setParams] = useState<Record<string, string | number | boolean>>({});
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const needsImage = model.requiresImage === true;
  const needsVideo = model.requiresVideo === true;

  const handleParamChange = useCallback((key: string, value: string | number | boolean) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!audioUrl) {
      return;
    }
    if (needsImage && !imageUrl) {
      return;
    }
    if (needsVideo && !videoUrl) {
      return;
    }

    setStatus('processing');
    setError('');
    setOutput(null);
    try {
      const allParams: Record<string, string | number | boolean> = { ...params };
      if (model.audioField) {
        allParams[model.audioField] = audioUrl;
      }
      if (needsImage && model.imageField) {
        allParams[model.imageField] = imageUrl;
      }
      if (needsVideo && model.videoField) {
        allParams[model.videoField] = videoUrl;
      }
      const result = await generateAndPoll(model.endpoint, allParams, setStatus as (s: string) => void);
      setOutput(result);
      setStatus('completed');
      setHistory((prev) => [
        {
          id: Date.now().toString(),
          output: result,
          model: model.name,
          prompt: 'Lip sync generation',
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('failed');
    }
  }, [audioUrl, imageUrl, videoUrl, params, model, needsImage, needsVideo]);

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    setOutput(entry.output);
    setStatus('completed');
  }, []);

  const canGenerate = audioUrl && ((needsImage && imageUrl) || (needsVideo && videoUrl));

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:flex-row">
      {/* Controls Panel */}
      <div className="flex w-full flex-col gap-4 lg:w-80 lg:flex-shrink-0">
        {/* Model Picker */}
        <ModelPicker
          models={lipsyncModels}
          selected={model}
          onSelect={(m) => {
            setModel(m);
            setParams({});
            setImageUrl('');
            setVideoUrl('');
          }}
        />

        {/* Info */}
        <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
          <p className="text-xs text-purple-300">
            {needsVideo
              ? 'This model syncs lip movements on an existing video with audio.'
              : 'This model creates a talking head video from a portrait image and audio.'}
          </p>
        </div>

        {/* Image or Video Upload */}
        {needsImage && (
          <UploadPicker
            accept="image"
            value={imageUrl}
            onChange={setImageUrl}
            label="Portrait Image"
          />
        )}
        {needsVideo && (
          <UploadPicker
            accept="video"
            value={videoUrl}
            onChange={setVideoUrl}
            label="Source Video"
          />
        )}

        {/* Audio Upload */}
        <UploadPicker
          accept="audio"
          value={audioUrl}
          onChange={setAudioUrl}
          label="Audio File"
        />

        {/* Dynamic Params */}
        <ParamControls
          inputs={model.inputs}
          values={params}
          onChange={handleParamChange}
          hiddenFields={[
            model.imageField ?? '',
            model.videoField ?? '',
            model.audioField ?? '',
          ]}
        />

        {/* Generate Button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={status === 'processing' || !canGenerate}
          className="flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Wand2 className="h-4 w-4" />
          {status === 'processing' ? 'Generating...' : 'Generate Lip Sync'}
        </button>
      </div>

      {/* Result Panel */}
      <div className="flex flex-1 flex-col gap-4">
        <GenerationResult status={status} output={output} error={error} />
        <GenerationHistory entries={history} onSelect={handleHistorySelect} />
      </div>
    </div>
  );
}
