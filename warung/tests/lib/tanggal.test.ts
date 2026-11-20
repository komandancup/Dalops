import { describe, it, expect } from 'vitest';
import { tanggalWIB, jamWIB } from '../../src/lib/tanggal';

describe('tanggalWIB / jamWIB', () => {
  it('rolls over to the next day at 17:00 UTC', () => {
    expect(tanggalWIB(new Date('2026-11-20T17:30:00Z'))).toBe('2026-11-21');
    expect(tanggalWIB(new Date('2026-11-20T16:59:00Z'))).toBe('2026-11-20');
  });
  it('formats time as HH:MM in WIB', () => {
    expect(jamWIB(new Date('2026-11-20T17:30:00Z'))).toBe('00:30');
  });
});
