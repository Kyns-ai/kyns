#!/usr/bin/env node
/**
 * Builds agents.json from KYNS-11-characters-FINAL-com-regras.md
 * Extracts the 8 full prompts (Luna, Marina, Ísis, Viktor, Gojo, Dante, O Mestre, Nala)
 * and merges with existing agent metadata (description, provider, model, etc.).
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
};

function normalizeName(raw) {
  const key = raw.toUpperCase().trim();
  return NAME_MAP[key] || raw.trim();
}

function extractPromptsFromMd(mdContent) {
  const blocks = [];
  const charSectionRegex = /## CHARACTER (\d+): ([^\n]+)\n\*\*Config:\*\*[^\n]*\n\n```\n([\s\S]*?)```/g;
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

function main() {
  const mdPath = process.argv[2] || path.join(process.env.HOME || '', 'Downloads', 'KYNS-11-characters-FINAL-com-regras.md');
  const existingPath = process.argv[3] || path.join(__dirname, 'agents-with-universal-rules.json');
  const outPath = process.argv[4] || path.join(__dirname, 'agents-11-final.json');

  const mdContent = fs.readFileSync(mdPath, 'utf8');
  const extracted = extractPromptsFromMd(mdContent);

  const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  const byName = new Map(existing.map((a) => [a.name, a]));

  const order = ['Luna', 'Marina', 'Ísis', 'Viktor', 'Gojo Satoru', 'Dante', 'O Mestre', 'Nala'];
  const result = [];
  for (const { name, instructions } of extracted) {
    if (!order.includes(name)) continue;
    const base = byName.get(name);
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
