import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { atomic, first, run } from '../db';
import { HttpError, dupe, readBody, str } from '../http';
import {
  PENDING_SEC,
  SESSION_SEC,
  clearCookie,
  createSession,
  currentUserId,
  readToken,
  setCookie,
} from '../lib/auth';
import { loadActor, permissionView, superEmailOf } from '../lib/access';
import { hashPassword, newTotpSecret, sha256Hex, totpMatches, totpUri, verifyPassword } from '../lib/crypto';
import { verifyGoogleIdToken } from '../lib/google';
import { baseCatalogStatements } from '../base';
import { resetDemoData, seedDemo } from '../seed';

const DEMO_EMAIL = 'demo@ims.local';
const DEMO_COMPANY = 'IMS Engine Demo';
const MAX_PHOTO_CHARS = 400 * 1024;

const app = new Hono<AppEnv>();

type UserRow = {
  id: number;
  name: string;
  email: string;
  company: string;
  phone: string;
  title: string;
  photo: string | null;
  totp_secret: string | null;
  demo: number;
  active: number;
};

// The shape the web app reads as the signed-in user (see web/src/auth.tsx).
async function accountOf(c: { env: AppEnv['Bindings'] }, uid: number) {
  const u = await first<UserRow>(
    c.env.DB,
    'SELECT id, name, email, company, phone, title, photo, totp_secret, demo, active FROM users WHERE id = ?',
    [uid],
  );
  if (!u) throw new HttpError(401, 'Please sign in');
  const actor = await loadActor(c.env.DB, uid, superEmailOf(c.env));
  return {
    id: String(u.id),
    name: u.name,
    email: u.email,
    company: u.company,
    phone: u.phone,
    title: u.title,
    photo: u.photo,
    twoFactor: Boolean(u.totp_secret),
    demo: u.demo === 1,
    ...permissionView(actor),
  };
}

// Opens a session for a user who passed the password (and, when enabled, 2FA is still pending).
async function startSession(c: any, uid: number, twoFactor: boolean) {
  const token = await createSession(c.env.DB, uid, !twoFactor);
  setCookie(c, token, twoFactor ? PENDING_SEC : SESSION_SEC);
  if (twoFactor) return c.json({ twoFactor: true });
  await run(c.env.DB, "UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", [uid]);
  return c.json(await accountOf(c, uid));
}

// Creates a company owner with the base catalogue and default settings. Rolls back the user on failure.
async function createOwner(db: D1Database, email: string, name: string, company: string, passwordHash: string | null) {
  const row = await first<{ id: number }>(
    db,
    'INSERT INTO users (email, name, company, password_hash) VALUES (?, ?, ?, ?) RETURNING id',
    [email, name, company, passwordHash],
  );
  const uid = row!.id;
  try {
    await atomic(db, [
      ...baseCatalogStatements(db, uid),
      db
        .prepare("INSERT INTO settings (user_id, key, value) VALUES (?, 'company_name', ?), (?, 'currency', '₹'), (?, 'currency_code', 'INR')")
        .bind(uid, company, uid, uid),
    ]);
  } catch (e) {
    await run(db, 'DELETE FROM users WHERE id = ?', [uid]);
    throw e;
  }
  return uid;
}

// Reads the 2FA-pending session cookie and returns the user it belongs to.
async function pendingUser(c: any) {
  const token = readToken(c);
  if (!token) throw new HttpError(401, 'Sign in again');
  const row = await first<{ user_id: number; secret: string | null }>(
    c.env.DB,
    `SELECT s.user_id, u.totp_secret AS secret FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.verified = 0 AND s.expires_at > ?`,
    [await sha256Hex(token), Date.now()],
  );
  if (!row) throw new HttpError(401, 'Sign in again');
  return { token, uid: row.user_id, secret: row.secret };
}

app.get('/auth/me', async (c) => {
  try {
    return c.json(await accountOf(c, await currentUserId(c)));
  } catch {
    return c.json(null);
  }
});

