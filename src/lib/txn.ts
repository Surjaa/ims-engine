// Purchases, sales and their reversals. Each change is applied with one D1 batch, so a failure
// part-way leaves no partial stock change. The purchase or sale header is inserted first (D1
// batches cannot read back the new id), and removed again if its lines fail.
import { all, atomic, first, run } from '../db';
import { HttpError, checkFailed, round2 } from '../http';

export interface LineIn {
  item_id: number;
  qty: number;
  price: number;
}

export interface TxnIn {
  party_id: number;
  date?: string;
  state: string;
  city: string;
  lines: LineIn[];
}

type ItemRow = { id: number; name: string; qty: number; unit_cost: number };

// Reads the items used by a transaction, scoped to the account.
async function readItems(db: D1Database, uid: number, ids: number[]): Promise<Map<number, ItemRow>> {
  if (ids.length === 0) return new Map();
  const marks = ids.map(() => '?').join(', ');
  const rows = await all<ItemRow>(
    db,
    `SELECT id, name, qty, unit_cost FROM items WHERE user_id = ? AND id IN (${marks})`,
    [uid, ...ids],
  );
  return new Map(rows.map((r) => [r.id, r]));
}

async function requireParty(db: D1Database, uid: number, partyId: number, kind: 'supplier' | 'customer') {
  const party = await first(db, 'SELECT 1 AS ok FROM parties WHERE id = ? AND kind = ? AND user_id = ?', [
    partyId,
    kind,
    uid,
  ]);
  if (!party) throw new HttpError(400, kind === 'supplier' ? 'Choose a supplier' : 'Choose a customer');
}

const uniqueIds = (lines: LineIn[]) => [...new Set(lines.map((l) => l.item_id))];

// A purchase raises stock. The new unit cost is the weighted average, calculated in SQL
// from the row's current values, so two purchases cannot overwrite each other's cost.
export async function insertPurchase(db: D1Database, uid: number, t: TxnIn): Promise<number> {
  await requireParty(db, uid, t.party_id, 'supplier');
  const items = await readItems(db, uid, uniqueIds(t.lines));
  for (const l of t.lines) if (!items.has(l.item_id)) throw new HttpError(400, 'Unknown item on a line');

  const total = round2(t.lines.reduce((a, l) => a + l.qty * l.price, 0));
  const head = await first<{ id: number }>(
    db,
    `INSERT INTO purchases (user_id, party_id, purchase_date, state, city, total)
     VALUES (?, ?, COALESCE(?, date('now')), ?, ?, ?) RETURNING id`,
    [uid, t.party_id, t.date ?? null, t.state, t.city, total],
  );
  const pid = head!.id;

  const stmts: D1PreparedStatement[] = [];
  for (const l of t.lines) {
    stmts.push(
      db
        .prepare(
          `UPDATE items SET unit_cost = ROUND((qty * unit_cost + ? * ?) / (qty + ?), 2), qty = qty + ?
           WHERE id = ? AND user_id = ?`,
        )
        .bind(l.qty, l.price, l.qty, l.qty, l.item_id, uid),
    );
    stmts.push(
      db
        .prepare('INSERT INTO purchase_lines (purchase_id, item_id, qty, unit_cost) VALUES (?, ?, ?, ?)')
        .bind(pid, l.item_id, l.qty, l.price),
    );
    stmts.push(
      db
        .prepare("INSERT INTO movements (user_id, item_id, kind, qty, note) VALUES (?, ?, 'IN', ?, ?)")
        .bind(uid, l.item_id, l.qty, `Purchase #${pid}`),
    );
  }
  try {
    await atomic(db, stmts);
  } catch (e) {
    await run(db, 'DELETE FROM purchases WHERE id = ? AND user_id = ?', [pid, uid]);
    throw e;
  }
  return pid;
}

