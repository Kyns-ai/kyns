type InputType = 'text' | 'number' | 'select' | 'boolean' | 'textarea';

interface ModelInput {
  type: InputType;
  label: string;
  default?: string | number | boolean;
  enum?: string[];
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

interface StudioModel {
  id: string;
  name: string;
  endpoint: string;
  category: 't2i' | 'i2i' | 't2v' | 'i2v' | 'lipsync' | 'tool';
  description: string;
  inputs: Record<string, ModelInput>;
  requiresImage?: boolean;
  requiresVideo?: boolean;
  requiresAudio?: boolean;
  imageField?: string;
  videoField?: string;
  audioField?: string;
}

export type { InputType, ModelInput, StudioModel };

/* -------------------------------------------------------------------------- */
/*  T2I Models                                                                */
/* -------------------------------------------------------------------------- */

export const t2iModels: StudioModel[] = [
  {
    id: 'flux-dev',
    name: 'FLUX Dev',
    endpoint: 'flux-dev',
    category: 't2i',
    description: 'High quality open source model',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
      },
      num_outputs: { type: 'number', label: 'Number of Outputs', default: 1, min: 1, max: 4 },
    },
  },
  {
    id: 'flux-schnell',
    name: 'FLUX Schnell',
    endpoint: 'flux-schnell',
    category: 't2i',
    description: 'Fast generation',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
      },
      num_outputs: { type: 'number', label: 'Number of Outputs', default: 1, min: 1, max: 4 },
    },
  },
  {
    id: 'flux-2-pro',
    name: 'FLUX 2 Pro',
    endpoint: 'flux-2-pro',
    category: 't2i',
    description: 'Professional quality',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
      },
      image_format: {
        type: 'select',
        label: 'Image Format',
        default: 'webp',
        enum: ['webp', 'png', 'jpg'],
      },
    },
  },
  {
    id: 'midjourney-v7-text-to-image',
    name: 'Midjourney V7',
    endpoint: 'midjourney-v7-text-to-image',
    category: 't2i',
    description: 'Artistic style',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
    },
  },
  {
    id: 'gpt4o-text-to-image',
    name: 'GPT-4o Image',
    endpoint: 'gpt4o-text-to-image',
    category: 't2i',
    description: 'OpenAI image gen',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
      quality: {
        type: 'select',
        label: 'Quality',
        default: 'high',
        enum: ['low', 'medium', 'high'],
      },
    },
  },
  {
    id: 'gpt-image-1.5',
    name: 'GPT Image 1.5',
    endpoint: 'gpt-image-1.5',
    category: 't2i',
    description: 'Latest OpenAI',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
      quality: {
        type: 'select',
        label: 'Quality',
        default: 'high',
        enum: ['low', 'medium', 'high'],
      },
    },
  },
  {
    id: 'google-imagen4',
    name: 'Google Imagen 4',
    endpoint: 'google-imagen4',
    category: 't2i',
    description: "Google's latest",
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3'],
      },
    },
  },
  {
    id: 'ideogram-v3-t2i',
    name: 'Ideogram V3',
    endpoint: 'ideogram-v3-t2i',
    category: 't2i',
    description: 'Best for text in images',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '10:16', '16:10'],
      },
      magic_prompt: {
        type: 'select',
        label: 'Magic Prompt',
        default: 'AUTO',
        enum: ['AUTO', 'ON', 'OFF'],
      },
    },
  },
  {
    id: 'nano-banana-2',
    name: 'Nano Banana 2',
    endpoint: 'nano-banana-2',
    category: 't2i',
    description: 'Fast and creative',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
    },
  },
  {
    id: 'seedream-5.0',
    name: 'Seedream 5.0',
    endpoint: 'seedream-5.0',
    category: 't2i',
    description: 'ByteDance latest',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
    },
  },
  {
    id: 'kling-o1-text-to-image',
    name: 'Kling O1',
    endpoint: 'kling-o1-text-to-image',
    category: 't2i',
    description: 'Kuaishou model',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '2:3', '3:2'],
      },
    },
  },
  {
    id: 'wan2.6-text-to-image',
    name: 'Wan 2.6 Image',
    endpoint: 'wan2.6-text-to-image',
    category: 't2i',
    description: 'Alibaba model',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
      resolution: {
        type: 'select',
        label: 'Resolution',
        default: '1024',
        enum: ['512', '720', '1024'],
      },
    },
  },
  {
    id: 'z-image-turbo',
    name: 'Z-Image Turbo',
    endpoint: 'z-image-turbo',
    category: 't2i',
    description: 'Ultra fast',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
    },
  },
  {
    id: 'flux-kontext-pro-t2i',
    name: 'FLUX Kontext Pro',
    endpoint: 'flux-kontext-pro-t2i',
    category: 't2i',
    description: 'Contextual generation',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9', '9:21'],
      },
    },
  },
  {
    id: 'grok-imagine-text-to-image',
    name: 'Grok Imagine',
    endpoint: 'grok-imagine-text-to-image',
    category: 't2i',
    description: 'xAI model',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
    },
  },
];

