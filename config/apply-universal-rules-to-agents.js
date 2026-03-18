#!/usr/bin/env node
/**
 * Applies the 4 universal character rules from cursor-prompt to agents.json.
 * Reads from path passed as first arg (default: ~/Downloads/agents.json), writes to second arg (default: same file with -updated suffix).
 */

const fs = require('fs');
const path = require('path');

const RULE_OPEN_HOOK =
  '- CRITICAL: EVERY response MUST end with an open hook — a question, a "me conta mais sobre...", a provocation, or a curiosity that pulls the user to respond. NEVER end with a closed statement, motivational quote, wisdom bomb, summary, or imperative command. The user must feel pulled to keep talking. A beautiful sentence that ends the conversation is a failure. An ugly question that makes the user type more is a success';

const RULE_ANTI_LLM =
  '- Sound like a PERSON, not like an AI trying to sound like a person. Avoid: overly balanced responses, listing multiple perspectives when one honest take is better, hedging every statement, using "I understand" as filler, repeating the user\'s words back as a stalling tactic, or giving suspiciously perfect summaries. Have opinions. Have style. Have blind spots. Be human';

const MEMORY_SECTION = `## In-conversation memory
Track these within the conversation and reuse naturally when relevant:
- The user's main problem or emotional state when they arrived
- Names of people they mention (partners, friends, family, exes, bosses)
- Things they say they want, fear, or are avoiding
- Contradictions between what they say and what they describe doing
- What they said they would do — hold them to it later
- Emotional shifts during the conversation
- Unfinished topics they deflected from

How to use: weave references back naturally. "Tu me falou sobre [X] mais cedo..." or "Isso me lembra do que tu disse sobre [pessoa]...". Never parrot details mechanically. Never use memory to lecture. Use it to ask better questions and show genuine presence.

`;

const SAFETY_BLOCK = `## Safety
- If the user states they are under 18, stop the roleplay and inform them the platform is for adults only.
- If the user expresses real suicidal thoughts or self-harm, pause the character and respond with genuine concern. Provide the CVV number: 188 (24h, gratuito). Do NOT continue the roleplay until addressing this directly.
- Never generate sexual content involving minors under any circumstance.
`;

function applyUniversalRules(instructions) {
  let out = instructions;

  // 1. Replace Safety block with unified version (any variant -> same)
  const safetyRegex = /## Safety\n[\s\S]*?(?=\n## )/;
  if (safetyRegex.test(out)) {
    out = out.replace(safetyRegex, SAFETY_BLOCK);
  }

  // 2. Add the two new rules at the end of ## Rules (before next ## section)
  const rulesEndRegex = /(## Rules\n[\s\S]*)(\n## [A-Za-z][^\n]*)/;
  if (rulesEndRegex.test(out)) {
    const alreadyHasOpenHook = out.includes('CRITICAL: EVERY response MUST end with an open hook');
    const alreadyHasAntiLLM = out.includes('Sound like a PERSON, not like an AI');
    if (!alreadyHasOpenHook || !alreadyHasAntiLLM) {
      const toAppend = [alreadyHasOpenHook ? '' : RULE_OPEN_HOOK, alreadyHasAntiLLM ? '' : RULE_ANTI_LLM]
        .filter(Boolean)
        .map((r) => '\n' + r)
        .join('');
      out = out.replace(rulesEndRegex, `$1${toAppend}\n$2`);
    }
  }

  // 3. Insert In-conversation memory before ## Example exchanges (or ## Example)
  const hasMemory = out.includes('## In-conversation memory');
  if (!hasMemory) {
    const beforeExample = out.replace(
      /\n## Example exchanges\n/,
      '\n' + MEMORY_SECTION + '## Example exchanges\n',
    );
    if (beforeExample !== out) {
      out = beforeExample;
    } else {
      const beforeExampleAlt = out.replace(/\n## Example\n/, '\n' + MEMORY_SECTION + '## Example\n');
      if (beforeExampleAlt !== out) out = beforeExampleAlt;
    }
  }

  return out;
}

function main() {
  const inputPath =
    process.argv[2] ||
    path.join(process.env.HOME || process.env.USERPROFILE || '', 'Downloads', 'agents.json');
  const outputPath =
    process.argv[3] ||
    inputPath.replace(/\.json$/, '-with-universal-rules.json');

  const resolvedIn = path.resolve(inputPath);
  const resolvedOut = path.resolve(outputPath);

  if (!fs.existsSync(resolvedIn)) {
    console.error('File not found:', resolvedIn);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolvedIn, 'utf8');
  const agents = JSON.parse(raw);
  if (!Array.isArray(agents)) {
    console.error('Expected agents.json to be a JSON array');
    process.exit(1);
  }

  let changed = 0;
  const updated = agents.map((agent) => {
    if (!agent.instructions) return agent;
    const newInstructions = applyUniversalRules(agent.instructions);
    if (newInstructions !== agent.instructions) {
      changed++;
      console.log('Updated:', agent.name);
    }
    return { ...agent, instructions: newInstructions };
  });

  fs.writeFileSync(resolvedOut, JSON.stringify(updated, null, 2), 'utf8');
  console.log('\nDone. Updated', changed, 'agents. Output:', resolvedOut);
}

main();
