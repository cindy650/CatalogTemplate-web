export type NormalizedSafeDistance = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function numberValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function normalizeSafeDistance(value: unknown): NormalizedSafeDistance {
  let raw = value;
  if (typeof raw === 'string' && raw.trim()) {
    try { raw = JSON.parse(raw) as unknown; } catch { raw = {}; }
  }
  const record = recordValue(raw);
  return {
    top: numberValue(record.top),
    right: numberValue(record.right),
    bottom: numberValue(record.bottom),
    left: numberValue(record.left)
  };
}

export function normalizeProductSafeDistances(record: Record<string, unknown>) {
  return {
    backCoverSafeDistance: normalizeSafeDistance(record.back_cover_safe_distance_json ?? record.backCoverSafeDistance ?? record.back_cover_safe_distance),
    coverSafeDistance: normalizeSafeDistance(record.cover_safe_distance_json ?? record.coverSafeDistance ?? record.cover_safe_distance),
    spineSafeDistance: normalizeSafeDistance(record.spine_safe_distance_json ?? record.spineSafeDistance ?? record.spine_safe_distance)
  };
}