/* -------------------------------------------------------------------------- */
/*  I2I Models                                                                */
/* -------------------------------------------------------------------------- */

export const i2iModels: StudioModel[] = [
  {
    id: 'flux-kontext-dev-i2i',
    name: 'FLUX Kontext Dev',
    endpoint: 'flux-kontext-dev-i2i',
    category: 'i2i',
    description: 'Image editing with context',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL', placeholder: 'Upload image first' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
    },
  },
  {
    id: 'gpt4o-image-to-image',
    name: 'GPT-4o Edit',
    endpoint: 'gpt4o-image-to-image',
    category: 'i2i',
    description: 'OpenAI image editing',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
    },
  },
  {
    id: 'gpt4o-edit',
    name: 'GPT-4o Advanced Edit',
    endpoint: 'gpt4o-edit',
    category: 'i2i',
    description: 'Advanced editing',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
    },
  },
  {
    id: 'nano-banana-2-edit',
    name: 'Nano Banana 2 Edit',
    endpoint: 'nano-banana-2-edit',
    category: 'i2i',
    description: 'Fast editing',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
    },
  },
  {
    id: 'bytedance-seedream-v4.5-edit',
    name: 'Seedream 4.5 Edit',
    endpoint: 'bytedance-seedream-v4.5-edit',
    category: 'i2i',
    description: 'ByteDance editor',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
    },
  },
  {
    id: 'image-effects',
    name: 'Image Effects',
    endpoint: 'image-effects',
    category: 'i2i',
    description: 'Apply effects',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
    },
  },
  {
    id: 'flux-pulid',
    name: 'Flux PuLID (Face Consistent)',
    endpoint: 'flux-pulid',
    category: 'i2i',
    description: 'Mantém identidade facial da referência em novas imagens',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Reference Image URL' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '1:1',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
    },
  },
];

/* -------------------------------------------------------------------------- */
/*  Tool Models                                                               */
/* -------------------------------------------------------------------------- */

export const toolModels: StudioModel[] = [
  {
    id: 'ai-image-upscaler',
    name: 'AI Upscaler',
    endpoint: 'ai-image-upscaler',
    category: 'tool',
    description: 'Upscale images',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      scale: { type: 'select', label: 'Scale', default: '2', enum: ['2', '4'] },
    },
  },
  {
    id: 'ai-background-remover',
    name: 'Background Remover',
    endpoint: 'ai-background-remover',
    category: 'tool',
    description: 'Remove backgrounds',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
    },
  },
  {
    id: 'ai-image-face-swap',
    name: 'Face Swap',
    endpoint: 'ai-image-face-swap',
    category: 'tool',
    description: 'Swap faces',
    requiresImage: true,
    imageField: 'target_image_url',
    inputs: {
      target_image_url: { type: 'text', label: 'Target Image' },
      source_image_url: { type: 'text', label: 'Source Face Image' },
    },
  },
  {
    id: 'ai-dress-change',
    name: 'Dress Change',
    endpoint: 'ai-dress-change',
    category: 'tool',
    description: 'Virtual try-on',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      image_url: { type: 'text', label: 'Person Image' },
      dress_image_url: { type: 'text', label: 'Dress Image' },
    },
  },
  {
    id: 'ai-ghibli-style',
    name: 'Ghibli Style',
    endpoint: 'ai-ghibli-style',
    category: 'tool',
    description: 'Studio Ghibli filter',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
    },
  },
  {
    id: 'ai-object-eraser',
    name: 'Object Eraser',
    endpoint: 'ai-object-eraser',
    category: 'tool',
    description: 'Remove objects',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      prompt: { type: 'textarea', label: 'What to remove' },
    },
  },
  {
    id: 'ai-image-extension',
    name: 'Image Extension',
    endpoint: 'ai-image-extension',
    category: 'tool',
    description: 'Extend/outpaint',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      prompt: { type: 'textarea', label: 'Describe the extension' },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
      },
    },
  },
  {
    id: 'topaz-image-upscale',
    name: 'Topaz Upscale',
    endpoint: 'topaz-image-upscale',
    category: 'tool',
    description: 'Premium upscaling',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      scale: { type: 'select', label: 'Scale', default: '2', enum: ['2', '4'] },
    },
  },
];

