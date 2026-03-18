import { normalizeRoleplayContent } from '../remarkRoleplay';

describe('normalizeRoleplayContent', () => {
  it('adds blank lines between adjacent action and dialogue beats', () => {
    const input = '*She smiles softly.* "Hi there." (tilts her head) "Did you miss me?"';

    expect(normalizeRoleplayContent(input)).toBe(
      '*She smiles softly.*\n\n"Hi there."\n\n(tilts her head)\n\n"Did you miss me?"',
    );
  });

  it('keeps existing formatting intact when content is already separated', () => {
    const input = '*She smiles softly.*\n\n"Hi there."';

    expect(normalizeRoleplayContent(input)).toBe(input);
  });

  it('does not rewrite fenced code blocks', () => {
    const input = '```text\n*action* "dialogue"\n```';

    expect(normalizeRoleplayContent(input)).toBe(input);
  });
});
