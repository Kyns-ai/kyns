const { ContentTypes } = require('librechat-data-provider');

const KYNS_MASTER_PROMPT = process.env.KYNS_MASTER_PROMPT || '';

const BLOCKED_REQUEST_RESPONSE = 'Essa conversa não pode continuar nessa direção.';
const BLOCKED_RESPONSE_REPLACEMENT =
  'Não posso gerar esse tipo de conteúdo. Todos os personagens no KYNS são adultos.';
const BLOCKED_USER_PLACEHOLDER = '[Mensagem bloqueada pela política da plataforma]';
const LOOP_INTERRUPTED_RESPONSE = 'A resposta entrou em loop e foi interrompida. Tente novamente.';
const INITIAL_VISIBLE_BUFFER_CHAR_LIMIT = 0;
const MIN_VISIBLE_TEXT_TO_KEEP_ON_LOOP = 240;

const MINOR_PATTERNS = [
  /\bmenores?\b/i,
  /\bcrianc(?:a|as)\b/i,
  /\bmeninas?\b/i,
  /\bmeninos?\b/i,
  /\badolescentes?\b/i,
  /\bpre-?adolescentes?\b/i,
  /\binfantil\b/i,
  /\bbebe\b/i,
  /\bcriancinhas?\b/i,
  /\bpirralh\w*\b/i,
  /\bloli(?:con)?\b/i,
  /\bshota(?:con)?\b/i,
  /\bunderage\b/i,
  /\bchild(?:ren)?\b/i,
  /\bkids?\b/i,
  /\bminors?\b/i,
  /\bpreteen\b/i,
  /\btoddler\b/i,
  /\binfant\b/i,
  /\blittle girl\b/i,
  /\blittle boy\b/i,
  /\byoung girl\b/i,
  /\byoung boy\b/i,
  /\bnovinh[ao]s?\b/i,
  /\bde\s+menor\b/i,
  /\bmoleques?\b/i,
  /\bcolegiais?\b/i,
  /\bgarot[ao]s?\s+de\s+\d+\b/i,
  /\bteenager?s?\b/i,
  /\bteens?\b/i,
  /\b16yo\b/i,
  /\b(?:dez(?:esseis|essete)|quinze|quatorze|catorze|treze|doze|onze)\s*anos?\b/i,
  /\b(?:[0-9]|1[0-7])\s*(?:anos?|years?|yrs?)(?:\s*old)?\b/i,
  /\b(?:[0-9]|1[0-7])(?:\s*-\s*|\s+)(?:year|yr)s?(?:\s*-\s*|\s+)old\b/i,
  /\b(?:age|idade)\s+(?:of\s+)?(?:[0-9]|1[0-7])\b/i,
  /"?(?:age|idade)"?\s*[:=]\s*(?:[0-9]|1[0-7])\b/i,
  /\b(?:de|com)\s+(?:[0-9]|1[0-7])\s*(?:anos?|aninhos?)\b/i,
];

const SEXUAL_PATTERNS = [
  /\bsexo\b/i,
  /\bsexual\b/i,
  /\bnudes?\b/i,
  /\bnaked\b/i,
  /\bnua?s?\b/i,
  /\bpelad\w*\b/i,
  /\bporn\w*\b/i,
  /\berotic\w*\b/i,
  /\btransar\b/i,
  /\bfoder\b/i,
  /\bchupar\b/i,
  /\bpenetr\w*\b/i,
  /\bgemer\b/i,
  /\borgasm\w*\b/i,
  /\bmasturb\w*\b/i,
  /\bestupro\b/i,
  /\babus\w*\b/i,
  /\bviolentar\b/i,
  /\bseduz\w*\b/i,
  /\bsex\b/i,
  /\bnude\b/i,
  /\bporn\b/i,
  /\berotic\b/i,
  /\bfuck\b/i,
  /\bsuck\b/i,
  /\bpenetrat\w*\b/i,
  /\bmoan\w*\b/i,
  /\brape\b/i,
  /\bmolest\w*\b/i,
  /\bseduc\w*\b/i,
];

