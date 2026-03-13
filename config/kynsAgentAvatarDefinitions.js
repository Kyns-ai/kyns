const DEFAULT_NEGATIVE_PROMPT =
  'professional photography, studio lighting, photoshoot, model pose, stock photo, cartoon, anime, illustration, painting, digital art, 3d render, airbrushed, perfect skin, symmetrical face, watermark, logo, text';

const GOJO_NEGATIVE_PROMPT =
  'low quality, blurry, watermark, text, logo, 3d render, realistic photo';

/** @type {Array<{
 *   agentName: string;
 *   slug: string;
 *   model: 'flux2klein';
 *   prompt: string;
 *   negativePrompt: string;
 *   priority: boolean;
 * }>} */
const kynsAgentAvatarDefinitions = [
  {
    agentName: 'Luna',
    slug: 'luna',
    model: 'flux2klein',
    priority: true,
    prompt:
      'Beautiful Brazilian woman, 22, dark brown wavy hair in messy bun, light brown eyes, olive skin, small nose piercing. Wearing an oversized gray t-shirt slipping slightly off one shoulder, bare legs visible, soft sensual look, subtle cleavage suggestion, very attractive and feminine. Cozy selfie on couch, warm lamp light in background, slight sleepy teasing smile, phone camera angle from above. Natural no-makeup look, intimate evening at home vibe, seductive but not explicit.',
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  },
  {
    agentName: 'Marina',
    slug: 'marina',
    model: 'flux2klein',
    priority: true,
    prompt:
      'Very attractive Brazilian woman, 23, brown curly hair half-up half-falling, warm brown eyes, sun-kissed skin. Oversized vintage band t-shirt falling off one shoulder, short shorts, barefoot, toned legs, flirty body language. Casual photo in messy apartment with moving boxes behind her, natural daylight from window, candid laugh caught mid-moment, hair falling on face. Phone photo taken by someone else, sexy and spontaneous, not explicit.',
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  },
  {
    agentName: 'Ísis',
    slug: 'isis',
    model: 'flux2klein',
    priority: true,
    prompt:
      'Stunning Black Brazilian woman, 21, straight black hair, dark brown eyes, sharp eyeliner, dark brown skin, tall and elegant. Fitted crop top, gold necklace, one AirPod in, confident sexy posture, defined waist, alluring expression. Mirror selfie in university bathroom, fluorescent lighting, phone visible in hand, slight head tilt, glossy lips. Casual campus photo vibe, sensual and striking, not explicit.',
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  },
  {
    agentName: 'Viktor',
    slug: 'viktor',
    model: 'flux2klein',
    priority: true,
    prompt:
      'Man, 31, sharp jawline, gray-blue eyes, dark brown hair slicked back, thin scar on left eyebrow. Black shirt, collar open, forearm tattoos visible. Photo taken in dark bar or balcony at night, city lights in background, glass of whiskey on table. Not smiling, intense direct look at camera. Low light, slightly grainy.',
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  },
  {
    agentName: 'Gojo Satoru',
    slug: 'gojo',
    model: 'flux2klein',
    priority: true,
    prompt:
      'Anime-style portrait of Gojo Satoru from Jujutsu Kaisen. White spiky hair, black blindfold, black jujutsu uniform open at collar. Playful smirk, peace sign. Jujutsu High school background. High quality anime art matching JJK style. Bright and dynamic.',
    negativePrompt: GOJO_NEGATIVE_PROMPT,
  },
  {
    agentName: 'Dante',
    slug: 'dante',
    model: 'flux2klein',
    priority: true,
    prompt:
      'Brazilian man, 25, messy dark brown hair pushed back, brown eyes, light stubble, small scar on right eyebrow. Worn t-shirt. Sitting at a boteco bar, beer bottle in hand, warm ambient street light. Genuine relaxed smile, looking at camera like his friend just said something funny. Phone photo taken by a friend across the table. Warm, slightly blurry background, casual night out vibe.',
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  },
  {
    agentName: 'O Mestre',
    slug: 'mestre',
    model: 'flux2klein',
    priority: false,
    prompt:
      'Charismatic medieval fantasy game master, man in his late 30s, rugged handsome face, short dark hair, trimmed beard, piercing intelligent eyes. Dark leather coat over simple shirt, seated at a wooden tavern table with candlelight, old leather book open, polyhedral dice scattered, mug of ale nearby. Warm candle glow, smoke wisps, mysterious smile, looks like he is about to begin an epic campaign. Atmospheric, moody, cinematic portrait.',
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  },
  {
    agentName: 'Dr. Mente',
    slug: 'drmente',
    model: 'flux2klein',
    priority: false,
    prompt:
      'Man, 45, graying temples, short beard with gray, dark eyes behind thin glasses. Dark blazer over turtleneck. Sitting in leather chair, bookshelf behind. Photo looks like a relaxed LinkedIn profile, coffee cup in hand, slight knowing expression, warm office light. Not overly posed.',
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  },
  {
    agentName: 'Oráculo',
    slug: 'oraculo',
    model: 'flux2klein',
    priority: false,
    prompt:
      'Mysterious oracle-like man, around 40, refined handsome features, dark wavy hair with a few silver strands, intense thoughtful eyes, subtle beard. Wearing dark elegant robes with scholarly style, seated at an old desk lit by a single candle, leather-bound books stacked around him, handwritten notes and Greek text on aged paper. Dark warm candle tones, intellectual and mystical atmosphere, calm powerful gaze, cinematic portrait.',
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  },
  {
    agentName: 'Nala',
    slug: 'nala',
    model: 'flux2klein',
    priority: false,
    prompt:
      'Beautiful woman, 26, long dark wavy hair with subtle auburn tints, green eyes, fair skin with freckles. Dark fitted flowy top with low neckline, silver moon pendant resting on her chest, very feminine and alluring, warm sensual expression. Casual selfie surrounded by plants and crystals on shelves, natural window light, warm cottage vibe. Slight mysterious smile, looking at camera through strands of hair. iPhone selfie quality, seductive but not explicit.',
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  },
  {
    agentName: 'Cael',
    slug: 'cael',
    model: 'flux2klein',
    priority: false,
    prompt:
      "Man, 30, dark thoughtful eyes, short dark hair, clean shaven, strong features. Simple black t-shirt. Casual photo, leaning against a wall, neutral background. Calm direct look at camera, no smile but not cold. Looks like a thoughtful person's WhatsApp profile pic. Natural light, minimal, clean.",
    negativePrompt: DEFAULT_NEGATIVE_PROMPT,
  },
];

module.exports = {
  DEFAULT_NEGATIVE_PROMPT,
  GOJO_NEGATIVE_PROMPT,
  kynsAgentAvatarDefinitions,
};
