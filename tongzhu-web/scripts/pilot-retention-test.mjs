import assert from 'node:assert/strict';
import {pilotRetentionCutoff} from '../lib/pilot-retention.ts';
assert.equal(pilotRetentionCutoff(new Date('2026-10-17T12:34:56.789Z')), '2026-04-17T12:34:56.789Z');
assert.equal(pilotRetentionCutoff(new Date('2026-08-31T12:00:00Z')), '2026-02-28T12:00:00.000Z');
assert.equal(pilotRetentionCutoff(new Date('2024-08-31T12:00:00Z')), '2024-02-29T12:00:00.000Z');
// Chinese local date is March 1, not February 28: subtract calendar months in Shanghai.
assert.equal(pilotRetentionCutoff(new Date('2026-02-28T18:00:00Z')), '2025-08-31T18:00:00.000Z');
console.log('PASS: six calendar months, month-end clamp, leap year and Shanghai date boundary');
