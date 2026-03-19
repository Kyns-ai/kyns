import React from 'react';
import { Download } from 'lucide-react';

interface HistoryEntry {
  id: string;
  output: Record<string, string>;
  model: string;
  prompt: string;
  timestamp: number;
}

interface GenerationHistoryProps {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
}

function getThumbUrl(output: Record<string, string>): string | null {
  return output.image_url ?? output.video_url ?? Object.values(output).find(
    (v) => typeof v === 'string' && v.startsWith('http'),
  ) ?? null;
}

function isVideo(output: Record<string, string>): boolean {
  const url = output.video_url ?? '';
  return !!url || Object.values(output).some(
    (v) => typeof v === 'string' && v.match(/\.(mp4|webm|mov)(\?|$)/i),
  );
}

export { type HistoryEntry };

export default function GenerationHistory({ entries, onSelect }: GenerationHistoryProps) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium text-gray-400">Session History</h3>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {entries.map((entry) => {
          const thumb = getThumbUrl(entry.output);
          const video = isVideo(entry.output);
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => onSelect(entry)}
              className="group relative flex-shrink-0 overflow-hidden rounded-lg border border-white/10 transition-colors hover:border-purple-500"
            >
              {thumb && video ? (
                <video src={thumb} muted className="h-20 w-20 object-cover" />
              ) : thumb ? (
                <img src={thumb} alt={entry.prompt} className="h-20 w-20 object-cover" />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center bg-white/5 text-xs text-gray-500">
                  No preview
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                <p className="truncate text-[10px] text-gray-300">{entry.model}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
