import assert from 'node:assert/strict';
import { normalizeProductSafeDistances } from '../src/shared/safeDistance.ts';

const normalized = normalizeProductSafeDistances({
  back_cover_safe_distance: JSON.stringify({ top: 1, right: 2, bottom: 3, left: 4 }),
  cover_safe_distance: { top: 5, right: 6, bottom: 7, left: 8 },
  spine_safe_distance: JSON.stringify({ top: 9, right: 10, bottom: 11, left: 12 })
});

assert.deepEqual(normalized, {
  backCoverSafeDistance: { top: 1, right: 2, bottom: 3, left: 4 },
  coverSafeDistance: { top: 5, right: 6, bottom: 7, left: 8 },
  spineSafeDistance: { top: 9, right: 10, bottom: 11, left: 12 }
});

console.log('product safe-distance normalization checks passed');
