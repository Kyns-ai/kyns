import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Image, Film, Music, Loader2 } from 'lucide-react';
import { uploadFile } from '../lib/studioApi';

type AcceptType = 'image' | 'video' | 'audio';

interface UploadPickerProps {
  accept: AcceptType | AcceptType[];
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

interface UploadEntry {
  url: string;
  name: string;
  type: AcceptType;
  timestamp: number;
}

const STORAGE_KEY = 'kyns_studio_uploads';
const MAX_HISTORY = 20;

const ACCEPT_MAP: Record<AcceptType, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
};

const ICON_MAP: Record<AcceptType, React.ReactNode> = {
  image: <Image className="h-4 w-4" />,
  video: <Film className="h-4 w-4" />,
  audio: <Music className="h-4 w-4" />,
};

function getAcceptString(accept: AcceptType | AcceptType[]): string {
  const types = Array.isArray(accept) ? accept : [accept];
  return types.map((t) => ACCEPT_MAP[t]).join(',');
}

function detectType(file: File): AcceptType {
  if (file.type.startsWith('video/')) {
    return 'video';
  }
  if (file.type.startsWith('audio/')) {
    return 'audio';
  }
  return 'image';
}

function loadHistory(): UploadEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: UploadEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
}

export default function UploadPicker({ accept, value, onChange, label }: UploadPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<UploadEntry[]>(loadHistory);
  const inputRef = useRef<HTMLInputElement>(null);
  const acceptTypes = Array.isArray(accept) ? accept : [accept];

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError('');
      try {
        const url = await uploadFile(file);
        onChange(url);
        const entry: UploadEntry = {
          url,
          name: file.name,
          type: detectType(file),
          timestamp: Date.now(),
        };
        const updated = [entry, ...history.filter((h) => h.url !== url)];
        setHistory(updated);
        saveHistory(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
      } finally {
        setUploading(false);
      }
    },
    [history, onChange],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleUpload(file);
      }
    },
    [handleUpload],
  );

  const filteredHistory = history.filter((h) => acceptTypes.includes(h.type));

  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-xs font-medium text-gray-400">{label}</label>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-white/5 px-4 py-3 text-sm text-gray-400 transition-colors hover:border-purple-500/50 hover:text-white disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              {value ? 'Change file' : 'Upload file'}
            </>
          )}
        </button>
        {filteredHistory.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-400 transition-colors hover:text-white"
          >
            History ({filteredHistory.length})
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={getAcceptString(accept)}
        onChange={handleFileChange}
        className="hidden"
      />
      {value && (
        <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-2">
          {ICON_MAP[acceptTypes[0]]}
          <span className="flex-1 truncate text-xs text-purple-300">{value}</span>
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-gray-400 hover:text-white"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {showHistory && filteredHistory.length > 0 && (
        <div className="grid grid-cols-4 gap-2 rounded-lg border border-white/10 bg-white/5 p-2">
          {filteredHistory.map((entry) => (
            <button
              key={entry.url}
              type="button"
              onClick={() => {
                onChange(entry.url);
                setShowHistory(false);
              }}
              className="group relative overflow-hidden rounded-md border border-white/10 transition-colors hover:border-purple-500"
            >
              {entry.type === 'image' ? (
                <img src={entry.url} alt={entry.name} className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-white/5">
                  {ICON_MAP[entry.type]}
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-black/70 px-1 py-0.5">
                <p className="truncate text-[10px] text-gray-300">{entry.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
