type KynsDeepMessageParams = {
  endpoint?: string | null;
  spec?: string | null;
  sender?: string | null;
  modelLabel?: string | null;
};

const normalize = (value?: string | null) => value?.trim().toLowerCase() ?? '';

export function isKynsDeepMessage({
  endpoint,
  spec,
  sender,
  modelLabel,
}: KynsDeepMessageParams): boolean {
  if (normalize(spec) === 'kyns-deep') {
    return true;
  }

  const normalizedEndpoint = normalize(endpoint);
  if (normalizedEndpoint === 'kynsdeep' || normalizedEndpoint === 'kyns-deep') {
    return true;
  }

  const labels = [sender, modelLabel].map(normalize);
  return labels.some((label) => label === 'kyns deep' || label.includes('kyns deep'));
}
