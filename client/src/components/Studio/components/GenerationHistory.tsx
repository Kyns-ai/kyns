import React from 'react';

interface HistoryEntry {
  id: string;
  output: string | null;
  model: string;
  prompt: string;
  timestamp: number;
}

interface GenerationHistoryProps {
  entries: HistoryEntry[];
  onSelect: (entry: HistoryEntry) => void;
}

function isVideoUrl(url: string): boolean {
  return !!url.match(/\.(mp4|webm|mov|avi)(\?|$)/i);
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
        {entries.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => onSelect(entry)}
            className="group relative flex-shrink-0 overflow-hidden rounded-lg border border-white/10 transition-colors hover:border-purple-500"
          >
            {entry.output && isVideoUrl(entry.output) ? (
              <video src={entry.output} muted className="h-20 w-20 object-cover" />
            ) : entry.output ? (
              <img src={entry.output} alt={entry.prompt} className="h-20 w-20 object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center bg-white/5 text-xs text-gray-500">
                No preview
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1">
              <p className="truncate text-[10px] text-gray-300">{entry.model}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
