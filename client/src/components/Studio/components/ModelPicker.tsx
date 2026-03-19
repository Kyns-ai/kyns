import React, { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { useLocalize } from '~/hooks';
import type { StudioModel } from '../lib/models';

interface ModelPickerProps {
  models: StudioModel[];
  selected: StudioModel;
  onSelect: (model: StudioModel) => void;
}

function SpicyBalloon() {
  const localize = useLocalize();
  const label = localize('com_studio_spicy_badge');

  return (
    <span className="relative ml-2 inline-flex shrink-0 items-center" title={label}>
      <span
        className="absolute -left-1 top-1/2 z-0 h-2 w-2 -translate-y-1/2 rotate-45 rounded-[1px] border-b border-l border-orange-400/55 bg-gradient-to-br from-orange-500/35 to-orange-700/25"
        aria-hidden
      />
      <span
        className="relative z-10 inline-flex items-center gap-0.5 rounded-lg border border-orange-400/55 bg-gradient-to-b from-orange-500/35 to-orange-900/40 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-orange-100 shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
        aria-label={label}
      >
        <span className="text-[12px] leading-none" aria-hidden>
          🌶️
        </span>
        <span>{label}</span>
      </span>
    </span>
  );
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
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-purple-400" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-0 gap-y-1 font-medium">
              <span className="truncate">{selected.name}</span>
              {selected.spicy ? <SpicyBalloon /> : null}
            </div>
            <div className="text-xs text-gray-400">{selected.description}</div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
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
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-0 gap-y-1 font-medium">
                  <span className="truncate">{model.name}</span>
                  {model.spicy ? <SpicyBalloon /> : null}
                </div>
                <div className="text-xs text-gray-400">{model.description}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
