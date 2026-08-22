import crypto from 'crypto';

/**
 * Production password hashing using SHA-256 and unique random salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify plaintext password against stored salt:hash string
 * Also supports legacy base64 format for backward compatibility
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash) return false;

  // Modern salt:hash format
  if (storedHash.includes(':')) {
    const [salt, originalHash] = storedHash.split(':');
    const computedHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha256').toString('hex');
    return computedHash === originalHash;
  }

  // Legacy fallback
  try {
    const legacyDecoded = Buffer.from(storedHash, 'base64').toString('utf-8');
    return legacyDecoded === password || storedHash === password;
  } catch {
    return storedHash === password;
  }
}

/**
 * Generate a signed or structured session token
 */
export function createSessionToken(userId: string): string {
  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(8).toString('hex');
  return `tok_${userId}_${timestamp}_${randomSuffix}`;
}

/**
 * Extract user ID and validate format of a session token
 */
export function parseSessionToken(token: string): { userId: string; timestamp: number } | null {
  if (!token || !token.startsWith('tok_')) return null;
  const parts = token.split('_');
  if (parts.length < 3) return null;
  const userId = parts[1];
  const timestamp = parseInt(parts[2], 10);
  if (!userId || isNaN(timestamp)) return null;
  return { userId, timestamp };
}
