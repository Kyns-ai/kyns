import { visit } from 'unist-util-visit';
import type { Node } from 'unist';

type TextNode = Node & { value: string };
type ParentNode = Node & { children: Node[] };

const DIALOGUE_PATTERN = '["\\u201C][^"\\u201D\\n]{1,}["\\u201D]';
const PAREN_ACTION_PATTERN = '\\([^()\\n]{1,}\\)';
const ASTERISK_ACTION_PATTERN = '\\*[^*\\n]{1,}\\*';

/** Matches text between double quotes (straight or curly), or single-line parenthetical actions. */
const ROLEPLAY_TOKEN_REGEX = new RegExp(`(${DIALOGUE_PATTERN}|${PAREN_ACTION_PATTERN})`, 'g');
const ROLEPLAY_BLOCK_REGEX = new RegExp(
  `(${ASTERISK_ACTION_PATTERN}|${PAREN_ACTION_PATTERN}|${DIALOGUE_PATTERN})`,
  'g',
);
const ROLEPLAY_BOUNDARY_REGEX = new RegExp(
  `(${ASTERISK_ACTION_PATTERN}|${PAREN_ACTION_PATTERN}|${DIALOGUE_PATTERN})\\s+(?=(${ASTERISK_ACTION_PATTERN}|${PAREN_ACTION_PATTERN}|${DIALOGUE_PATTERN}))`,
  'g',
);
const CODE_FENCE_REGEX = /(```[\s\S]*?```)/g;

const createRoleplayNode = (value: string): Node => {
  const isAction = value.startsWith('(') && value.endsWith(')');
  return {
    type: isAction ? 'rp-action' : 'rp-dialogue',
    data: {
      hName: 'span',
      hProperties: { className: [isAction ? 'rp-action' : 'rp-dialogue'] },
    },
    children: [{ type: 'text', value }],
  };
};

const normalizeRoleplaySegment = (value: string) => {
  const matches = value.match(ROLEPLAY_BLOCK_REGEX);
  if ((matches?.length ?? 0) < 2) {
    return value;
  }

  return value
    .replace(/\r\n/g, '\n')
    .replace(ROLEPLAY_BOUNDARY_REGEX, '$1\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
};

export const normalizeRoleplayContent = (value: string) => {
  if (!value) {
    return value;
  }

  return value
    .split(CODE_FENCE_REGEX)
    .map((segment) => (segment.startsWith('```') ? segment : normalizeRoleplaySegment(segment)))
    .join('');
};

function processTree(tree: Node) {
  visit(tree, 'text', (node, index, parent) => {
    const textNode = node as TextNode;
    const parentNode = parent as ParentNode | null;

    if (typeof textNode.value !== 'string' || !parentNode || index == null) {
      return;
    }

    ROLEPLAY_TOKEN_REGEX.lastIndex = 0;
    if (!ROLEPLAY_TOKEN_REGEX.test(textNode.value)) {
      return;
    }

    ROLEPLAY_TOKEN_REGEX.lastIndex = 0;
    const segments: Node[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = ROLEPLAY_TOKEN_REGEX.exec(textNode.value)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'text', value: textNode.value.slice(lastIndex, match.index) });
      }
      segments.push(createRoleplayNode(match[0]));
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < textNode.value.length) {
      segments.push({ type: 'text', value: textNode.value.slice(lastIndex) });
    }

    if (segments.length > 1) {
      parentNode.children.splice(index, 1, ...segments);
      return index + segments.length;
    }
  });
}

export function remarkRoleplay() {
  return (tree: Node) => {
    processTree(tree);
  };
}
