import type { Context } from 'hono';
import { HttpError } from '../http';
import { first, run } from '../db';
import { randomBytes, sha256Hex, toBase64Url } from './crypto';
import type { AppEnv } from '../types';

export const COOKIE = 'ims_sid';
export const SESSION_SEC = 7 * 24 * 60 * 60; // signed-in session lifetime
export const PENDING_SEC = 5 * 60; // time allowed to enter the 2FA code

// The cookie holds a random token. Only its SHA-256 hash is stored in D1.
export async function createSession(db: D1Database, userId: number, verified: boolean): Promise<string> {
  const token = toBase64Url(randomBytes(32));
  const ttlMs = (verified ? SESSION_SEC : PENDING_SEC) * 1000;
  await run(db, 'DELETE FROM sessions WHERE expires_at < ?', [Date.now()]);
  await run(db, 'INSERT INTO sessions (token_hash, user_id, verified, expires_at) VALUES (?, ?, ?, ?)', [
    await sha256Hex(token),
    userId,
    verified ? 1 : 0,
    Date.now() + ttlMs,
  ]);
  return token;
}

export function readToken(c: Context): string | null {
  for (const part of (c.req.header('cookie') ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === COOKIE) return part.slice(eq + 1).trim();
  }
  return null;
}

export function setCookie(c: Context<AppEnv>, token: string, maxAgeSec: number) {
  c.header(
    'Set-Cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}; Secure`,
  );
}

export function clearCookie(c: Context<AppEnv>) {
  c.header('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`);
}

// The account behind a fully signed-in session (password and 2FA both passed).
// Deactivated accounts are refused with 403.
export async function currentUserId(c: Context<AppEnv>): Promise<number> {
  const token = readToken(c);
  if (token) {
    const row = await first<{ user_id: number; active: number }>(
      c.env.DB,
      `SELECT s.user_id, u.active FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.verified = 1 AND s.expires_at > ?`,
      [await sha256Hex(token), Date.now()],
    );
    if (row) {
      if (!row.active) throw new HttpError(403, 'This account has been deactivated');
      return row.user_id;
    }
  }
  throw new HttpError(401, 'Please sign in');
}
