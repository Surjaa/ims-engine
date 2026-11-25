import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { all, first } from '../db';
import { round2 } from '../http';

const app = new Hono<AppEnv>();

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Named = { name: string; value: number };

// Last 12 months of a YYYY-MM keyed map, oldest first, with zeros where there were no sales.
function lastMonths(count: number): string[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (count - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

app.get('/dashboard', async (c) => {
  const uid = c.get('userId');
  const db = c.env.DB;

  const [totals, profit, receipts, payments, topLoc, topItem, trend, topCustomers, purchLoc, purchCat, salesLoc, salesCat, salesCity] =
    await Promise.all([
      first<{ sales: number; purchases: number }>(
        db,
        `SELECT COALESCE((SELECT SUM(total) FROM sales WHERE user_id = ?), 0) AS sales,
                COALESCE((SELECT SUM(total) FROM purchases WHERE user_id = ?), 0) AS purchases`,
        [uid, uid],
      ),
      first<{ profit: number }>(
        db,
        `SELECT COALESCE(SUM(sl.qty * (sl.unit_price - sl.unit_cost)), 0) AS profit
         FROM sale_lines sl JOIN sales s ON s.id = sl.sale_id WHERE s.user_id = ?`,
        [uid],
      ),
      first<{ amount: number }>(db, "SELECT COALESCE(SUM(amount), 0) AS amount FROM payments WHERE user_id = ? AND direction = 'receipt'", [uid]),
      first<{ amount: number }>(db, "SELECT COALESCE(SUM(amount), 0) AS amount FROM payments WHERE user_id = ? AND direction = 'payment'", [uid]),
      first<{ name: string }>(
        db,
        `SELECT COALESCE(NULLIF(state, ''), 'Unspecified') AS name FROM sales WHERE user_id = ?
         GROUP BY state ORDER BY SUM(total) DESC LIMIT 1`,
        [uid],
      ),
      first<{ name: string }>(
        db,
        `SELECT it.name FROM sale_lines sl JOIN sales s ON s.id = sl.sale_id JOIN items it ON it.id = sl.item_id
         WHERE s.user_id = ? GROUP BY it.id ORDER BY SUM(sl.qty) DESC LIMIT 1`,
        [uid],
      ),
      all<{ ym: string; sales: number }>(
        db,
        `SELECT substr(sale_date, 1, 7) AS ym, SUM(total) AS sales FROM sales
         WHERE user_id = ? AND sale_date >= date('now', 'start of month', '-11 months') GROUP BY ym`,
        [uid],
      ),
      all<{ name: string; total: number }>(
        db,
        `SELECT pa.name, SUM(s.total) AS total FROM sales s JOIN parties pa ON pa.id = s.party_id
         WHERE s.user_id = ? GROUP BY s.party_id ORDER BY total DESC LIMIT 5`,
        [uid],
      ),
      all<Named>(
        db,
        `SELECT COALESCE(NULLIF(state, ''), 'Unspecified') AS name, SUM(total) AS value FROM purchases
         WHERE user_id = ? GROUP BY name ORDER BY value DESC`,
        [uid],
      ),
      all<{ year: string; category: string; amount: number }>(
        db,
        `SELECT substr(p.purchase_date, 1, 4) AS year, COALESCE(ca.name, 'Uncategorised') AS category,
                SUM(pl.qty * pl.unit_cost) AS amount
         FROM purchase_lines pl JOIN purchases p ON p.id = pl.purchase_id
         JOIN items it ON it.id = pl.item_id LEFT JOIN categories ca ON ca.id = it.category_id
         WHERE p.user_id = ? GROUP BY year, category`,
        [uid],
      ),
      all<Named>(
        db,
        `SELECT COALESCE(NULLIF(state, ''), 'Unspecified') AS name, SUM(total) AS value FROM sales
         WHERE user_id = ? GROUP BY name ORDER BY value DESC`,
        [uid],
      ),
      all<Named>(
        db,
        `SELECT COALESCE(ca.name, 'Uncategorised') AS name, SUM(sl.qty * sl.unit_price) AS value
         FROM sale_lines sl JOIN sales s ON s.id = sl.sale_id
         JOIN items it ON it.id = sl.item_id LEFT JOIN categories ca ON ca.id = it.category_id
         WHERE s.user_id = ? GROUP BY 1 ORDER BY value DESC`,
        [uid],
      ),
      all<Named>(
        db,
        `SELECT COALESCE(NULLIF(city, ''), 'Unspecified') AS name, SUM(total) AS value FROM sales
         WHERE user_id = ? GROUP BY name ORDER BY value DESC`,
        [uid],
      ),
    ]);

  const sales = totals?.sales ?? 0;
  const purchases = totals?.purchases ?? 0;

  // Year-by-category pivot for the purchase chart: one row per year, one column per category.
  const categories = [...new Set(purchCat.map((r) => r.category))].sort();
  const years = [...new Set(purchCat.map((r) => r.year))].sort();
  const pivot = years.map((year) => {
    const row: Record<string, string | number> = { year };
    for (const cat of categories) {
      row[cat] = round2(purchCat.find((r) => r.year === year && r.category === cat)?.amount ?? 0);
    }
    return row;
  });

  const trendMap = new Map(trend.map((t) => [t.ym, t.sales]));
  const salesTrend = lastMonths(12).map((ym) => {
    const [y, m] = ym.split('-');
    return { month: `${MONTHS[Number(m) - 1]} ${y.slice(2)}`, sales: round2(trendMap.get(ym) ?? 0) };
  });

  return c.json({
    kpis: {
      total_sales: round2(sales),
      total_purchases: round2(purchases),
      net_profit: round2(profit?.profit ?? 0),
      receivable: round2(sales - (receipts?.amount ?? 0)),
      payable: round2(purchases - (payments?.amount ?? 0)),
      top_location: topLoc?.name ?? null,
      top_item: topItem?.name ?? null,
    },
    salesTrend,
    topCustomers: topCustomers.map((t) => ({ name: t.name, total: round2(t.total) })),
    purchaseByLocation: purchLoc.map((r) => ({ name: r.name, value: round2(r.value) })),
    purchaseByCategory: { categories, rows: pivot },
    salesByLocation: salesLoc.map((r) => ({ name: r.name, value: round2(r.value) })),
    salesByCategory: salesCat.map((r) => ({ name: r.name, value: round2(r.value) })),
    salesByCity: salesCity.map((r) => ({ name: r.name, value: round2(r.value) })),
  });
});

// Monthly revenue and cost of goods, newest first, for the last 24 months.
app.get('/reports/monthly', async (c) => {
  const uid = c.get('userId');
  const [rev, cogs] = await Promise.all([
    all<{ month: string; revenue: number }>(
      c.env.DB,
      'SELECT substr(sale_date, 1, 7) AS month, SUM(total) AS revenue FROM sales WHERE user_id = ? GROUP BY month',
      [uid],
    ),
    all<{ month: string; cogs: number }>(
      c.env.DB,
      `SELECT substr(s.sale_date, 1, 7) AS month, SUM(sl.qty * sl.unit_cost) AS cogs
       FROM sale_lines sl JOIN sales s ON s.id = sl.sale_id WHERE s.user_id = ? GROUP BY month`,
      [uid],
    ),
  ]);
  const revMap = new Map(rev.map((r) => [r.month, r.revenue]));
  const cogsMap = new Map(cogs.map((r) => [r.month, r.cogs]));
  return c.json(
    lastMonths(24)
      .reverse()
      .map((month) => ({
        month,
        revenue: round2(revMap.get(month) ?? 0),
        cogs: round2(cogsMap.get(month) ?? 0),
      })),
  );
});

export default app;
