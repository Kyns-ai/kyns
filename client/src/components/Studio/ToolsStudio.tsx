import React, { useState, useCallback } from 'react';
import {
  Wand2,
  ArrowLeft,
  Maximize,
  Eraser,
  Palette,
  Shirt,
  UserRound,
  ScanFace,
  Expand,
  Sparkles,
} from 'lucide-react';
import { toolModels } from './lib/models';
import { generateAndPoll } from './lib/studioApi';
import UploadPicker from './components/UploadPicker';
import ParamControls from './components/ParamControls';
import GenerationResult from './components/GenerationResult';
import type { StudioModel } from './lib/models';

const TOOL_ICONS: Record<string, React.ReactNode> = {
  'ai-image-upscaler': <Maximize className="h-6 w-6" />,
  'ai-background-remover': <Eraser className="h-6 w-6" />,
  'ai-image-face-swap': <ScanFace className="h-6 w-6" />,
  'ai-dress-change': <Shirt className="h-6 w-6" />,
  'ai-ghibli-style': <Palette className="h-6 w-6" />,
  'ai-object-eraser': <Eraser className="h-6 w-6" />,
  'ai-image-extension': <Expand className="h-6 w-6" />,
  'topaz-image-upscale': <Sparkles className="h-6 w-6" />,
};

export default function ToolsStudio() {
  const [selectedTool, setSelectedTool] = useState<StudioModel | null>(null);
  const [uploads, setUploads] = useState<Record<string, string>>({});
  const [params, setParams] = useState<Record<string, string | number | boolean>>({});
  const [status, setStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleParamChange = useCallback((key: string, value: string | number | boolean) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleUploadChange = useCallback((field: string, url: string) => {
    setUploads((prev) => ({ ...prev, [field]: url }));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!selectedTool) {
      return;
    }
    setStatus('processing');
    setError('');
    setOutput(null);
    try {
      const allParams: Record<string, string | number | boolean> = { ...params };
      for (const [field, url] of Object.entries(uploads)) {
        if (url) {
          allParams[field] = url;
        }
      }
      const result = await generateAndPoll(selectedTool.endpoint, allParams, setStatus as (s: string) => void);
      setOutput(result);
      setStatus('completed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setStatus('failed');
    }
  }, [selectedTool, params, uploads]);

  const handleBack = useCallback(() => {
    setSelectedTool(null);
    setUploads({});
    setParams({});
    setStatus('idle');
    setOutput(null);
    setError('');
  }, []);

  const imageFields = selectedTool
    ? Object.entries(selectedTool.inputs).filter(
        ([_, input]) => input.type === 'text' && !['prompt'].includes(_.toLowerCase()),
      )
    : [];

  const hasPrompt = selectedTool
    ? Object.keys(selectedTool.inputs).includes('prompt')
    : false;

  const allUploaded = selectedTool
    ? imageFields.every(([key]) => !!uploads[key])
    : false;

  if (!selectedTool) {
    return (
      <div className="p-4">
        <h2 className="mb-4 text-sm font-medium text-gray-400">AI Tools</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {toolModels.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => setSelectedTool(tool)}
              className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-xl transition-all hover:border-purple-500/50 hover:bg-white/10"
            >
              <div className="rounded-lg bg-purple-500/20 p-3 text-purple-400">
                {TOOL_ICONS[tool.id] ?? <Wand2 className="h-6 w-6" />}
              </div>
              <div>
                <div className="text-sm font-medium text-white">{tool.name}</div>
                <div className="mt-1 text-xs text-gray-400">{tool.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4 lg:flex-row">
      {/* Controls */}
      <div className="flex w-full flex-col gap-4 lg:w-80 lg:flex-shrink-0">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to tools
        </button>

        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-500/20 p-2 text-purple-400">
              {TOOL_ICONS[selectedTool.id] ?? <Wand2 className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-medium text-white">{selectedTool.name}</h3>
              <p className="text-xs text-gray-400">{selectedTool.description}</p>
            </div>
          </div>
        </div>

        {/* Upload fields */}
        {imageFields.map(([key, input]) => (
          <UploadPicker
            key={key}
            accept="image"
            value={uploads[key] ?? ''}
            onChange={(url) => handleUploadChange(key, url)}
            label={input.label}
          />
        ))}

        {/* Prompt if needed */}
        {hasPrompt && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-400">
              {selectedTool.inputs.prompt.label}
            </label>
            <textarea
              value={String(params.prompt ?? '')}
              onChange={(e) => handleParamChange('prompt', e.target.value)}
              placeholder={selectedTool.inputs.prompt.placeholder ?? 'Describe what you want...'}
              rows={3}
              className="resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-purple-500"
            />
          </div>
        )}

        {/* Other params */}
        <ParamControls
          inputs={selectedTool.inputs}
          values={params}
          onChange={handleParamChange}
          hiddenFields={[
            'prompt',
            ...imageFields.map(([key]) => key),
          ]}
        />

        {/* Generate */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={status === 'processing' || !allUploaded}
          className="flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Wand2 className="h-4 w-4" />
          {status === 'processing' ? 'Processing...' : 'Apply'}
        </button>
      </div>

      {/* Result */}
      <div className="flex flex-1 flex-col gap-4">
        <GenerationResult status={status} output={output} error={error} />
      </div>
    </div>
  );
}
