import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../api';
import { Card, Empty, Icon, PageHeader, Stat } from '../components/kit';
import { useSettings } from '../context';
import { compact, money } from '../lib';
import type { Item, MonthlyRow } from '../types';

const TOOLTIP_STYLE = { borderRadius: 14, border: '1px solid #CBD5E1', boxShadow: '0 12px 30px rgba(1, 11, 19, .15)', fontSize: 13 };
const AXIS_TICK = { fontSize: 12, fill: '#64748B' };

export default function Reports() {
  const monthly = useApi<MonthlyRow[]>('/reports/monthly', []);
  const items = useApi<Item[]>('/items', []);
  const { settings } = useSettings();
  const cur = settings.currency ?? '₹';

  const stockValue = items.data.reduce((a, i) => a + i.qty * i.unit_cost, 0);
  const ranked = useMemo(
    () => [...items.data].sort((a, b) => b.qty * b.unit_cost - a.qty * a.unit_cost),
    [items.data],
  );
  const maxValue = Math.max(...ranked.map((i) => i.qty * i.unit_cost), 1);

  // Newest-first from the API; charts read oldest to newest.
  const chart = useMemo(
    () =>
      [...monthly.data].reverse().map((r) => ({
        month: r.month,
        Revenue: Math.round(r.revenue),
        'Gross profit': Math.round(r.revenue - r.cogs),
      })),
    [monthly.data],
  );

  const revenue = monthly.data.reduce((a, r) => a + r.revenue, 0);
  const profit = monthly.data.reduce((a, r) => a + (r.revenue - r.cogs), 0);
  const margin = revenue ? (profit / revenue) * 100 : 0;

  return (
    <>
      <PageHeader
        icon="receipt"
        eyebrow="Analysis"
        title="Reports"
        subtitle="Monthly profit and stock value, calculated from your sales and purchases."
        actions={
          <button type="button" className="btn btn-dark px-4 d-print-none" onClick={() => window.print()}>
            <Icon name="print" size={15} /> Print report
          </button>
        }
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3"><Stat label="Revenue (all months)" value={money(revenue, cur)} accent="#0891B2" icon="receipt" delay={0} /></div>
        <div className="col-6 col-xl-3"><Stat label="Gross profit" value={money(profit, cur)} accent="#0891B2" icon="up" delay={60} /></div>
        <div className="col-6 col-xl-3"><Stat label="Gross margin" value={`${margin.toFixed(1)}%`} accent="#6366F1" icon="coins" delay={120} /></div>
        <div className="col-6 col-xl-3"><Stat label="Stock valuation" value={money(stockValue, cur)} accent="#F59E0B" icon="box" delay={180} /></div>
      </div>

      <div className="row g-4">
        <div className="col-12">
          <Card title="Revenue vs gross profit" subtitle="Last 24 months with sales" delay={120}>
            {chart.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="month" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => compact(Number(v))} tick={AXIS_TICK} axisLine={false} tickLine={false} width={56} />
                  <Tooltip formatter={(v) => money(Number(v), cur)} contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(1,11,19,.04)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar isAnimationActive={false} dataKey="Revenue" fill="#0891B2" radius={[8, 8, 0, 0]} animationDuration={900} />
                  <Bar isAnimationActive={false} dataKey="Gross profit" fill="#0F172A" radius={[8, 8, 0, 0]} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty text="No sales yet, so there is nothing to chart." icon="receipt" />
            )}
          </Card>
        </div>

        <div className="col-12 col-xl-7">
          <Card title="Monthly profit" subtitle="Revenue, cost of sales and margin" delay={180}>
            {monthly.data.length ? (
              <div className="table-responsive">
                <table className="table align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col" className="text-end">Revenue</th>
                      <th scope="col" className="text-end">Cost of sales</th>
                      <th scope="col" className="text-end">Gross profit</th>
                      <th scope="col" className="text-end">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.data.map((r) => {
                      const p = r.revenue - r.cogs;
                      const m = r.revenue ? (p / r.revenue) * 100 : 0;
                      return (
                        <tr key={r.month}>
                          <td className="fw-semibold">{r.month}</td>
                          <td className="text-end">{money(r.revenue, cur)}</td>
                          <td className="text-end">{money(r.cogs, cur)}</td>
                          <td className="text-end amount" style={{ color: p >= 0 ? '#0E7490' : '#E76F51' }}>{money(p, cur)}</td>
                          <td className="text-end">
                            <span className={`chip ${m >= 20 ? 'chip-ok' : m >= 10 ? 'chip-low' : 'chip-out'}`}>{m.toFixed(1)}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty text="No sales yet." icon="receipt" />
            )}
          </Card>
        </div>

        <div className="col-12 col-xl-5">
          <Card title="Stock valuation" subtitle="Quantity × average cost, largest first" delay={240}>
            <div className="amount mb-3" style={{ fontSize: '1.9rem' }}>{money(stockValue, cur)}</div>
            {ranked.length ? (
              <ul className="hbar-list">
                {ranked.map((i, idx) => {
                  const v = i.qty * i.unit_cost;
                  return (
                    <li key={i.id}>
                      <div className="hbar-top">
                        <span>{i.name} <small className="text-muted">{i.qty} {i.unit}</small></span>
                        <strong>{money(v, cur)}</strong>
                      </div>
                      <div className="hbar-track">
                        <div
                          className="hbar-fill"
                          style={{
                            width: `${(v / maxValue) * 100}%`,
                            background: idx % 2 ? 'linear-gradient(90deg, #0F172A, #6366F1)' : 'linear-gradient(90deg, #0891B2, #6366F1)',
                            animationDelay: `${idx * 60}ms`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty text="No items yet." icon="box" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