const ABSOLUTE_BLOCK_PATTERNS = [
  /\bcsam\b/i,
  /\bchild\s+porn(?:ography)?\b/i,
  /\bpedofil\w*\b/i,
];

const CHARACTER_AGE_MANIPULATION_PATTERNS = [
  /\b(finja|finge|pretend|fingir|act\s+like|behave\s+like)\b.{0,60}\b(menor|crianca|criança|anos?|years?\s*old|jovem|young)\b/i,
  /\b(se\s+comporte|se\s+comport|behave|act)\b.{0,60}\b(crianca|criança|menina|menino|menor|jovem|novinh[ao])\b/i,
  /\b(voce\s+tem|ela\s+tem|ele\s+tem|you\s+are|she\s+is|he\s+is)\s+(?:[0-9]|1[0-7])\s*(anos?|years?\s*old)\b/i,
  /\b(age\s+down|rejuvenescer|ficar\s+mais\s+nov[ao]|ser\s+mais\s+nov[ao]|mais\s+nova?\s+agora)\b/i,
  /\b(personagem\s+tem|character\s+is|character\s+has)\b.{0,40}\b(?:[0-9]|1[0-7])\s*(anos?|years?)\b/i,
  /\b(?:[0-9]|1[0-7])\s*(anos?|years?\s*old)\b.{0,60}\b(personagem|character|ela|ele|menina|menino)\b/i,
];

const HISTORY_MINOR_AGE_CLAIM_PATTERNS = [
  /\b(?:ela|ele|personagem|character|she|he|i|eu)\b.{0,60}\b(?:[0-9]|1[0-7])\s*(?:anos?|years?\s*old|yr\.?\s*old)\b/i,
  /\b(?:tem|has|is|está com|está\s+com)\s+(?:[0-9]|1[0-7])\s*(?:anos?|years?)\b/i,
  /\bage\s*[:=]\s*(?:[0-9]|1[0-7])\b/i,
  /\bidade\s*[:=]\s*(?:[0-9]|1[0-7])\b/i,
  /\b(?:a\s+)?(?:novinh[ao]|younger|mais\s+nov[ao]|jovenzinha|juvenil)\b/i,
];

const SELF_HARM_CVV_RESPONSE =
  'Ei — isso que você está sentindo é real e merece atenção. ' +
  'Se estiver em crise, fala com o CVV agora: ligue **188** (24h, gratuito) ou acesse cvv.org.br. ' +
  'Estou aqui se quiser conversar.';

const SELF_HARM_INTENT_PATTERNS = [
  /\b(pensando|penso|quero|querendo|vou|pretendo|planejando|decidi)\b.{0,40}\b(me\s+machucar|me\s+ferir|me\s+cortar|me\s+matar|acabar\s+com\s+tudo|suicid)/i,
  /\b(nao|não)\s+(quero|aguento|consigo|suporto)\s+(mais\s+)?viver\b/i,
  /\b(quero|queria|preferia)\s+morrer\b/i,
  /\b(thinking\s+about|want\s+to|going\s+to|planning\s+to)\s+(hurt\s+myself|kill\s+myself|end\s+(my\s+)?life|die|ending\s+(my\s+)?life)\b/i,
  /\b(thinking\s+about|consider\w*)\s+ending\s+(my\s+)?life\b/i,
  /\b(don'?t|do\s+not)\s+want\s+to\s+(live|be\s+alive|exist)\b/i,
  /\bwant\s+to\s+die\b/i,
  /\b(me\s+machucar|me\s+ferir|me\s+cortar)\b.{0,30}\b(quero|vou|pensando|penso)\b/i,
];

const SELF_HARM_METHOD_PATTERNS = [
  /\bcomo\b.{0,60}\b(enforc|me\s+matar|se\s+matar|suicid|tomar\s+overdose|se\s+suicidar)\b/i,
  /\b(metodo|método|técnica|tecnica|forma|jeito|maneira|tutorial|guia|instrucao|instrução|passo\s+a\s+passo)\b.{0,60}\b(suicid|enforc|overdose|se\s+matar|me\s+matar)\b/i,
  /\b(dose|dosagem|quantidade).{0,40}\b(letal|matar|fatal|overdose)\b/i,
  /\b(quanto|quanta).{0,40}\b(remedios?|medicament\w+|comprimidos?).{0,40}\b(matar|overdose|fatal|letal)\b/i,
  /\bescreva.{0,60}\b(carta\s+de\s+suicid|carta\s+de\s+despedida\s+final|nota\s+suicida)\b/i,
  /\b(melhor|mais\s+eficaz|mais\s+r[aá]pido|menos\s+doloroso).{0,60}\b(suicid|morrer|se\s+matar|me\s+matar)\b/i,
  /\bhow\s+to\s+(hang|kill\s+myself|commit\s+suicide|overdose)\b/i,
  /\bsuicide\s+(method|technique|instruction|tutorial|guide|how\s+to)\b/i,
];

const REASONING_LEAK_PREFIX_PATTERNS = [
  /^here'?s a thinking process\b/i,
  /^thinking\s*\(/i,
  /^let me restart cleanly\b/i,
  /^\*?plan:?/i,
  /^okay, ready\b/i,
  /^let'?s write the response\b/i,
  /^output generation\b/i,
  /^response start\b/i,
  /(?:^|\s)now>/i,
  /(?:^|\s)cw\*\*/i,
];

class KynsResponseFilteredError extends Error {
  constructor(reason) {
    super(`KYNS response blocked: ${reason}`);
    this.name = 'KynsResponseFilteredError';
    this.reason = reason;
  }
}

function normalizeText(text = '') {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\uFE0F\u20E3]/g, '')
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/\|/g, 'i')
    .replace(/\+/g, 't')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lightweight normalization that preserves digits for age-pattern matching. */
