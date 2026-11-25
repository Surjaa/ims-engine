import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { all, atomic, first, run } from '../db';
import { HttpError, checkFailed, dupe, inUse, int, num, readBody, round2, str } from '../http';

const app = new Hono<AppEnv>();

type ItemRow = {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  category: string | null;
  unit: string;
  qty: number;
  reorder_level: number;
  unit_cost: number;
  unit_price: number;
  extra: string;
};

// Turns a database row into the item shape the web app reads.
const shapeItem = (r: ItemRow) => ({ ...r, extra: JSON.parse(r.extra || '{}') as Record<string, string> });

const ITEM_SELECT = `SELECT i.id, i.sku, i.name, i.category_id, c.name AS category, i.unit, i.qty,
  i.reorder_level, i.unit_cost, i.unit_price, i.extra
  FROM items i LEFT JOIN categories c ON c.id = i.category_id`;

async function itemById(db: D1Database, uid: number, id: number) {
  const r = await first<ItemRow>(db, `${ITEM_SELECT} WHERE i.id = ? AND i.user_id = ?`, [id, uid]);
  if (!r) throw new HttpError(404, 'Item not found');
  return shapeItem(r);
}

// Checks that a category belongs to this account. Null means no category.
async function checkCategory(db: D1Database, uid: number, id: number | null) {
  if (id === null) return;
  const ok = await first(db, 'SELECT 1 AS x FROM categories WHERE id = ? AND user_id = ?', [id, uid]);
  if (!ok) throw new HttpError(400, 'Unknown category');
}

// Turns custom field values into strings, keeping only the keys the form sent.
function cleanExtra(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {};
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, val]) => [k, str(val, 200)]));
}

// Categories
app.get('/categories', async (c) => {
  const uid = c.get('userId');
  return c.json(await all(c.env.DB, 'SELECT id, name FROM categories WHERE user_id = ? ORDER BY name', [uid]));
});

app.post('/categories', async (c) => {
  const uid = c.get('userId');
  const name = str((await readBody(c)).name, 60);
  if (!name) throw new HttpError(400, 'Enter a category name');
  try {
    const row = await first<{ id: number; name: string }>(
      c.env.DB,
      'INSERT INTO categories (user_id, name) VALUES (?, ?) RETURNING id, name',
      [uid, name],
    );
    return c.json(row);
  } catch (e) {
    dupe(e, 'That category already exists');
    throw e;
  }
});

// Items
app.get('/items', async (c) => {
  const uid = c.get('userId');
  const q = str(c.req.query('q') ?? '', 100);
  const filter = ['reorder', 'out'].includes(c.req.query('filter') ?? '') ? c.req.query('filter')! : 'all';
  const rows = await all<ItemRow>(
    c.env.DB,
    `${ITEM_SELECT}
     WHERE i.user_id = ?
       AND (? = '' OR i.name LIKE ? OR i.sku LIKE ?)
       AND (? = 'all' OR (? = 'out' AND i.qty = 0) OR (? = 'reorder' AND i.qty <= i.reorder_level))
     ORDER BY i.name`,
    [uid, q, `%${q}%`, `%${q}%`, filter, filter, filter],
  );
  return c.json(rows.map(shapeItem));
});

