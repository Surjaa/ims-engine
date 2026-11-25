import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { all, first, run } from '../db';
import { HttpError, inUse, int, readBody, str } from '../http';

const app = new Hono<AppEnv>();

// Balance: what a customer still owes us, or what we still owe a supplier.
const BALANCE = `ROUND(CASE WHEN p.kind = 'customer'
    THEN COALESCE((SELECT SUM(s.total) FROM sales s WHERE s.party_id = p.id), 0)
       - COALESCE((SELECT SUM(x.amount) FROM payments x WHERE x.party_id = p.id AND x.direction = 'receipt'), 0)
    ELSE COALESCE((SELECT SUM(s.total) FROM purchases s WHERE s.party_id = p.id), 0)
       - COALESCE((SELECT SUM(x.amount) FROM payments x WHERE x.party_id = p.id AND x.direction = 'payment'), 0)
  END, 2)`;

const PARTY_SELECT = `SELECT p.id, p.kind, p.name, p.phone, p.email, p.city, ${BALANCE} AS balance FROM parties p`;

app.get('/parties', async (c) => {
  const uid = c.get('userId');
  const kind = c.req.query('kind');
  const filter = kind === 'supplier' || kind === 'customer' ? kind : 'all';
  return c.json(
    await all(
      c.env.DB,
      `${PARTY_SELECT} WHERE p.user_id = ? AND (? = 'all' OR p.kind = ?) ORDER BY p.name`,
      [uid, filter, filter],
    ),
  );
});

function partyFields(b: Record<string, any>) {
  const name = str(b.name, 120);
  if (!name) throw new HttpError(400, 'Enter a name');
  return [name, str(b.phone, 40), str(b.email, 200), str(b.city, 80)] as const;
}

app.post('/parties', async (c) => {
  const uid = c.get('userId');
  const b = await readBody(c);
  const kind = b.kind === 'supplier' || b.kind === 'customer' ? b.kind : null;
  if (!kind) throw new HttpError(400, 'Choose supplier or customer');
  const [name, phone, email, city] = partyFields(b);
  const row = await first<{ id: number }>(
    c.env.DB,
    'INSERT INTO parties (user_id, kind, name, phone, email, city) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
    [uid, kind, name, phone, email, city],
  );
  return c.json(await first(c.env.DB, `${PARTY_SELECT} WHERE p.id = ?`, [row!.id]));
});

// The kind of an existing party does not change on edit.
app.put('/parties/:id', async (c) => {
  const uid = c.get('userId');
  const id = int(c.req.param('id'));
  const [name, phone, email, city] = partyFields(await readBody(c));
  const r = await run(c.env.DB, 'UPDATE parties SET name = ?, phone = ?, email = ?, city = ? WHERE id = ? AND user_id = ?', [
    name,
    phone,
    email,
    city,
    id,
    uid,
  ]);
  if (!r.meta.changes) throw new HttpError(404, 'Party not found');
  return c.json(await first(c.env.DB, `${PARTY_SELECT} WHERE p.id = ?`, [id]));
});

app.delete('/parties/:id', async (c) => {
  const uid = c.get('userId');
  try {
    const r = await run(c.env.DB, 'DELETE FROM parties WHERE id = ? AND user_id = ?', [int(c.req.param('id')), uid]);
    if (!r.meta.changes) throw new HttpError(404, 'Party not found');
  } catch (e) {
    inUse(e, 'This party has transactions and cannot be deleted');
    throw e;
  }
  return c.json({ ok: true });
});

export default app;