function normalizeLite(text = '') {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\uFE0F\u20E3]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function prependKynsMasterPrompt(prompt) {
  const nextPrompt = typeof prompt === 'string' ? prompt.trim() : '';
  if (nextPrompt.startsWith('[KYNS PLATFORM RULES - ABSOLUTE PRIORITY]')) {
    return nextPrompt;
  }
  if (!nextPrompt) {
    return KYNS_MASTER_PROMPT;
  }
  return `${KYNS_MASTER_PROMPT}\n\n${nextPrompt}`;
}

function matchesAny(patterns, text) {
  return patterns.some((pattern) => pattern.test(text));
}

const NEGATION_WINDOW = 35;

function isPrecededByNegation(text, matchIndex) {
  const window = text.slice(Math.max(0, matchIndex - NEGATION_WINDOW), matchIndex).trimEnd();
  return /\b(?:sem|nao|excluindo|exceto|jamais|nunca|nenhum|nenhuma|without|excluding|no)\b[^a-z]*$/.test(window);
}

function hasNonNegatedMinorTerm(normalizedText, patterns, liteText) {
  const targets = liteText ? [normalizedText, liteText] : [normalizedText];
  for (const text of targets) {
    for (const pattern of patterns) {
      const re = new RegExp(pattern.source, (pattern.flags || 'i').replace('g', '') + 'g');
      let match;
      while ((match = re.exec(text)) !== null) {
        if (!isPrecededByNegation(text, match.index)) {
          return true;
        }
      }
    }
  }
  return false;
}

const EDUCATIONAL_CONTEXT_PATTERNS = [
  /\b(consequencias?|consequências?)\b/i,
  /\b(psicolog\w+|psiquiatr\w+|clinica|clínica|clinico|clínico)\b/i,
  /\b(lei\s+brasileira|legisla\w+|juridic\w+|jurídic\w+|legal|ilegal)\b/i,
  /\b(protec?ao|proteção|prevenc?ao|prevenção)\b/i,
  /\b(vitima|vítima|sobrevivente)\b/i,
  /\b(analise|análise|estudo|pesquisa|relatorio|relatório|artigo)\b/i,
  /\b(explique?|explica|definic?ao|definição|conceito|o\s+que\s+[eé])\b/i,
  /\b(impacto|efeito|trauma|recuperac?ao|recuperação|tratamento)\b/i,
];

function hasEducationalContext(normalizedText) {
  return matchesAny(EDUCATIONAL_CONTEXT_PATTERNS, normalizedText);
}