app.get('/auth/google/config', (c) => c.json({ clientId: c.env.GOOGLE_CLIENT_ID ?? null }));

app.post('/auth/google', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID) throw new HttpError(503, 'Google sign-in is not configured');
  const b = await readBody(c);
  const claims = await verifyGoogleIdToken(str(b.credential, 4096), c.env.GOOGLE_CLIENT_ID);
  const email = claims.email.toLowerCase();

  let user = await first<{ id: number; totp_secret: string | null }>(
    c.env.DB,
    'SELECT id, totp_secret FROM users WHERE email = ?',
    [email],
  );
  if (!user) {
    const name = str(claims.name || email.split('@')[0], 100);
    const uid = await createOwner(c.env.DB, email, name, name, null);
    user = { id: uid, totp_secret: null };
  }
  return startSession(c, user.id, Boolean(user.totp_secret));
});

app.post('/auth/signup', async (c) => {
  const b = await readBody(c);
  const name = str(b.name, 100);
  const email = str(b.email, 200).toLowerCase();
  const password = String(b.password ?? '');
  const company = str(b.company, 120) || name;
  if (!name) throw new HttpError(400, 'Enter your name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');
  if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters');

  const exists = await first(c.env.DB, 'SELECT 1 AS x FROM users WHERE email = ?', [email]);
  if (exists) throw new HttpError(409, 'An account with this email already exists');
  const uid = await createOwner(c.env.DB, email, name, company, await hashPassword(password));
  return startSession(c, uid, false);
});

app.post('/auth/signin', async (c) => {
  const b = await readBody(c);
  const email = str(b.email, 200).toLowerCase();
  const password = String(b.password ?? '');
  const u = await first<{ id: number; password_hash: string | null; totp_secret: string | null; active: number }>(
    c.env.DB,
    'SELECT id, password_hash, totp_secret, active FROM users WHERE email = ?',
    [email],
  );
  if (!u || !(await verifyPassword(password, u.password_hash))) {
    throw new HttpError(401, 'Email or password is incorrect');
  }
  if (!u.active) throw new HttpError(403, 'This account has been deactivated');
  return startSession(c, u.id, Boolean(u.totp_secret));
});

app.post('/auth/2fa/verify', async (c) => {
  const b = await readBody(c);
  const { token, uid, secret } = await pendingUser(c);
  if (!secret || !(await totpMatches(secret, b.code))) throw new HttpError(401, 'Incorrect code');
  await run(c.env.DB, 'UPDATE sessions SET verified = 1, expires_at = ? WHERE token_hash = ?', [
    Date.now() + SESSION_SEC * 1000,
    await sha256Hex(token),
  ]);
  setCookie(c, token, SESSION_SEC);
  await run(c.env.DB, "UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?", [uid]);
  return c.json(await accountOf(c, uid));
});

app.post('/auth/2fa/setup', async (c) => {
  const uid = await currentUserId(c);
  const u = await first<{ email: string }>(c.env.DB, 'SELECT email FROM users WHERE id = ?', [uid]);
  const secret = newTotpSecret();
  await run(c.env.DB, 'UPDATE users SET totp_pending = ? WHERE id = ?', [secret, uid]);
  return c.json({ secret, uri: totpUri(secret, u!.email) });
});

app.post('/auth/2fa/enable', async (c) => {
  const uid = await currentUserId(c);
  const b = await readBody(c);
  const u = await first<{ totp_pending: string | null }>(c.env.DB, 'SELECT totp_pending FROM users WHERE id = ?', [uid]);
  if (!u?.totp_pending || !(await totpMatches(u.totp_pending, b.code))) throw new HttpError(400, 'Incorrect code');
  await run(c.env.DB, 'UPDATE users SET totp_secret = totp_pending, totp_pending = NULL WHERE id = ?', [uid]);
  return c.json(await accountOf(c, uid));
});