/* -------------------------------------------------------------------------- */
/*  T2V Models                                                                */
/* -------------------------------------------------------------------------- */

export const t2vModels: StudioModel[] = [
  {
    id: 'kling-v3.0-pro-text-to-video',
    name: 'Kling V3 Pro',
    endpoint: 'kling-v3.0-pro-text-to-video',
    category: 't2v',
    description: 'Professional video',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['5', '10'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'veo3-text-to-video',
    name: 'Veo 3',
    endpoint: 'veo3-text-to-video',
    category: 't2v',
    description: 'Google video gen',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      duration: { type: 'select', label: 'Duration', default: '8', enum: ['5', '8'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'veo3.1-text-to-video',
    name: 'Veo 3.1',
    endpoint: 'veo3.1-text-to-video',
    category: 't2v',
    description: 'Latest Google video',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      duration: { type: 'select', label: 'Duration', default: '8', enum: ['5', '8'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'sora-2-text-to-video',
    name: 'Sora 2',
    endpoint: 'sora-2-text-to-video',
    category: 't2v',
    description: 'OpenAI video',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      duration: {
        type: 'select',
        label: 'Duration',
        default: '5',
        enum: ['5', '10', '15', '20'],
      },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
      resolution: {
        type: 'select',
        label: 'Resolution',
        default: '720p',
        enum: ['480p', '720p', '1080p'],
      },
    },
  },
  {
    id: 'wan2.6-text-to-video',
    name: 'Wan 2.6 Video',
    endpoint: 'wan2.6-text-to-video',
    category: 't2v',
    description: 'Alibaba video',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['3', '5'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
      resolution: {
        type: 'select',
        label: 'Resolution',
        default: '720p',
        enum: ['480p', '720p'],
      },
    },
  },
  {
    id: 'wan2.2-text-to-video',
    name: 'Wan 2.2 Video',
    endpoint: 'wan2.2-text-to-video',
    category: 't2v',
    description: 'Alibaba model',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['3', '5'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'seedance-v2.0-t2v',
    name: 'Seedance V2',
    endpoint: 'seedance-v2.0-t2v',
    category: 't2v',
    description: 'ByteDance video',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['5', '10'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'runway-text-to-video',
    name: 'Runway Gen-3',
    endpoint: 'runway-text-to-video',
    category: 't2v',
    description: 'Runway video',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['5', '10'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'pixverse-v5.5-t2v',
    name: 'PixVerse V5.5',
    endpoint: 'pixverse-v5.5-t2v',
    category: 't2v',
    description: 'PixVerse video',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['5', '8'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'minimax-hailuo-2.3-pro-t2v',
    name: 'MiniMax Hailuo 2.3',
    endpoint: 'minimax-hailuo-2.3-pro-t2v',
    category: 't2v',
    description: 'MiniMax video',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['5', '10'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'grok-imagine-text-to-video',
    name: 'Grok Video',
    endpoint: 'grok-imagine-text-to-video',
    category: 't2v',
    description: 'xAI video',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['5', '10'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
];

/* -------------------------------------------------------------------------- */
/*  I2V Models                                                                */
/* -------------------------------------------------------------------------- */

export const i2vModels: StudioModel[] = [
  {
    id: 'wan2.2-image-to-video',
    name: 'Wan 2.2 I2V',
    endpoint: 'wan2.2-image-to-video',
    category: 'i2v',
    description: 'Alibaba I2V',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['3', '5'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'kling-v3.0-pro-image-to-video',
    name: 'Kling V3 Pro I2V',
    endpoint: 'kling-v3.0-pro-image-to-video',
    category: 'i2v',
    description: 'Kuaishou I2V',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['5', '10'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'veo3-image-to-video',
    name: 'Veo 3 I2V',
    endpoint: 'veo3-image-to-video',
    category: 'i2v',
    description: 'Google I2V',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
      duration: { type: 'select', label: 'Duration', default: '8', enum: ['5', '8'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'veo3.1-image-to-video',
    name: 'Veo 3.1 I2V',
    endpoint: 'veo3.1-image-to-video',
    category: 'i2v',
    description: 'Latest Google I2V',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
      duration: { type: 'select', label: 'Duration', default: '8', enum: ['5', '8'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'seedance-v2.0-i2v',
    name: 'Seedance V2 I2V',
    endpoint: 'seedance-v2.0-i2v',
    category: 'i2v',
    description: 'ByteDance I2V',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['5', '10'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'runway-image-to-video',
    name: 'Runway I2V',
    endpoint: 'runway-image-to-video',
    category: 'i2v',
    description: 'Runway I2V',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['5', '10'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'ai-video-effects',
    name: 'Video Effects',
    endpoint: 'ai-video-effects',
    category: 'i2v',
    description: 'Apply effects to images as video',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
    },
  },
  {
    id: 'ai-dance-effects',
    name: 'Dance Effects',
    endpoint: 'ai-dance-effects',
    category: 'i2v',
    description: 'Dance animation from image',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      name: {
        type: 'select',
        label: 'Dance Style',
        default: 'tiktok_dance',
        enum: [
          'tiktok_dance',
          'hip_hop',
          'salsa',
          'ballet',
          'breakdance',
          'robot',
          'shuffle',
          'wave',
          'pop',
          'lock',
        ],
      },
    },
  },
  {
    id: 'motion-controls',
    name: 'Motion Controls',
    endpoint: 'motion-controls',
    category: 'i2v',
    description: 'Controlled animation',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['3', '5'] },
    },
  },
  {
    id: 'pixverse-v5.5-i2v',
    name: 'PixVerse V5.5 I2V',
    endpoint: 'pixverse-v5.5-i2v',
    category: 'i2v',
    description: 'PixVerse I2V',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['5', '8'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'wan2.6-image-to-video',
    name: 'Wan 2.6 I2V',
    endpoint: 'wan2.6-image-to-video',
    category: 'i2v',
    description: 'Latest Alibaba I2V',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['3', '5'] },
      aspect_ratio: {
        type: 'select',
        label: 'Aspect Ratio',
        default: '16:9',
        enum: ['16:9', '9:16', '1:1'],
      },
    },
  },
  {
    id: 'midjourney-v7-image-to-video',
    name: 'Midjourney V7 I2V',
    endpoint: 'midjourney-v7-image-to-video',
    category: 'i2v',
    description: 'MJ image animation',
    requiresImage: true,
    imageField: 'image_url',
    inputs: {
      prompt: { type: 'textarea', label: 'Prompt' },
      image_url: { type: 'text', label: 'Image URL' },
      duration: { type: 'select', label: 'Duration', default: '5', enum: ['5', '10'] },
    },
  },
];

/* -------------------------------------------------------------------------- */
/*  Lip Sync Models                                                           */
/* -------------------------------------------------------------------------- */

export const lipsyncModels: StudioModel[] = [
  {
    id: 'infinitetalk-image-to-video',
    name: 'InfiniteTalk',
    endpoint: 'infinitetalk-image-to-video',
    category: 'lipsync',
    description: 'Portrait to talking video',
    requiresImage: true,
    requiresAudio: true,
    imageField: 'image_url',
    audioField: 'audio_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      audio_url: { type: 'text', label: 'Audio URL' },
      resolution: {
        type: 'select',
        label: 'Resolution',
        default: '720',
        enum: ['512', '720', '1024'],
      },
    },
  },
  {
    id: 'wan2.2-speech-to-video',
    name: 'Wan 2.2 Speech',
    endpoint: 'wan2.2-speech-to-video',
    category: 'lipsync',
    description: 'Speech driven video',
    requiresImage: true,
    requiresAudio: true,
    imageField: 'image_url',
    audioField: 'audio_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      audio_url: { type: 'text', label: 'Audio URL' },
    },
  },
  {
    id: 'ltx-2.3-lipsync',
    name: 'LTX 2.3 Lipsync',
    endpoint: 'ltx-2.3-lipsync',
    category: 'lipsync',
    description: 'LTX lip sync',
    requiresImage: true,
    requiresAudio: true,
    imageField: 'image_url',
    audioField: 'audio_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      audio_url: { type: 'text', label: 'Audio URL' },
    },
  },
  {
    id: 'ltx-2-19b-lipsync',
    name: 'LTX 2 19B',
    endpoint: 'ltx-2-19b-lipsync',
    category: 'lipsync',
    description: 'Large LTX model',
    requiresImage: true,
    requiresAudio: true,
    imageField: 'image_url',
    audioField: 'audio_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      audio_url: { type: 'text', label: 'Audio URL' },
    },
  },
  {
    id: 'sync-lipsync',
    name: 'Sync Lipsync',
    endpoint: 'sync-lipsync',
    category: 'lipsync',
    description: 'Accurate sync',
    requiresImage: true,
    requiresAudio: true,
    imageField: 'image_url',
    audioField: 'audio_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      audio_url: { type: 'text', label: 'Audio URL' },
    },
  },
  {
    id: 'latentsync-video',
    name: 'LatentSync Video',
    endpoint: 'latentsync-video',
    category: 'lipsync',
    description: 'Video lip sync',
    requiresVideo: true,
    requiresAudio: true,
    videoField: 'video_url',
    audioField: 'audio_url',
    inputs: {
      video_url: { type: 'text', label: 'Video URL' },
      audio_url: { type: 'text', label: 'Audio URL' },
    },
  },
  {
    id: 'creatify-lipsync',
    name: 'Creatify Lipsync',
    endpoint: 'creatify-lipsync',
    category: 'lipsync',
    description: 'Creatify AI sync',
    requiresImage: true,
    requiresAudio: true,
    imageField: 'image_url',
    audioField: 'audio_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      audio_url: { type: 'text', label: 'Audio URL' },
    },
  },
  {
    id: 'veed-lipsync',
    name: 'VEED Lipsync',
    endpoint: 'veed-lipsync',
    category: 'lipsync',
    description: 'VEED AI sync',
    requiresImage: true,
    requiresAudio: true,
    imageField: 'image_url',
    audioField: 'audio_url',
    inputs: {
      image_url: { type: 'text', label: 'Image URL' },
      audio_url: { type: 'text', label: 'Audio URL' },
    },
  },
  {
    id: 'infinitetalk-video-to-video',
    name: 'InfiniteTalk V2V',
    endpoint: 'infinitetalk-video-to-video',
    category: 'lipsync',
    description: 'Video to video sync',
    requiresVideo: true,
    requiresAudio: true,
    videoField: 'video_url',
    audioField: 'audio_url',
    inputs: {
      video_url: { type: 'text', label: 'Video URL' },
      audio_url: { type: 'text', label: 'Audio URL' },
    },
  },
];

/* -------------------------------------------------------------------------- */
/*  Aggregated Exports                                                        */
/* -------------------------------------------------------------------------- */

export const allModels: StudioModel[] = [
  ...t2iModels,
  ...i2iModels,
  ...t2vModels,
  ...i2vModels,
  ...lipsyncModels,
  ...toolModels,
];

export function getModelsByCategory(category: StudioModel['category']): StudioModel[] {
  return allModels.filter((m) => m.category === category);
}
