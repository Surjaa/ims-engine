// Google Sheets backup over the REST API (no googleapis SDK, which does not run on Workers).
// Each account gets its own set of tabs named like `Items_u12`, so accounts never mix.
// Manual backups run from the Settings page. Automatic backups run from a cron trigger
// (every 15 minutes) when AUTO_BACKUP is "true", and only for accounts that changed.
import type { Env } from '../env';
import { all } from '../db';
import { googleAccessToken } from './google';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

interface Tab {
  name: string;
  sql: string;
  columns: string[];
}

// Each query filters by the account's own rows, so every tab only holds that account's data.
const TABS: Tab[] = [
  { name: 'Categories', sql: 'SELECT id, name FROM categories WHERE user_id = ? ORDER BY id', columns: ['id', 'name'] },
  {
    name: 'Items',
    sql: 'SELECT id, sku, name, category_id, unit, qty, reorder_level, unit_cost, unit_price, created_at FROM items WHERE user_id = ? ORDER BY id',
    columns: ['id', 'sku', 'name', 'category_id', 'unit', 'qty', 'reorder_level', 'unit_cost', 'unit_price', 'created_at'],
  },
  {
    name: 'Parties',
    sql: 'SELECT id, kind, name, phone, email, city, created_at FROM parties WHERE user_id = ? ORDER BY id',
    columns: ['id', 'kind', 'name', 'phone', 'email', 'city', 'created_at'],
  },
  {
    name: 'Purchases',
    sql: 'SELECT id, party_id, purchase_date, state, city, total, created_at FROM purchases WHERE user_id = ? ORDER BY id',
    columns: ['id', 'party_id', 'purchase_date', 'state', 'city', 'total', 'created_at'],
  },
  {
    name: 'PurchaseLines',
    sql: 'SELECT l.id, l.purchase_id, l.item_id, l.qty, l.unit_cost FROM purchase_lines l JOIN purchases p ON p.id = l.purchase_id WHERE p.user_id = ? ORDER BY l.id',
    columns: ['id', 'purchase_id', 'item_id', 'qty', 'unit_cost'],
  },
  {
    name: 'Sales',
    sql: 'SELECT id, party_id, sale_date, state, city, total, created_at FROM sales WHERE user_id = ? ORDER BY id',
    columns: ['id', 'party_id', 'sale_date', 'state', 'city', 'total', 'created_at'],
  },
  {
    name: 'SaleLines',
    sql: 'SELECT l.id, l.sale_id, l.item_id, l.qty, l.unit_price, l.unit_cost FROM sale_lines l JOIN sales s ON s.id = l.sale_id WHERE s.user_id = ? ORDER BY l.id',
    columns: ['id', 'sale_id', 'item_id', 'qty', 'unit_price', 'unit_cost'],
  },
  {
    name: 'Payments',
    sql: 'SELECT id, party_id, direction, amount, pay_date, note FROM payments WHERE user_id = ? ORDER BY id',
    columns: ['id', 'party_id', 'direction', 'amount', 'pay_date', 'note'],
  },
  {
    name: 'Movements',
    sql: 'SELECT id, item_id, kind, qty, note, created_at FROM movements WHERE user_id = ? ORDER BY id',
    columns: ['id', 'item_id', 'kind', 'qty', 'note', 'created_at'],
  },
];

// Stops text such as "=HYPERLINK(...)" from running as a formula when the sheet is opened.
const guard = (v: unknown) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
};

const tabName = (tab: string, uid: number) => `${tab}_u${uid}`;

// Writes this account's data to its tabs. Returns what was written, for the Settings page.
export async function runBackup(env: Env, uid: number) {
  const token = await googleAccessToken(env.GOOGLE_SERVICE_ACCOUNT_JSON!, 'https://www.googleapis.com/auth/spreadsheets');
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const sheetId = env.GOOGLE_SHEET_ID!;

  // Make sure every tab exists.
  const meta = await fetch(`${SHEETS}/${sheetId}?fields=sheets.properties.title`, { headers: auth });
  if (!meta.ok) throw new Error(`Google Sheets returned ${meta.status}`);
  const existing = new Set(
    ((await meta.json()) as { sheets: { properties: { title: string } }[] }).sheets.map((s) => s.properties.title),
  );
  const missing = TABS.map((t) => tabName(t.name, uid)).filter((n) => !existing.has(n));
  if (missing.length) {
    const res = await fetch(`${SHEETS}/${sheetId}:batchUpdate`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) }),
    });
    if (!res.ok) throw new Error(`Could not create tabs (${res.status})`);
  }

  // Replace each tab's contents.
  let rows = 0;
  for (const tab of TABS) {
    const data = await all<Record<string, unknown>>(env.DB, tab.sql, [uid]);
    rows += data.length;
    const values = [tab.columns, ...data.map((r) => tab.columns.map((col) => guard(r[col])))];
    const range = encodeURIComponent(`'${tabName(tab.name, uid)}'!A1`);
    await fetch(`${SHEETS}/${sheetId}/values/${range}:clear`, { method: 'POST', headers: auth });
    const put = await fetch(`${SHEETS}/${sheetId}/values/${range}?valueInputOption=RAW`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({ values }),
    });
    if (!put.ok) throw new Error(`Could not write ${tab.name} (${put.status})`);
  }

  const at = new Date().toISOString();
  await env.DB
    .prepare(
      `INSERT INTO settings (user_id, key, value) VALUES (?, 'last_backup', ?)
       ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`,
    )
    .bind(uid, at)
    .run();
  return { at, tabs: TABS.length, rows };
}

// Cron: back up company owners whose data changed since their last backup.
export async function runScheduledBackups(env: Env) {
  if (env.AUTO_BACKUP !== 'true' || !env.GOOGLE_SHEET_ID || !env.GOOGLE_SERVICE_ACCOUNT_JSON) return;
  const owners = await all<{ id: number }>(
    env.DB,
    `SELECT u.id FROM users u
     WHERE u.workspace_id IS NULL AND u.demo = 0 AND u.active = 1
       AND EXISTS (
         SELECT 1 FROM movements m
         WHERE m.user_id = u.id
           AND m.created_at > COALESCE((SELECT value FROM settings s WHERE s.user_id = u.id AND s.key = 'last_backup'), '')
       )
     LIMIT 5`,
    [],
  );
  for (const o of owners) {
    try {
      await runBackup(env, o.id);
    } catch (e) {
      console.error(`Scheduled backup failed for account ${o.id}`, e);
    }
  }
}

