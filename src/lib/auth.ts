const ITERATIONS = 100_000;
const KEY_LENGTH = 32;

export async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH * 8,
  );
  const hashArr = Array.from(new Uint8Array(bits));
  const saltArr = Array.from(salt);
  return btoa(JSON.stringify({ salt: saltArr, hash: hashArr }));
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const { salt, hash } = JSON.parse(atob(stored));
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      KEY_LENGTH * 8,
    );
    const hashArr = Array.from(new Uint8Array(bits));
    return hashArr.every((b, i) => b === hash[i]);
  } catch {
    return false;
  }
}

export function generateToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export const SESSION_COOKIE = 'yfc_session';
export const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days in seconds

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`;
}

export function clearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
