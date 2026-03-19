import React from 'react';
import type { ModelInput } from '../lib/models';

interface ParamControlsProps {
  inputs: Record<string, ModelInput>;
  values: Record<string, string | number | boolean>;
  onChange: (key: string, value: string | number | boolean) => void;
  hiddenFields?: string[];
}

export default function ParamControls({ inputs, values, onChange, hiddenFields = [] }: ParamControlsProps) {
  const visibleInputs = Object.entries(inputs).filter(
    ([key, input]) => !hiddenFields.includes(key) && input.type !== 'textarea',
  );

  if (visibleInputs.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {visibleInputs.map(([key, input]) => (
        <div key={key} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-400">{input.label}</label>
          {input.type === 'select' && input.enum ? (
            <select
              value={String(values[key] ?? input.default ?? '')}
              onChange={(e) => onChange(key, e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-purple-500"
            >
              {input.enum.map((opt) => (
                <option key={opt} value={opt} className="bg-gray-900">
                  {opt}
                </option>
              ))}
            </select>
          ) : input.type === 'number' ? (
            <input
              type="number"
              value={Number(values[key] ?? input.default ?? 0)}
              min={input.min}
              max={input.max}
              step={input.step ?? 1}
              onChange={(e) => onChange(key, Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-purple-500"
            />
          ) : input.type === 'boolean' ? (
            <button
              type="button"
              onClick={() => onChange(key, !(values[key] ?? input.default ?? false))}
              className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                values[key] ?? input.default
                  ? 'border-purple-500 bg-purple-500/20 text-purple-300'
                  : 'border-white/10 bg-white/5 text-gray-400'
              }`}
            >
              {(values[key] ?? input.default) ? 'On' : 'Off'}
            </button>
          ) : (
            <input
              type="text"
              value={String(values[key] ?? input.default ?? '')}
              placeholder={input.placeholder}
              onChange={(e) => onChange(key, e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-purple-500"
            />
          )}
        </div>
      ))}
    </div>
  );
}
