import React, { useState, useCallback, useMemo } from 'react';
import { Wand2 } from 'lucide-react';
import { t2iModels, i2iModels } from './lib/models';
import { generateAndPoll } from './lib/studioApi';
import ModelPicker from './components/ModelPicker';
import ParamControls from './components/ParamControls';
import UploadPicker from './components/UploadPicker';
import GenerationResult from './components/GenerationResult';
import GenerationHistory from './components/GenerationHistory';
import type { HistoryEntry } from './components/GenerationHistory';
import type { StudioModel } from './lib/models';

export default function ImageStudio() {
  const [mode, setMode] = useState<'t2i' | 'i2i'>('t2i');
  const [model, setModel] = useState<StudioModel>(t2iModels[0]);
  const [prompt, setPrompt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [params, setParams] = useState<Record<string, string | number | boolean>>({});
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const currentModels = useMemo(() => (mode === 'i2i' ? i2iModels : t2iModels), [mode]);

  const handleModeChange = useCallback(
    (newMode: 't2i' | 'i2i') => {
      setMode(newMode);
      const models = newMode === 'i2i' ? i2iModels : t2iModels;
      setModel(models[0]);
      setParams({});
    },
    [],
  );

  const handleImageChange = useCallback(
    (url: string) => {
      setImageUrl(url);
      if (url && mode === 't2i') {
        handleModeChange('i2i');
      } else if (!url && mode === 'i2i') {
        handleModeChange('t2i');
      }
    },
    [mode, handleModeChange],
  );

  const handleParamChange = useCallback((key: string, value: string | number | boolean) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() && !imageUrl) {
      return;
    }
    setStatus('processing');
    setError('');
    setOutput(null);
    try {
      const allParams: Record<string, string | number | boolean> = { ...params };
      if (prompt.trim()) {
        allParams.prompt = prompt.trim();
      }
      if (imageUrl && model.imageField) {
        allParams[model.imageField] = imageUrl;
      }
      const result = await generateAndPoll(model.endpoint, allParams, setStatus as (s: string) => void);
      setOutput(result);
      setStatus('completed');
      setHistory((prev) => [
        {
          id: Date.now().toString(),
          output: result,
          model: model.name,
          prompt: prompt.trim(),
          timestamp: Date.now(),
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('failed');
    }
  }, [prompt, imageUrl, params, model]);

  const handleHistorySelect = useCallback((entry: HistoryEntry) => {
    setOutput(entry.output);
    setStatus('completed');
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate],
  );

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:flex-row">
      {/* Controls Panel */}
      <div className="flex w-full flex-col gap-4 lg:w-80 lg:flex-shrink-0">
        {/* Mode Toggle */}
        <div className="flex rounded-lg border border-white/10 bg-white/5 p-1">
          <button
            type="button"
            onClick={() => handleModeChange('t2i')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 't2i' ? 'bg-purple-500/20 text-purple-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            Text to Image
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('i2i')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === 'i2i' ? 'bg-purple-500/20 text-purple-300' : 'text-gray-400 hover:text-white'
            }`}
          >
            Image to Image
          </button>
        </div>

        {/* Model Picker */}
        <ModelPicker models={currentModels} selected={model} onSelect={(m) => { setModel(m); setParams({}); }} />

        {/* Prompt */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-400">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the image you want to create..."
            rows={4}
            className="resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-purple-500"
          />
        </div>

        {/* Image Upload (for I2I or optional reference) */}
        <UploadPicker
          accept="image"
          value={imageUrl}
          onChange={handleImageChange}
          label="Reference Image"
        />

        {/* Dynamic Params */}
        <ParamControls
          inputs={model.inputs}
          values={params}
          onChange={handleParamChange}
          hiddenFields={['prompt', model.imageField ?? '']}
        />

        {/* Generate Button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={status === 'processing' || (!prompt.trim() && !imageUrl)}
          className="flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Wand2 className="h-4 w-4" />
          {status === 'processing' ? 'Generating...' : 'Generate'}
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
