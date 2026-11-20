import { describe, expect, it } from 'vitest';
import { emailDariUsername, usernameValid } from '../../src/data/auth';

describe('username', () => {
  it('maps username to synthetic email', () => {
    expect(emailDariUsername('budi')).toBe('budi@warung.app');
  });
  it('validates usernames', () => {
    expect(usernameValid('budi')).toBe(true);
    expect(usernameValid('budi_2')).toBe(true);
    expect(usernameValid('Budi')).toBe(false);
    expect(usernameValid('b')).toBe(false);
    expect(usernameValid('budi lele')).toBe(false);
    expect(usernameValid('a'.repeat(21))).toBe(false);
  });
});
