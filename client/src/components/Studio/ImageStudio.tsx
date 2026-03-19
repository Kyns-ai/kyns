import React, { useState, useCallback, useRef } from 'react';
import axios from 'axios';
import { Download, Loader2, ImageIcon, Sparkles, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocalize } from '~/hooks';

interface GeneratedImage {
  dataUrl: string;
  prompt: string;
  model: string;
  width: number;
  height: number;
  createdAt: number;
}

const MODELS = [
  { id: 'flux2klein', label: 'FLUX.2 Klein', description: 'Alta qualidade, detalhado' },
  { id: 'zimage', label: 'Z-Image Turbo', description: 'Rápido, estilo artístico' },
] as const;

export default function ImageStudio() {
  const navigate = useNavigate();
  const localize = useLocalize();
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<string>('flux2klein');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const generate = useCallback(async () => {
    if (!prompt.trim() || loading) {
      return;
    }
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(
        '/api/studio/generate',
        { prompt: prompt.trim(), model },
        { timeout: 480_000 },
      );
      const img: GeneratedImage = {
        dataUrl: `data:image/png;base64,${response.data.image}`,
        model: response.data.model,
        width: response.data.width,
        height: response.data.height,
        prompt: prompt.trim(),
        createdAt: Date.now(),
      };
      setImages((prev) => [img, ...prev]);
      setSelectedImage(img);
    } catch (err) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.error
          ? err.response.data.error
          : 'Erro ao gerar imagem. Tente novamente.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [prompt, model, loading]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        generate();
      }
    },
    [generate],
  );

  const downloadImage = useCallback((img: GeneratedImage) => {
    const a = document.createElement('a');
    a.href = img.dataUrl;
    a.download = `kyns-studio-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <div className="flex h-full w-full flex-col bg-gray-50 dark:bg-gray-800">
      <header className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <button
          onClick={() => navigate('/c/new')}
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700"
          aria-label={localize('com_ui_back')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">KYNS Studio</h1>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-80 flex-col border-r border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Modelo
            </label>
            <div className="flex flex-col gap-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    model === m.id
                      ? 'border-purple-500 bg-purple-50 dark:border-purple-400 dark:bg-purple-900/20'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-600 dark:hover:border-gray-500'
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{m.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{m.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4 flex-1">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Prompt
            </label>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Descreva a imagem que deseja gerar..."
              rows={6}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
              disabled={loading}
            />
          </div>

          <button
            onClick={generate}
            disabled={loading || !prompt.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Imagem
              </>
            )}
          </button>

          {error && (
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden">
          {selectedImage ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6">
              <div className="relative max-h-[70vh] overflow-hidden rounded-xl shadow-2xl">
                <img
                  src={selectedImage.dataUrl}
                  alt={selectedImage.prompt}
                  className="max-h-[70vh] object-contain"
                />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => downloadImage(selectedImage)}
                  className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {selectedImage.width}×{selectedImage.height} · {MODELS.find((m) => m.id === selectedImage.model)?.label}
                </span>
              </div>
              <p className="mt-2 max-w-lg text-center text-sm text-gray-500 dark:text-gray-400">
                {selectedImage.prompt}
              </p>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-gray-400 dark:text-gray-500">
              <ImageIcon className="mb-3 h-16 w-16 opacity-30" />
              <p className="text-lg">Suas imagens aparecerão aqui</p>
              <p className="text-sm">Escreva um prompt e clique em Gerar</p>
            </div>
          )}

          {images.length > 1 && (
            <div className="border-t border-gray-200 p-4 dark:border-gray-700">
              <div className="flex gap-3 overflow-x-auto pb-2">
                {images.map((img) => (
                  <button
                    key={img.createdAt}
                    onClick={() => setSelectedImage(img)}
                    className={`flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                      selectedImage?.createdAt === img.createdAt
                        ? 'border-purple-500'
                        : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <img src={img.dataUrl} alt={img.prompt} className="h-20 w-20 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
