// Password hashing, sessions and TOTP (the codes Google Authenticator shows), using only
// Web Crypto, which Workers provide. Replaces Node's scrypt and crypto modules.

const enc = new TextEncoder();

export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(text: string): Uint8Array {
  const s = atob(text);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const PBKDF2_ITERATIONS = 100_000; // the most Workers allow for PBKDF2

async function derive(password: string, salt: Uint8Array, iterations: number, bits: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const out = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    bits,
  );
  return new Uint8Array(out);
}

// Stored as "pbkdf2$iterations$salt$hash". A new random salt per password.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await derive(password, salt, PBKDF2_ITERATIONS, 256);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [kind, iterText, saltB64, hashB64] = stored.split('$');
  const iterations = Number(iterText);
  if (kind !== 'pbkdf2' || !iterations || !saltB64 || !hashB64) return false;
  const expected = fromBase64(hashB64);
  const actual = await derive(password, fromBase64(saltB64), iterations, expected.length * 8);
  return constantTimeEqual(actual, expected);
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* TOTP (RFC 6238) */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = ((value << 8) | byte) & 0xffffff;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text.toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    value = ((value << 5) | i) & 0xffffff;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

async function hotp(secret: string, counter: number): Promise<string> {
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter));
  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
  const o = mac[mac.length - 1] & 0x0f;
  const bin = ((mac[o] & 0x7f) << 24) | (mac[o + 1] << 16) | (mac[o + 2] << 8) | mac[o + 3];
  return String(bin % 1_000_000).padStart(6, '0');
}

// Accepts the current 30-second code and one step either side for clock drift.
export async function totpMatches(secret: string, code: unknown): Promise<boolean> {
  const given = String(code ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return false;
  const step = Math.floor(Date.now() / 30_000);
  for (const d of [-1, 0, 1]) {
    if ((await hotp(secret, step + d)) === given) return true;
  }
  return false;
}

export const totpUri = (secret: string, email: string) => {
  const issuer = encodeURIComponent('IMS Engine');
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${issuer}`;
};