// A sale lowers stock. The database refuses a line that would take stock below zero, which
// undoes the whole sale. The unit cost is copied into the line, so profit stays right later.
export async function insertSale(db: D1Database, uid: number, t: TxnIn): Promise<number> {
  await requireParty(db, uid, t.party_id, 'customer');
  const items = await readItems(db, uid, uniqueIds(t.lines));
  const needed = new Map<number, number>();
  for (const l of t.lines) {
    if (!items.has(l.item_id)) throw new HttpError(400, 'Unknown item on a line');
    needed.set(l.item_id, (needed.get(l.item_id) ?? 0) + l.qty);
  }
  for (const [id, qty] of needed) {
    const it = items.get(id)!;
    if (it.qty < qty) throw new HttpError(409, `Only ${it.qty} ${it.name} in stock`);
  }

  const total = round2(t.lines.reduce((a, l) => a + l.qty * l.price, 0));
  const head = await first<{ id: number }>(
    db,
    `INSERT INTO sales (user_id, party_id, sale_date, state, city, total)
     VALUES (?, ?, COALESCE(?, date('now')), ?, ?, ?) RETURNING id`,
    [uid, t.party_id, t.date ?? null, t.state, t.city, total],
  );
  const sid = head!.id;

  const stmts: D1PreparedStatement[] = [];
  for (const l of t.lines) {
    stmts.push(db.prepare('UPDATE items SET qty = qty - ? WHERE id = ? AND user_id = ?').bind(l.qty, l.item_id, uid));
    stmts.push(
      db
        .prepare(
          `INSERT INTO sale_lines (sale_id, item_id, qty, unit_price, unit_cost)
           VALUES (?, ?, ?, ?, (SELECT unit_cost FROM items WHERE id = ?))`,
        )
        .bind(sid, l.item_id, l.qty, l.price, l.item_id),
    );
    stmts.push(
      db
        .prepare("INSERT INTO movements (user_id, item_id, kind, qty, note) VALUES (?, ?, 'OUT', ?, ?)")
        .bind(uid, l.item_id, l.qty, `Sale #${sid}`),
    );
  }
  try {
    await atomic(db, stmts);
  } catch (e) {
    await run(db, 'DELETE FROM sales WHERE id = ? AND user_id = ?', [sid, uid]);
    checkFailed(e, 'Not enough stock for one of the lines');
    throw e;
  }
  return sid;
}

// Deleting a purchase takes its stock back out, as long as that stock has not been sold.
export async function deletePurchase(db: D1Database, uid: number, id: number) {
  const lines = await all<{ item_id: number; qty: number; name: string }>(
    db,
    `SELECT pl.item_id, pl.qty, i.name FROM purchase_lines pl
     JOIN purchases p ON p.id = pl.purchase_id
     JOIN items i ON i.id = pl.item_id
     WHERE pl.purchase_id = ? AND p.user_id = ?`,
    [id, uid],
  );
  if (!lines.length) throw new HttpError(404, 'Purchase not found');
  const items = await readItems(db, uid, lines.map((l) => l.item_id));
  for (const l of lines) {
    if (items.get(l.item_id)!.qty < l.qty) {
      throw new HttpError(409, `Cannot delete: ${l.name} has already been sold`);
    }
  }

  const stmts: D1PreparedStatement[] = [];
  for (const l of lines) {
    stmts.push(db.prepare('UPDATE items SET qty = qty - ? WHERE id = ? AND user_id = ?').bind(l.qty, l.item_id, uid));
    stmts.push(
      db
        .prepare("INSERT INTO movements (user_id, item_id, kind, qty, note) VALUES (?, ?, 'OUT', ?, ?)")
        .bind(uid, l.item_id, l.qty, `Reversed purchase #${id}`),
    );
  }
  stmts.push(db.prepare('DELETE FROM purchases WHERE id = ? AND user_id = ?').bind(id, uid));
  try {
    await atomic(db, stmts);
  } catch (e) {
    checkFailed(e, 'Cannot delete: stock from this purchase has already been sold');
    throw e;
  }
}

// Deleting a sale puts its stock back.
export async function deleteSale(db: D1Database, uid: number, id: number) {
  const lines = await all<{ item_id: number; qty: number }>(
    db,
    `SELECT sl.item_id, sl.qty FROM sale_lines sl
     JOIN sales s ON s.id = sl.sale_id
     WHERE sl.sale_id = ? AND s.user_id = ?`,
    [id, uid],
  );
  if (!lines.length) throw new HttpError(404, 'Sale not found');

  const stmts: D1PreparedStatement[] = [];
  for (const l of lines) {
    stmts.push(db.prepare('UPDATE items SET qty = qty + ? WHERE id = ? AND user_id = ?').bind(l.qty, l.item_id, uid));
    stmts.push(
      db
        .prepare("INSERT INTO movements (user_id, item_id, kind, qty, note) VALUES (?, ?, 'IN', ?, ?)")
        .bind(uid, l.item_id, l.qty, `Reversed sale #${id}`),
    );
  }
  stmts.push(db.prepare('DELETE FROM sales WHERE id = ? AND user_id = ?').bind(id, uid));
  await atomic(db, stmts);
}
