const allowedChoices = ['save', 'sell', 'throw'] as const;
const allowedImageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

export function parsePositiveInt(value: string | undefined): number | null {
  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export function isAllowedChoice(value: unknown): value is (typeof allowedChoices)[number] {
  return typeof value === 'string' && (allowedChoices as readonly string[]).includes(value);
}

export function isAllowedImageMimeType(value: unknown): value is (typeof allowedImageMimeTypes)[number] {
  return typeof value === 'string' && (allowedImageMimeTypes as readonly string[]).includes(value);
}
