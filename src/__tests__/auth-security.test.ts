import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  parseSessionToken,
} from '@/lib/auth';

describe('Authentication & Security Layer', () => {
  it('hashes passwords using salt:hash format and verifies correctly', () => {
    const rawPassword = 'MySecurePassword123!';
    const hashed = hashPassword(rawPassword);

    expect(hashed).toContain(':');
    const [salt, hash] = hashed.split(':');
    expect(salt).toHaveLength(32);
    expect(hash).toHaveLength(128);

    // Verifies valid password
    expect(verifyPassword(rawPassword, hashed)).toBe(true);

    // Fails on invalid password
    expect(verifyPassword('WrongPassword', hashed)).toBe(false);
  });

  it('handles backward compatibility for legacy base64 encoded passwords', () => {
    const rawPassword = 'legacyPassword456';
    const legacyHash = Buffer.from(rawPassword).toString('base64');

    expect(verifyPassword(rawPassword, legacyHash)).toBe(true);
    expect(verifyPassword('wrongPassword', legacyHash)).toBe(false);
  });

  it('creates and parses valid session tokens', () => {
    const userId = 'user-test-789';
    const token = createSessionToken(userId);

    expect(token.startsWith('tok_user-test-789_')).toBe(true);

    const parsed = parseSessionToken(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.userId).toBe(userId);
    expect(parsed?.timestamp).toBeGreaterThan(0);
  });

  it('rejects invalid or forged session tokens', () => {
    expect(parseSessionToken('')).toBeNull();
    expect(parseSessionToken('invalid_token_format')).toBeNull();
    expect(parseSessionToken('tok_')).toBeNull();
  });
});
