import React, { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import type { StudioModel } from '../lib/models';

interface ModelPickerProps {
  models: StudioModel[];
  selected: StudioModel;
  onSelect: (model: StudioModel) => void;
}

export default function ModelPicker({ models, selected, onSelect }: ModelPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-white backdrop-blur-xl transition-colors hover:border-purple-500/50 hover:bg-white/10"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <div>
            <div className="font-medium">{selected.name}</div>
            <div className="text-xs text-gray-400">{selected.description}</div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-white/10 bg-gray-900 shadow-2xl">
          {models.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => {
                onSelect(model);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/10 ${
                model.id === selected.id ? 'bg-purple-500/20 text-purple-300' : 'text-white'
              }`}
            >
              <div>
                <div className="font-medium">{model.name}</div>
                <div className="text-xs text-gray-400">{model.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
