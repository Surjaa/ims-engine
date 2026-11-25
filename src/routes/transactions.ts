import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { all, first, run } from '../db';
import { HttpError, int, isDate, num, readBody, str } from '../http';
import { deletePurchase, deleteSale, insertPurchase, insertSale, type LineIn, type TxnIn } from '../lib/txn';
import { loadInvoice, mailConfigured, renderInvoiceHtml, sendInvoiceEmail } from '../lib/invoice';

const app = new Hono<AppEnv>();

function parseLines(raw: unknown): LineIn[] {
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) throw new HttpError(400, 'Add at least one line');
  return list.map((l: Record<string, unknown>) => {
    const qty = int(l.qty);
    const price = num(l.price);
    if (int(l.item_id) < 1) throw new HttpError(400, 'Choose an item on every line');
    if (qty < 1) throw new HttpError(400, 'Quantity must be at least 1');
    if (price < 0) throw new HttpError(400, 'Price cannot be negative');
    return { item_id: int(l.item_id), qty, price };
  });
}

function parseTxn(b: Record<string, any>): TxnIn {
  const partyId = int(b.party_id);
  if (partyId < 1) throw new HttpError(400, 'Choose a party');
  if (b.date && !isDate(b.date)) throw new HttpError(400, 'Invalid date');
  return {
    party_id: partyId,
    date: b.date || undefined,
    state: str(b.state, 80),
    city: str(b.city, 80),
    lines: parseLines(b.lines),
  };
}

// Lists for purchases and sales, in the Txn shape the web app reads.
const txnList = (table: 'purchases' | 'sales', lineTable: 'purchase_lines' | 'sale_lines', dateCol: string, fk: string) =>
  `SELECT t.id, t.party_id, pa.name AS party_name, t.${dateCol} AS date, t.state, t.city, t.total,
     (SELECT COUNT(*) FROM ${lineTable} l WHERE l.${fk} = t.id) AS lines
   FROM ${table} t JOIN parties pa ON pa.id = t.party_id
   WHERE t.user_id = ? ORDER BY t.${dateCol} DESC, t.id DESC LIMIT 200`;

const PURCHASES_LIST = txnList('purchases', 'purchase_lines', 'purchase_date', 'purchase_id');
const SALES_LIST = txnList('sales', 'sale_lines', 'sale_date', 'sale_id');

// Purchases
app.get('/purchases', async (c) => c.json(await all(c.env.DB, PURCHASES_LIST, [c.get('userId')])));

app.post('/purchases', async (c) => {
  const id = await insertPurchase(c.env.DB, c.get('userId'), parseTxn(await readBody(c)));
  return c.json({ id });
});

app.delete('/purchases/:id', async (c) => {
  await deletePurchase(c.env.DB, c.get('userId'), int(c.req.param('id')));
  return c.json({ ok: true });
});

// Sales
app.get('/sales', async (c) => c.json(await all(c.env.DB, SALES_LIST, [c.get('userId')])));

app.post('/sales', async (c) => {
  const id = await insertSale(c.env.DB, c.get('userId'), parseTxn(await readBody(c)));
  return c.json({ id });
});

app.delete('/sales/:id', async (c) => {
  await deleteSale(c.env.DB, c.get('userId'), int(c.req.param('id')));
  return c.json({ ok: true });
});

// Invoices
app.get('/sales/:id/invoice', async (c) => c.json(await loadInvoice(c.env.DB, c.get('userId'), int(c.req.param('id')))));

app.get('/sales/:id/invoice/html', async (c) => {
  const inv = await loadInvoice(c.env.DB, c.get('userId'), int(c.req.param('id')));
  return c.html(renderInvoiceHtml(inv));
});

app.post('/sales/:id/invoice/send', async (c) => {
  if (!mailConfigured(c.env)) throw new HttpError(503, 'Email is not configured. Add RESEND_API_KEY and MAIL_FROM.');
  const to = str((await readBody(c)).to, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) throw new HttpError(400, 'Enter a valid email address');
  const inv = await loadInvoice(c.env.DB, c.get('userId'), int(c.req.param('id')));
  try {
    await sendInvoiceEmail(c.env, to, inv);
  } catch (e) {
    throw new HttpError(502, `The invoice could not be sent. ${(e as Error).message}`);
  }
  return c.json({ sent_to: to });
});

// Payments: receipts from customers, payments to suppliers.
app.get('/payments', async (c) => {
  const uid = c.get('userId');
  const dir = c.req.query('direction');
  const filter = dir === 'receipt' || dir === 'payment' ? dir : 'all';
  return c.json(
    await all(
      c.env.DB,
      `SELECT x.id, x.party_id, pa.name AS party_name, x.direction, x.amount, x.pay_date AS date, x.note
       FROM payments x JOIN parties pa ON pa.id = x.party_id
       WHERE x.user_id = ? AND (? = 'all' OR x.direction = ?)
       ORDER BY x.pay_date DESC, x.id DESC LIMIT 200`,
      [uid, filter, filter],
    ),
  );
});

app.post('/payments', async (c) => {
  const uid = c.get('userId');
  const b = await readBody(c);
  const direction = b.direction === 'receipt' || b.direction === 'payment' ? b.direction : null;
  if (!direction) throw new HttpError(400, 'Choose receipt or payment');
  const partyId = int(b.party_id);
  const amount = Math.round(num(b.amount) * 100) / 100;
  if (amount <= 0) throw new HttpError(400, 'Amount must be more than zero');
  if (b.date && !isDate(b.date)) throw new HttpError(400, 'Invalid date');

  const kind = direction === 'receipt' ? 'customer' : 'supplier';
  const party = await first(c.env.DB, 'SELECT 1 AS ok FROM parties WHERE id = ? AND kind = ? AND user_id = ?', [
    partyId,
    kind,
    uid,
  ]);
  if (!party) throw new HttpError(400, kind === 'customer' ? 'Choose a customer' : 'Choose a supplier');

  const row = await first<{ id: number }>(
    c.env.DB,
    `INSERT INTO payments (user_id, party_id, direction, amount, pay_date, note)
     VALUES (?, ?, ?, ?, COALESCE(?, date('now')), ?) RETURNING id`,
    [uid, partyId, direction, amount, b.date || null, str(b.note, 200)],
  );
  return c.json({ id: row!.id });
});

app.delete('/payments/:id', async (c) => {
  const r = await run(c.env.DB, 'DELETE FROM payments WHERE id = ? AND user_id = ?', [
    int(c.req.param('id')),
    c.get('userId'),
  ]);
  if (!r.meta.changes) throw new HttpError(404, 'Payment not found');
  return c.json({ ok: true });
});

export default app;
