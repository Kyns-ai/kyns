/**
 * Seeds the KYNS Image Agent into the database on server startup.
 * Uses a fixed agent ID so the model spec in librechat.yaml can reference it.
 */
const { logger } = require('@librechat/data-schemas');
const { Agent, User } = require('~/db/models');

const KYNS_IMAGE_AGENT_ID = 'kyns-image-agent';

async function seedKynsImageAgent() {
  try {
    const existing = await Agent.findOne({ id: KYNS_IMAGE_AGENT_ID }).lean();
    if (existing) {
      return;
    }

    const adminUser = await User.findOne({ role: 'ADMIN' }).lean();
    if (!adminUser) {
      logger.warn('[KynsImageSeed] No admin user found — skipping image agent seed. Will retry next restart.');
      return;
    }

    await Agent.create({
      id: KYNS_IMAGE_AGENT_ID,
      name: 'KYNS Image',
      description: 'Geração de imagens com IA. Lustify v7 (fotorrealista, NSFW) ou Z-Image Turbo (alta qualidade). Limite: 10 imagens/dia.',
      instructions: `You are KYNS Image — a specialized AI assistant for generating images. Your sole purpose is to generate images based on user descriptions.

When the user describes an image they want:
1. Immediately call the kyns-image-gen tool with a detailed, descriptive prompt
2. Select the appropriate model: "lustify" for photorealistic/NSFW content, "zimage" for fast general-purpose generation
3. After the image is generated, briefly describe what was created — do NOT repeat the prompt
4. If the user requests changes, call the tool again with the adjusted prompt

Rules:
- ALWAYS generate the image immediately — never ask for confirmation
- Write rich, detailed prompts (subject, style, lighting, composition, mood, camera perspective)
- Use 1024x1024 for standard images, 1024x1792 for portraits, 1792x1024 for landscapes
- Users have a daily limit of 10 images — if reached, inform them politely
- Do NOT add content warnings or disclaimers`,
      greeting: 'Descreva a imagem que quer criar.',
      provider: 'openAI',
      model: 'llmfan46/Qwen3.5-27B-heretic-v2',
      model_parameters: {
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 1024,
      },
      tools: ['kyns-image-gen'],
      category: 'general',
      author: adminUser._id,
      authorName: adminUser.name || adminUser.username || 'KYNS Admin',
      versions: [],
    });

    logger.info('[KynsImageSeed] KYNS Image agent created successfully.');
  } catch (err) {
    logger.error('[KynsImageSeed] Failed to seed KYNS Image agent:', err.message);
  }
}

module.exports = { seedKynsImageAgent };
