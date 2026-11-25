// Demo history for the sample account. The events are worked out in memory first, then written
// in a few batches. The stock and cost rules match lib/txn.ts exactly, so the demo looks like
// data entered through the app. Batches keep the number of database calls low (Workers limit
// the number of subrequests per request).
import { round2 } from './http';
import { baseCatalogStatements } from './base';

const SUPPLIERS = [
  { name: 'Bright Wave Components', city: 'Austin', state: 'Texas' },
  { name: 'Nexus Parts Co', city: 'Dallas', state: 'Texas' },
  { name: 'Apex Supply', city: 'Phoenix', state: 'Arizona' },
  { name: 'Summit Trading', city: 'Tampa', state: 'Florida' },
  { name: 'Vertex Wholesale', city: 'Sacramento', state: 'California' },
];

const CUSTOMERS = [
  { name: 'Harbor Retail', city: 'Miami', state: 'Florida' },
  { name: 'Lone Star Stores', city: 'Houston', state: 'Texas' },
  { name: 'Golden Gate Traders', city: 'San Francisco', state: 'California' },
  { name: 'Desert Mart', city: 'Scottsdale', state: 'Arizona' },
  { name: 'Bayou Supplies', city: 'Orlando', state: 'Florida' },
  { name: 'Sunset Electronics', city: 'Los Angeles', state: 'California' },
  { name: 'Prairie Goods', city: 'Dallas', state: 'Texas' },
  { name: 'Metro Tech Hub', city: 'San Diego', state: 'California' },
];

const CHUNK = 90; // statements per batch

// Seeded random so every rebuild of the sample account produces the same history.
function makeRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

// A date N months ago on the given day, as YYYY-MM-DD (UTC).
function dateAt(monthsAgo: number, day: number) {
  const now = new Date();
  const base = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  return `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(Math.min(day, last))}`;
}

interface Item {
  id: number;
  unit_price: number;
}

interface Event {
  date: string;
  kind: 'purchase' | 'sale';
  party: number; // party id
  state: string;
  city: string;
  lines: { item: number; qty: number; price: number }[];
}

// Removes everything the account owns except its settings, so the sample data can be rebuilt.
export async function resetDemoData(db: D1Database, uid: number) {
  const tables = ['payments', 'sales', 'purchases', 'parties', 'movements', 'items', 'categories', 'custom_fields'];
  await db.batch(tables.map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(uid)));
}

