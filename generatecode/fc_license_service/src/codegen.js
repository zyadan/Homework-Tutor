import crypto from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateActivationCode(prefix = 'VIP', segments = 3, segmentLength = 4) {
  const chars = [];
  for (let i = 0; i < segments; i += 1) {
    let part = '';
    for (let j = 0; j < segmentLength; j += 1) {
      const index = crypto.randomInt(0, ALPHABET.length);
      part += ALPHABET[index];
    }
    chars.push(part);
  }

  const normalizedPrefix = String(prefix || '').trim().toUpperCase();
  return normalizedPrefix ? `${normalizedPrefix}-${chars.join('-')}` : chars.join('-');
}

export function generateActivationCodes(count, prefix = 'VIP') {
  if (!Number.isInteger(count) || count <= 0) {
    throw new Error('count must be greater than 0');
  }

  const codes = new Set();
  while (codes.size < count) {
    codes.add(generateActivationCode(prefix));
  }
  return [...codes];
}
