// Base catalog for every new account. Stock arrives through purchases, so the opening quantity is zero.
const BASE_CATEGORIES = ['Motherboards', 'Processors', 'Graphic Cards', 'Memory Chips'];

const BASE_ITEMS: [sku: string, name: string, category: string, reorder: number, price: number][] = [
  ['MB-100', 'Motherboard A100', 'Motherboards', 15, 150],
  ['MB-200', 'Motherboard B200', 'Motherboards', 15, 220],
  ['CP-310', 'Processor X310', 'Processors', 15, 260],
  ['CP-520', 'Processor Y520', 'Processors', 15, 340],
  ['GC-610', 'Graphic Card G610', 'Graphic Cards', 10, 480],
  ['GC-750', 'Graphic Card G750', 'Graphic Cards', 10, 690],
  ['MC-16', 'Memory Chip 16GB', 'Memory Chips', 30, 55],
  ['MC-32', 'Memory Chip 32GB', 'Memory Chips', 30, 95],
];

// The statements that create the base catalog for one account. Run them in one batch.
export function baseCatalogStatements(db: D1Database, uid: number): D1PreparedStatement[] {
  const out: D1PreparedStatement[] = [];
  for (const name of BASE_CATEGORIES) {
    out.push(db.prepare('INSERT INTO categories (user_id, name) VALUES (?, ?)').bind(uid, name));
  }
  for (const [sku, name, category, reorder, price] of BASE_ITEMS) {
    out.push(
      db
        .prepare(
          `INSERT INTO items (user_id, sku, name, category_id, unit, qty, reorder_level, unit_cost, unit_price)
           VALUES (?, ?, ?, (SELECT id FROM categories WHERE user_id = ? AND name = ?), 'pcs', 0, ?, 0, ?)`,
        )
        .bind(uid, sku, name, uid, category, reorder, price),
    );
  }
  return out;
}
