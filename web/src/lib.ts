import type { DashboardData, Status } from './types';

export const EMPTY_DASHBOARD: DashboardData = {
  kpis: {
    total_sales: 0,
    total_purchases: 0,
    net_profit: 0,
    receivable: 0,
    payable: 0,
    top_location: null,
    top_item: null,
  },
  salesTrend: [],
  topCustomers: [],
  purchaseByLocation: [],
  purchaseByCategory: { categories: [], rows: [] },
  salesByLocation: [],
  salesByCategory: [],
  salesByCity: [],
};

export const statusOf = (i: { qty: number; reorder_level: number }): Status =>
  i.qty === 0 ? 'OUT' : i.qty <= i.reorder_level ? 'LOW' : 'OK';

export const money = (n: number, currency = '₹') =>
  `${currency}${Math.round(n).toLocaleString('en-IN')}`;

// Short form for chart axes: 1.2M, 85K.
export const compact = (n: number) =>
  Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n));

export const when = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

// For date-only values such as "2026-11-09" from the API.
export const dayLabel = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { dateStyle: 'medium' });

export const todayYmd = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