app.post('/items', async (c) => {
  const uid = c.get('userId');
  const b = await readBody(c);
  const sku = str(b.sku, 40);
  const name = str(b.name, 120);
  if (!sku || !name) throw new HttpError(400, 'SKU and name are required');
  const categoryId = b.category_id ? int(b.category_id) : null;
  await checkCategory(c.env.DB, uid, categoryId);
  const qty = Math.max(0, int(b.qty));
  try {
    const row = await first<{ id: number }>(
      c.env.DB,
      `INSERT INTO items (user_id, sku, name, category_id, unit, qty, reorder_level, unit_cost, unit_price, extra)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        uid,
        sku,
        name,
        categoryId,
        str(b.unit, 20) || 'pcs',
        qty,
        Math.max(0, int(b.reorder_level)),
        round2(Math.max(0, num(b.unit_cost))),
        round2(Math.max(0, num(b.unit_price))),
        JSON.stringify(cleanExtra(b.extra)),
      ],
    );
    return c.json(await itemById(c.env.DB, uid, row!.id));
  } catch (e) {
    dupe(e, 'An item with this SKU already exists');
    throw e;
  }
});

// Quantity changes only through movements, so PUT does not touch qty.
app.put('/items/:id', async (c) => {
  const uid = c.get('userId');
  const id = int(c.req.param('id'));
  await itemById(c.env.DB, uid, id);
  const b = await readBody(c);
  const sku = str(b.sku, 40);
  const name = str(b.name, 120);
  if (!sku || !name) throw new HttpError(400, 'SKU and name are required');
  const categoryId = b.category_id ? int(b.category_id) : null;
  await checkCategory(c.env.DB, uid, categoryId);
  try {
    await run(
      c.env.DB,
      `UPDATE items SET sku = ?, name = ?, category_id = ?, unit = ?, reorder_level = ?,
         unit_cost = ?, unit_price = ?, extra = ?
       WHERE id = ? AND user_id = ?`,
      [
        sku,
        name,
        categoryId,
        str(b.unit, 20) || 'pcs',
        Math.max(0, int(b.reorder_level)),
        round2(Math.max(0, num(b.unit_cost))),
        round2(Math.max(0, num(b.unit_price))),
        JSON.stringify(cleanExtra(b.extra)),
        id,
        uid,
      ],
    );
  } catch (e) {
    dupe(e, 'An item with this SKU already exists');
    throw e;
  }
  return c.json(await itemById(c.env.DB, uid, id));
});

app.delete('/items/:id', async (c) => {
  const uid = c.get('userId');
  const id = int(c.req.param('id'));
  try {
    const r = await run(c.env.DB, 'DELETE FROM items WHERE id = ? AND user_id = ?', [id, uid]);
    if (!r.meta.changes) throw new HttpError(404, 'Item not found');
  } catch (e) {
    inUse(e, 'This item has purchases or sales and cannot be deleted');
    throw e;
  }
  return c.json({ ok: true });
});

// Stock movements
app.get('/movements', async (c) => {
  const uid = c.get('userId');
  const limit = Math.min(Math.max(int(c.req.query('limit') ?? 100), 1), 500);
  return c.json(
    await all(
      c.env.DB,
      `SELECT m.id, m.item_id, m.kind, m.qty, m.note, m.created_at, i.name, i.sku
       FROM movements m JOIN items i ON i.id = m.item_id
       WHERE m.user_id = ? ORDER BY m.created_at DESC, m.id DESC LIMIT ?`,
      [uid, limit],
    ),
  );
});

// Manual stock in or out. The CHECK constraint on items.qty stops stock going below zero.
app.post('/movements', async (c) => {
  const uid = c.get('userId');
  const b = await readBody(c);
  const itemId = int(b.item_id);
  const kind = b.kind === 'OUT' ? 'OUT' : b.kind === 'IN' ? 'IN' : null;
  const qty = int(b.qty);
  if (!kind) throw new HttpError(400, 'Choose stock in or stock out');
  if (qty < 1) throw new HttpError(400, 'Quantity must be at least 1');
  const item = await itemById(c.env.DB, uid, itemId);
  if (kind === 'OUT' && qty > item.qty) throw new HttpError(409, `Only ${item.qty} in stock`);

  try {
    await atomic(c.env.DB, [
      c.env.DB
        .prepare(`UPDATE items SET qty = qty ${kind === 'IN' ? '+' : '-'} ? WHERE id = ? AND user_id = ?`)
        .bind(qty, itemId, uid),
      c.env.DB
        .prepare('INSERT INTO movements (user_id, item_id, kind, qty, note) VALUES (?, ?, ?, ?, ?)')
        .bind(uid, itemId, kind, qty, str(b.note, 200)),
    ]);
  } catch (e) {
    checkFailed(e, `Only ${item.qty} in stock`);
    throw e;
  }
  return c.json(await itemById(c.env.DB, uid, itemId));
});

// Custom fields
const FIELD_TYPES = ['text', 'number', 'date'] as const;

app.get('/fields', async (c) => {
  const uid = c.get('userId');
  return c.json(
    await all(c.env.DB, 'SELECT id, field_key, label, type FROM custom_fields WHERE user_id = ? ORDER BY id', [uid]),
  );
});

app.post('/fields', async (c) => {
  const uid = c.get('userId');
  const b = await readBody(c);
  const label = str(b.label, 60);
  const type = (FIELD_TYPES as readonly string[]).includes(b.type) ? b.type : 'text';
  const key = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!label || !key) throw new HttpError(400, 'Enter a field name');
  try {
    const row = await first(
      c.env.DB,
      'INSERT INTO custom_fields (user_id, field_key, label, type) VALUES (?, ?, ?, ?) RETURNING id, field_key, label, type',
      [uid, key, label, type],
    );
    return c.json(row);
  } catch (e) {
    dupe(e, 'A field with this name already exists');
    throw e;
  }
});

app.delete('/fields/:id', async (c) => {
  const uid = c.get('userId');
  const r = await run(c.env.DB, 'DELETE FROM custom_fields WHERE id = ? AND user_id = ?', [int(c.req.param('id')), uid]);
  if (!r.meta.changes) throw new HttpError(404, 'Field not found');
  return c.json({ ok: true });
});

export default app;