// Writes the sample catalogue and history for one account. Runs after resetDemoData.
export async function seedDemo(db: D1Database, uid: number, company: string) {
  const random = makeRandom(42);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(random() * arr.length)];

  // Base catalogue and settings first, so the items exist to read back.
  await db.batch([
    ...baseCatalogStatements(db, uid),
    db
      .prepare(
        `INSERT INTO settings (user_id, key, value) VALUES (?, 'company_name', ?), (?, 'currency', '₹')
         ON CONFLICT (user_id, key) DO UPDATE SET value = excluded.value`,
      )
      .bind(uid, company, uid),
  ]);
  const { results: itemRows } = await db
    .prepare('SELECT id, unit_price AS unit_price FROM items WHERE user_id = ? ORDER BY id')
    .bind(uid)
    .all<Item>();
  const items = itemRows ?? [];
  if (items.length === 0) return;

  // Party and document ids are assigned here, so the statements can refer to them in one batch.
  const maxParty = (await db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM parties').first<{ m: number }>())!.m;
  const maxPurchase = (await db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM purchases').first<{ m: number }>())!.m;
  const maxSale = (await db.prepare('SELECT COALESCE(MAX(id), 0) AS m FROM sales').first<{ m: number }>())!.m;

  let partyId = maxParty;
  const suppliers = SUPPLIERS.map((s) => ({ ...s, id: ++partyId }));
  const customers = CUSTOMERS.map((c) => ({ ...c, id: ++partyId }));

  const pickLines = (n: number, price: (it: Item) => number, qty: () => number) => {
    const chosen = new Set<number>();
    const out: Event['lines'] = [];
    while (out.length < Math.min(n, items.length)) {
      const it = pick(items);
      if (chosen.has(it.id)) continue;
      chosen.add(it.id);
      out.push({ item: it.id, qty: qty(), price: price(it) });
    }
    return out;
  };

  // Twelve months of events: two purchases and six sales a month, then applied in date order.
  const events: Event[] = [];
  for (let m = 11; m >= 0; m--) {
    for (const day of [3, 18]) {
      const s = pick(suppliers);
      events.push({
        date: dateAt(m, day),
        kind: 'purchase',
        party: s.id,
        state: s.state,
        city: s.city,
        lines: pickLines(3, (it) => round2(it.unit_price * 0.6), () => 20 + Math.floor(random() * 40)),
      });
    }
    for (let k = 0; k < 6; k++) {
      const cu = pick(customers);
      events.push({
        date: dateAt(m, 2 + Math.floor(random() * 26)),
        kind: 'sale',
        party: cu.id,
        state: cu.state,
        city: cu.city,
        lines: pickLines(
          1 + Math.floor(random() * 3),
          (it) => round2(it.unit_price * (0.95 + random() * 0.1)),
          () => 1 + Math.floor(random() * 6),
        ),
      });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  // Simulate stock so a sale never takes more than is on hand (the same rule the app enforces).
  const state = new Map(items.map((it) => [it.id, { qty: 0, cost: 0 }]));
  let purchaseId = maxPurchase;
  let saleId = maxSale;
  const stmts: D1PreparedStatement[] = [];
  const sold = new Map<number, number>(); // customer id -> total
  const bought = new Map<number, number>(); // supplier id -> total

  for (const e of events) {
    if (e.kind === 'purchase') {
      const id = ++purchaseId;
      const total = round2(e.lines.reduce((a, l) => a + l.qty * l.price, 0));
      bought.set(e.party, round2((bought.get(e.party) ?? 0) + total));
      stmts.push(
        db
          .prepare(
            `INSERT INTO purchases (id, user_id, party_id, purchase_date, state, city, total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(id, uid, e.party, e.date, e.state, e.city, total),
      );
      for (const l of e.lines) {
        const st = state.get(l.item)!;
        const newQty = st.qty + l.qty;
        st.cost = round2((st.qty * st.cost + l.qty * l.price) / newQty);
        st.qty = newQty;
        stmts.push(
          db.prepare('INSERT INTO purchase_lines (purchase_id, item_id, qty, unit_cost) VALUES (?, ?, ?, ?)').bind(id, l.item, l.qty, l.price),
        );
        stmts.push(
          db.prepare("INSERT INTO movements (user_id, item_id, kind, qty, note) VALUES (?, ?, 'IN', ?, ?)").bind(uid, l.item, l.qty, `Purchase #${id}`),
        );
      }
      continue;
    }

    const enough = e.lines.every((l) => state.get(l.item)!.qty >= l.qty);
    if (!enough) continue; // stock short: the sale is skipped, as in the earlier demo
    const id = ++saleId;
    const total = round2(e.lines.reduce((a, l) => a + l.qty * l.price, 0));
    sold.set(e.party, round2((sold.get(e.party) ?? 0) + total));
    stmts.push(
      db
        .prepare('INSERT INTO sales (id, user_id, party_id, sale_date, state, city, total) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .bind(id, uid, e.party, e.date, e.state, e.city, total),
    );
    for (const l of e.lines) {
      const st = state.get(l.item)!;
      st.qty -= l.qty;
      stmts.push(
        db
          .prepare('INSERT INTO sale_lines (sale_id, item_id, qty, unit_price, unit_cost) VALUES (?, ?, ?, ?, ?)')
          .bind(id, l.item, l.qty, l.price, st.cost),
      );
      stmts.push(
        db.prepare("INSERT INTO movements (user_id, item_id, kind, qty, note) VALUES (?, ?, 'OUT', ?, ?)").bind(uid, l.item, l.qty, `Sale #${id}`),
      );
    }
  }

  // Parties, then documents, then final stock. Money received and paid, so balances are not zero.
  const partyStmts = [...suppliers.map((s) => ({ ...s, kind: 'supplier' })), ...customers.map((c) => ({ ...c, kind: 'customer' }))].map(
    (p) =>
      db
        .prepare('INSERT INTO parties (id, user_id, kind, name, city) VALUES (?, ?, ?, ?, ?)')
        .bind(p.id, uid, p.kind, p.name, p.city),
  );
  const finalStock = [...state.entries()].map(([id, st]) =>
    db.prepare('UPDATE items SET qty = ?, unit_cost = ? WHERE id = ? AND user_id = ?').bind(st.qty, st.cost, id, uid),
  );
  const money = [
    ...[...sold].map(([party, total]) =>
      db
        .prepare("INSERT INTO payments (user_id, party_id, direction, amount, pay_date, note) VALUES (?, ?, 'receipt', ?, date('now', '-5 days'), 'Demo receipt')")
        .bind(uid, party, round2(total * 0.6)),
    ),
    ...[...bought].map(([party, total]) =>
      db
        .prepare("INSERT INTO payments (user_id, party_id, direction, amount, pay_date, note) VALUES (?, ?, 'payment', ?, date('now', '-5 days'), 'Demo payment')")
        .bind(uid, party, round2(total * 0.5)),
    ),
  ];

  // Parties must exist before the documents that refer to them.
  const ordered = [...partyStmts, ...stmts, ...finalStock, ...money];
  for (let i = 0; i < ordered.length; i += CHUNK) {
    await db.batch(ordered.slice(i, i + CHUNK));
  }
}
