import { describe, it, expect } from 'bun:test';
import { fnv1a } from './hash';

describe('fnv1a', () => {
  it('is deterministic', () => {
    expect(fnv1a('/repo/wt-a')).toBe(fnv1a('/repo/wt-a'));
  });
  it('differs for different inputs', () => {
    expect(fnv1a('/repo/wt-a')).not.toBe(fnv1a('/repo/wt-b'));
  });
  it('returns a non-negative 32-bit integer', () => {
    const h = fnv1a('/repo/wt-a');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(h)).toBe(true);
  });
});
