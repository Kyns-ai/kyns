#!/usr/bin/env node
/**
 * Builds agents.json from KYNS-11-characters-FINAL-com-regras.md (or -2.md with Cael).
 * Extracts full prompts (1-7, 10, and 11 Cael when present) and merges with existing agent metadata.
 *
 * Usage: node build-agents-from-final-md.js <path-to-md> <path-to-existing-json> [output-path]
 */

const fs = require('fs');
const path = require('path');

const NAME_MAP = {
  LUNA: 'Luna',
  MARINA: 'Marina',
  ÍSIS: 'Ísis',
  ISIS: 'Ísis',
  VIKTOR: 'Viktor',
  'GOJO SATORU': 'Gojo Satoru',
  DANTE: 'Dante',
  'O MESTRE': 'O Mestre',
  NALA: 'Nala',
  CAEL: 'Cael',
  'CAEL (CHARACTER PRINCIPAL)': 'Cael',
};

function normalizeName(raw) {
  const key = raw.toUpperCase().trim();
  return NAME_MAP[key] || raw.trim();
}

function extractPromptsFromMd(mdContent) {
  const blocks = [];
  const charSectionRegex =
    /## CHARACTER (\d+): ([^\n]+)\n\*\*Config:\*\*[^\n]*\n(?:\*\*Description:\*\*[^\n]*\n)?\n```\n([\s\S]*?)```/g;
  let m;
  while ((m = charSectionRegex.exec(mdContent)) !== null) {
    const num = parseInt(m[1], 10);
    const nameRaw = m[2].trim();
    const instructions = m[3].trim().replace(/\r\n/g, '\n');
    const name = normalizeName(nameRaw);
    blocks.push({ num, name, instructions });
  }
  return blocks;
}

const DEFAULT_CAEL = {
  name: 'Cael',
  description:
    'Um aliado masculino lúcido e confiável. Direto, calmo e firme. Feito pra te ajudar a sair da confusão, controlar a emoção e agir com mais clareza.',
  category: 'general',
  provider: 'openAI',
  model: 'Olafangensan/GLM-4.7-Flash-heretic',
  model_parameters: {
    temperature: 0.7,
    top_p: 0.9,
    max_tokens: 500,
    maxContextTokens: 8192,
    frequency_penalty: 0.1,
    presence_penalty: 0.1,
  },
};

function main() {
  const mdPath = process.argv[2] || path.join(process.env.HOME || '', 'Downloads', 'KYNS-11-characters-FINAL-com-regras.md');
  const existingPath = process.argv[3] || path.join(__dirname, 'agents-with-universal-rules.json');
  const outPath = process.argv[4] || path.join(__dirname, 'agents-11-final.json');

  const mdContent = fs.readFileSync(mdPath, 'utf8');
  const extracted = extractPromptsFromMd(mdContent);

  const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  const byName = new Map(existing.map((a) => [a.name, a]));

  const order = [
    'Luna',
    'Marina',
    'Ísis',
    'Viktor',
    'Gojo Satoru',
    'Dante',
    'O Mestre',
    'Nala',
    'Cael',
  ];
  const result = [];
  for (const { name, instructions } of extracted) {
    if (!order.includes(name)) continue;
    const base = byName.get(name) || (name === 'Cael' ? DEFAULT_CAEL : null);
    if (!base) {
      console.warn('No base agent for:', name);
      continue;
    }
    result.push({
      ...base,
      instructions,
    });
  }

  result.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
  console.log('Wrote', result.length, 'agents to', outPath);
}

main();
