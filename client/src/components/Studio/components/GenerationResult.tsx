import React from 'react';
import { Download, Loader2, AlertCircle } from 'lucide-react';

interface GenerationResultProps {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  output?: Record<string, string>;
  error?: string;
}

function getMediaUrl(output: Record<string, string>): { url: string; type: 'image' | 'video' | 'audio' } | null {
  if (output.image_url) {
    return { url: output.image_url, type: 'image' };
  }
  if (output.video_url) {
    return { url: output.video_url, type: 'video' };
  }
  if (output.audio_url) {
    return { url: output.audio_url, type: 'audio' };
  }
  const firstUrl = Object.values(output).find((v) => typeof v === 'string' && v.startsWith('http'));
  if (firstUrl) {
    if (firstUrl.match(/\.(mp4|webm|mov)(\?|$)/i)) {
      return { url: firstUrl, type: 'video' };
    }
    return { url: firstUrl, type: 'image' };
  }
  return null;
}

function handleDownload(url: string, type: string) {
  const ext = type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'png';
  const link = document.createElement('a');
  link.href = url;
  link.download = `kyns-studio-${Date.now()}.${ext}`;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function GenerationResult({ status, output, error }: GenerationResultProps) {
  if (status === 'idle') {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-white/10 p-12">
        <p className="text-sm text-gray-500">Your generation will appear here</p>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 p-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        <p className="text-sm text-gray-400">Generating... This may take a few minutes</p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-12">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm text-red-400">{error ?? 'Generation failed'}</p>
      </div>
    );
  }

  if (!output) {
    return null;
  }

  const media = getMediaUrl(output);
  if (!media) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/5 p-12">
        <p className="text-sm text-gray-400">No output received</p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5">
      {media.type === 'video' ? (
        <video src={media.url} controls autoPlay loop className="w-full rounded-xl" />
      ) : media.type === 'audio' ? (
        <div className="flex items-center justify-center p-12">
          <audio src={media.url} controls className="w-full" />
        </div>
      ) : (
        <img src={media.url} alt="Generated" className="w-full rounded-xl" />
      )}
      <button
        type="button"
        onClick={() => handleDownload(media.url, media.type)}
        className="absolute right-3 top-3 rounded-lg bg-black/60 p-2 text-white backdrop-blur-sm transition-colors hover:bg-purple-600"
      >
        <Download className="h-4 w-4" />
      </button>
    </div>
  );
}
