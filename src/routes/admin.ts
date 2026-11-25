import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { all, atomic, first } from '../db';
import { HttpError, readBody, str } from '../http';
import { runBackup } from '../lib/backup';

const app = new Hono<AppEnv>();

// Settings the web app can change. Each is a plain text value per account.
const EDITABLE = ['company_name', 'currency', 'currency_code'] as const;

app.get('/settings', async (c) => {
  const rows = await all<{ key: string; value: string }>(
    c.env.DB,
    "SELECT key, value FROM settings WHERE user_id = ? AND key != 'last_backup'",
    [c.get('userId')],
  );
  return c.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

app.put('/settings', async (c) => {
  const uid = c.get('userId');
  const b = await readBody(c);
  const stmts: D1PreparedStatement[] = [];
  for (const key of EDITABLE) {
    if (b[key] === undefined) continue;
    const value = str(b[key], 120);
    if (!value) throw new HttpError(400, `${key.replace(/_/g, ' ')} cannot be empty`);
    stmts.push(
      c.env.DB
        .prepare(
          `INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
           ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`,
        )
        .bind(uid, key, value),
    );
    if (key === 'company_name') {
      stmts.push(c.env.DB.prepare('UPDATE users SET company = ? WHERE id = ?').bind(value, uid));
    }
  }
  if (stmts.length) await atomic(c.env.DB, stmts);

  const rows = await all<{ key: string; value: string }>(
    c.env.DB,
    "SELECT key, value FROM settings WHERE user_id = ? AND key != 'last_backup'",
    [uid],
  );
  return c.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
});

app.get('/backup/status', async (c) => {
  const uid = c.get('userId');
  const last = await first<{ value: string }>(
    c.env.DB,
    "SELECT value FROM settings WHERE user_id = ? AND key = 'last_backup'",
    [uid],
  );
  return c.json({
    configured: Boolean(c.env.GOOGLE_SHEET_ID && c.env.GOOGLE_SERVICE_ACCOUNT_JSON),
    auto: c.env.AUTO_BACKUP === 'true',
    last_backup: last?.value ?? null,
  });
});

app.post('/backup', async (c) => {
  if (!c.env.GOOGLE_SHEET_ID || !c.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new HttpError(503, 'Google Sheets backup is not configured');
  }
  try {
    return c.json(await runBackup(c.env, c.get('userId')));
  } catch (e) {
    throw new HttpError(502, `Backup failed. ${(e as Error).message}`);
  }
});

export default app;