app.post('/auth/2fa/disable', async (c) => {
  const uid = await currentUserId(c);
  const b = await readBody(c);
  const u = await first<{ totp_secret: string | null }>(c.env.DB, 'SELECT totp_secret FROM users WHERE id = ?', [uid]);
  if (!u?.totp_secret || !(await totpMatches(u.totp_secret, b.code))) throw new HttpError(400, 'Incorrect code');
  await run(c.env.DB, 'UPDATE users SET totp_secret = NULL, totp_pending = NULL WHERE id = ?', [uid]);
  return c.json(await accountOf(c, uid));
});

app.post('/auth/signout', async (c) => {
  const token = readToken(c);
  if (token) await run(c.env.DB, 'DELETE FROM sessions WHERE token_hash = ?', [await sha256Hex(token)]);
  clearCookie(c);
  return c.json({ ok: true });
});

app.post('/auth/profile', async (c) => {
  const uid = await currentUserId(c);
  const b = await readBody(c);
  const cur = await first<UserRow>(
    c.env.DB,
    'SELECT id, name, email, company, phone, title, photo, totp_secret, demo, active FROM users WHERE id = ?',
    [uid],
  );
  if (!cur) throw new HttpError(401, 'Please sign in');

  const name = b.name !== undefined ? str(b.name, 100) : cur.name;
  const email = b.email !== undefined ? str(b.email, 200).toLowerCase() : cur.email;
  if (!name) throw new HttpError(400, 'Enter your name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Enter a valid email address');

  let photo = cur.photo;
  if (b.photo === null) photo = null;
  else if (typeof b.photo === 'string') {
    if (!b.photo.startsWith('data:image/') || b.photo.length > MAX_PHOTO_CHARS) {
      throw new HttpError(400, 'Photo must be an image under 400 KB');
    }
    photo = b.photo;
  }

  try {
    await run(
      c.env.DB,
      'UPDATE users SET name = ?, email = ?, phone = ?, title = ?, company = ?, photo = ? WHERE id = ?',
      [
        name,
        email,
        b.phone !== undefined ? str(b.phone, 40) : cur.phone,
        b.title !== undefined ? str(b.title, 100) : cur.title,
        b.company !== undefined ? str(b.company, 120) || cur.company : cur.company,
        photo,
        uid,
      ],
    );
  } catch (e) {
    dupe(e, 'That email is already in use');
  }
  return c.json(await accountOf(c, uid));
});

app.post('/auth/password', async (c) => {
  const uid = await currentUserId(c);
  const b = await readBody(c);
  const u = await first<{ password_hash: string | null }>(c.env.DB, 'SELECT password_hash FROM users WHERE id = ?', [uid]);
  if (u?.password_hash && !(await verifyPassword(String(b.current ?? ''), u.password_hash))) {
    throw new HttpError(400, 'Current password is incorrect');
  }
  const next = String(b.next ?? '');
  if (next.length < 8) throw new HttpError(400, 'New password must be at least 8 characters');
  await run(c.env.DB, 'UPDATE users SET password_hash = ? WHERE id = ?', [await hashPassword(next), uid]);
  return c.json({ ok: true });
});

// Signs in as the sample account. Its data is rebuilt on every sign-in.
app.post('/auth/demo', async (c) => {
  await run(
    c.env.DB,
    `INSERT INTO users (email, name, company, demo) VALUES (?, 'Demo User', ?, 1)
     ON CONFLICT (email) DO UPDATE SET demo = 1, active = 1, company = excluded.company`,
    [DEMO_EMAIL, DEMO_COMPANY],
  );
  const u = await first<{ id: number }>(c.env.DB, 'SELECT id FROM users WHERE email = ?', [DEMO_EMAIL]);
  await resetDemoData(c.env.DB, u!.id);
  await seedDemo(c.env.DB, u!.id, DEMO_COMPANY);
  return startSession(c, u!.id, false);
});

export default app;