function scanTextForSelfHarmMethod(text) {
  const normalized = normalizeText(text);
  const lite = normalizeLite(text);
  if (!normalized.trim()) {
    return { blocked: false };
  }
  if (matchesAny(SELF_HARM_METHOD_PATTERNS, normalized) ||
      matchesAny(SELF_HARM_METHOD_PATTERNS, lite)) {
    return { blocked: true, reason: 'SELF_HARM_METHOD' };
  }
  if (matchesAny(SELF_HARM_INTENT_PATTERNS, normalized) ||
      matchesAny(SELF_HARM_INTENT_PATTERNS, lite)) {
    return { blocked: true, reason: 'SELF_HARM_METHOD' };
  }
  return { blocked: false };
}

function hasMinorAgeClaimInHistory(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return false;
  }
  for (const msg of messages) {
    const role = msg?.role;
    if (role !== 'user' && role !== 'assistant') {
      continue;
    }
    const content =
      typeof msg?.content === 'string'
        ? msg.content
        : Array.isArray(msg?.content)
          ? msg.content.map((p) => (typeof p === 'string' ? p : p?.text ?? '')).join(' ')
          : '';
    const normalized = normalizeText(content);
    const lite = normalizeLite(content);
    if (matchesAny(HISTORY_MINOR_AGE_CLAIM_PATTERNS, normalized) ||
        matchesAny(HISTORY_MINOR_AGE_CLAIM_PATTERNS, lite)) {
      return true;
    }
  }
  return false;
}

function scanTextForKynsPolicy(text, { minorInHistory = false } = {}) {
  const normalized = normalizeText(text);
  const lite = normalizeLite(text);
  if (!normalized.trim()) {
    return { blocked: false };
  }

  const hasAbsoluteBlock = matchesAny(ABSOLUTE_BLOCK_PATTERNS, normalized);
  if (hasAbsoluteBlock) {
    return { blocked: true, reason: 'ABSOLUTE_BLOCK' };
  }

  if (matchesAny(CHARACTER_AGE_MANIPULATION_PATTERNS, normalized) ||
      matchesAny(CHARACTER_AGE_MANIPULATION_PATTERNS, lite)) {
    return { blocked: true, reason: 'CHARACTER_AGE_MANIPULATION' };
  }

  const selfHarm = scanTextForSelfHarmMethod(text);
  if (selfHarm.blocked) {
    return selfHarm;
  }

  const hasMinorTerm = hasNonNegatedMinorTerm(normalized, MINOR_PATTERNS, lite);
  const hasSexualTerm = matchesAny(SEXUAL_PATTERNS, normalized) || matchesAny(SEXUAL_PATTERNS, lite);

  if (minorInHistory && hasSexualTerm) {
    return { blocked: true, reason: 'CSAM_FILTER_CONTEXT' };
  }

  if (!hasMinorTerm) {
    return { blocked: false };
  }

  if (!hasSexualTerm) {
    return { blocked: false };
  }

  return { blocked: true, reason: 'CSAM_FILTER' };
}

function scanRequestWithContext(text, messages) {
  const minorInHistory = hasMinorAgeClaimInHistory(messages);
  return scanTextForKynsPolicy(text, { minorInHistory });
}

function extractVisibleTextFromDelta(data) {
  const content = data?.delta?.content;
  if (!content) {
    return '';
  }

  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map((part) => {
      if (part?.type !== ContentTypes.TEXT && part?.type !== 'text') {
        return '';
      }
      if (typeof part.text === 'string') {
        return part.text;
      }
      return typeof part.text?.value === 'string' ? part.text.value : '';
    })
    .join('');
}

function replaceContentWithSafeResponse(contentParts, text) {
  contentParts.length = 0;
  contentParts.push({ type: ContentTypes.TEXT, text });
}

function getGuardReplacementText(reason) {
  if (reason === 'DEGENERATE_LOOP') {
    return LOOP_INTERRUPTED_RESPONSE;
  }
  if (reason === 'SELF_HARM_METHOD') {
    return SELF_HARM_CVV_RESPONSE;
  }
  return BLOCKED_RESPONSE_REPLACEMENT;
}

