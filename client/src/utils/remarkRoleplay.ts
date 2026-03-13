import { visit } from 'unist-util-visit';

type RoleplayNode = {
  type: string;
  value?: string;
  data?: {
    hName: string;
    hProperties: {
      className: string[];
    };
  };
  children?: RoleplayNode[];
};

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

const createTextNode = (value: string): RoleplayNode => ({
  type: 'text',
  value,
});

const createRoleplayNode = (value: string): RoleplayNode => {
  const isAction = value.startsWith('(') && value.endsWith(')');
  return {
    type: isAction ? 'rp-action' : 'rp-dialogue',
    data: {
      hName: 'span',
      hProperties: { className: [isAction ? 'rp-action' : 'rp-dialogue'] },
    },
    children: [createTextNode(value)],
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

function processTree(tree: RoleplayNode) {
  visit(tree, 'text', (node, index, parent) => {
    const textNode = node as RoleplayNode;
    const parentNode = parent as RoleplayNode | null;

    if (typeof textNode.value !== 'string' || !parentNode?.children || index == null) {
      return;
    }

    ROLEPLAY_TOKEN_REGEX.lastIndex = 0;
    if (!ROLEPLAY_TOKEN_REGEX.test(textNode.value)) {
      return;
    }

    ROLEPLAY_TOKEN_REGEX.lastIndex = 0;
    const segments: RoleplayNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = ROLEPLAY_TOKEN_REGEX.exec(textNode.value)) !== null) {
      if (match.index > lastIndex) {
        segments.push(createTextNode(textNode.value.slice(lastIndex, match.index)));
      }
      segments.push(createRoleplayNode(match[0]));
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < textNode.value.length) {
      segments.push(createTextNode(textNode.value.slice(lastIndex)));
    }

    if (segments.length > 1) {
      parentNode.children.splice(index, 1, ...segments);
      return index + segments.length;
    }
  });
}

export function remarkRoleplay() {
  return (tree: RoleplayNode) => {
    processTree(tree);
  };
}