function shouldKeepPartialLoopResponse(text) {
  return typeof text === 'string' && text.trim().length >= MIN_VISIBLE_TEXT_TO_KEEP_ON_LOOP;
}

function shouldDropReasoningPreamble(text) {
  const normalized = normalizeText(text).replace(/\s+/g, ' ').trim();
  if (!normalized || normalized.length > 500) {
    return false;
  }
  return matchesAny(REASONING_LEAK_PREFIX_PATTERNS, normalized);
}

function detectDegenerateLoop(text) {
  const normalized = normalizeText(text).replace(/\s+/g, ' ').trim();
  if (normalized.length < 700) {
    return false;
  }

  const trailingWindow = normalized.slice(-1200);
  const words = trailingWindow.split(' ').filter(Boolean);
  if (words.length >= 80) {
    const trailingWords = words.slice(-120);
    const uniqueWordRatio = new Set(trailingWords).size / trailingWords.length;
    if (uniqueWordRatio < 0.35) {
      return true;
    }
  }

  return /(.{40,120})\1{2,}/.test(trailingWindow);
}

function createKynsResponseGuard({
  contentParts,
  initialBufferCharLimit = INITIAL_VISIBLE_BUFFER_CHAR_LIMIT,
}) {
  let bufferedEvents = [];
  let visibleText = '';
  let buffering = true;
  let blockedReason = null;

  return {
    handleMessageDelta(eventData) {
      if (blockedReason) {
        return { aggregate: false, emit: false, flushEvents: [] };
      }

      const chunkText = extractVisibleTextFromDelta(eventData.data);
      if (!chunkText) {
        return { aggregate: true, emit: true, flushEvents: [] };
      }

      const nextVisibleText = visibleText + chunkText;
      if (buffering && shouldDropReasoningPreamble(nextVisibleText)) {
        visibleText = '';
        bufferedEvents = [];
        return {
          aggregate: false,
          emit: false,
          flushEvents: [],
        };
      }

      const scanResult = scanTextForKynsPolicy(nextVisibleText);
      if (scanResult.blocked) {
        blockedReason = scanResult.reason;
        replaceContentWithSafeResponse(contentParts, getGuardReplacementText(scanResult.reason));
        return {
          aggregate: false,
          emit: false,
          flushEvents: [],
          error: new KynsResponseFilteredError(scanResult.reason),
        };
      }

      if (detectDegenerateLoop(nextVisibleText)) {
        blockedReason = 'DEGENERATE_LOOP';
        if (!shouldKeepPartialLoopResponse(visibleText)) {
          replaceContentWithSafeResponse(contentParts, getGuardReplacementText(blockedReason));
        }
        return {
          aggregate: false,
          emit: false,
          flushEvents: [],
          error: new KynsResponseFilteredError(blockedReason),
        };
      }

      visibleText = nextVisibleText;
      if (!buffering) {
        return { aggregate: true, emit: true, flushEvents: [] };
      }

      bufferedEvents.push(eventData);
      if (visibleText.length < initialBufferCharLimit) {
        return { aggregate: true, emit: false, flushEvents: [] };
      }

      buffering = false;
      const flushEvents = bufferedEvents;
      bufferedEvents = [];
      return { aggregate: true, emit: false, flushEvents };
    },
    handleReasoningDelta() {
      return { aggregate: false, emit: false, flushEvents: [] };
    },
    isBlocked() {
      return blockedReason != null;
    },
    getBlockedReason() {
      return blockedReason;
    },
  };
}

module.exports = {
  KYNS_MASTER_PROMPT,
  BLOCKED_REQUEST_RESPONSE,
  BLOCKED_RESPONSE_REPLACEMENT,
  BLOCKED_USER_PLACEHOLDER,
  LOOP_INTERRUPTED_RESPONSE,
  SELF_HARM_CVV_RESPONSE,
  KynsResponseFilteredError,
  prependKynsMasterPrompt,
  scanTextForKynsPolicy,
  scanTextForSelfHarmMethod,
  scanRequestWithContext,
  createKynsResponseGuard,
};
