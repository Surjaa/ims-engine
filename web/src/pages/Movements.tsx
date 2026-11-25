import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApi } from '../api';
import { Card, type Column, DataTable, ErrorNotice, Icon, PageHeader, Sku, Stat } from '../components/kit';
import { when } from '../lib';
import { AXIS_TICK, COLORS, TOOLTIP_STYLE } from '../theme';
import type { Movement } from '../types';

export default function Movements() {
  const { data, error } = useApi<Movement[]>('/movements?limit=200', []);

  const totals = useMemo(
    () => ({
      inQty: data.filter((m) => m.kind === 'IN').reduce((a, m) => a + m.qty, 0),
      outQty: data.filter((m) => m.kind === 'OUT').reduce((a, m) => a + m.qty, 0),
    }),
    [data],
  );

  // Units in and out per day, oldest first, last 14 days with activity.
  const daily = useMemo(() => {
    const m = new Map<string, { day: string; in: number; out: number }>();
    for (const mv of data) {
      const day = mv.created_at.slice(0, 10);
      const row = m.get(day) ?? { day, in: 0, out: 0 };
      if (mv.kind === 'IN') row.in += mv.qty;
      else row.out += mv.qty;
      m.set(day, row);
    }
    return [...m.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-14);
  }, [data]);

  const columns: Column<Movement>[] = [
    {
      key: 'item',
      header: 'Item',
      render: (m) => (
        <div className="d-flex align-items-center gap-2">
          <span className={`timeline-dot ${m.kind === 'IN' ? 'in' : 'out'}`} style={{ width: 30, height: 30, borderRadius: 10 }}>
            <Icon name={m.kind === 'IN' ? 'up' : 'down'} size={14} />
          </span>
          <div>
            <div className="cell-main">{m.name}</div>
            <div className="cell-sub">
              <Sku>{m.sku}</Sku>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (m) => <span className={`chip ${m.kind === 'IN' ? 'chip-in' : 'chip-outflow'}`}>{m.kind === 'IN' ? 'Stock in' : 'Stock out'}</span>,
    },
    {
      key: 'qty',
      header: 'Quantity',
      align: 'end',
      render: (m) => (
        <span className="amount" style={{ color: m.kind === 'IN' ? '#0E7490' : '#A8432D' }}>
          {m.kind === 'IN' ? '+' : '−'}
          {m.qty}
        </span>
      ),
    },
    { key: 'when', header: 'When', render: (m) => <span className="text-muted">{when(m.created_at)}</span> },
    { key: 'note', header: 'Note', render: (m) => m.note || <span className="text-muted">—</span> },
  ];

  return (
    <>
      <PageHeader
        icon="stack"
        eyebrow="History"
        title="Movements"
        subtitle="Every stock change, newest first. Purchases, sales, reversals and manual adjustments all appear here."
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-4"><Stat label="Entries shown" value={data.length} accent={COLORS.navy} icon="stack" delay={0} /></div>
        <div className="col-6 col-xl-4"><Stat label="Units in" value={`+${totals.inQty}`} accent={COLORS.teal} icon="up" delay={80} /></div>
        <div className="col-12 col-xl-4"><Stat label="Units out" value={`−${totals.outQty}`} accent={COLORS.coral} icon="down" delay={160} /></div>
      </div>

      <div className="row g-4 align-items-start">
        <div className="col-12 col-xl-5">
          <Card title="Daily flow" subtitle="Units in and out for the last 14 active days." delay={120}>
            {daily.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="day" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(d) => String(d).slice(5)} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(15, 23, 42,.04)' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Bar isAnimationActive={false} dataKey="in" name="Units in" fill={COLORS.teal} radius={[6, 6, 0, 0]} animationDuration={800} />
                  <Bar isAnimationActive={false} dataKey="out" name="Units out" fill={COLORS.coral} radius={[6, 6, 0, 0]} animationDuration={800} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted small mb-0">No stock movements yet.</p>
            )}
          </Card>
        </div>

        <div className="col-12 col-xl-7">
          <Card title="Stock log" subtitle="Latest 200 entries" delay={180}>
            <ErrorNotice text={error} />
            <DataTable rows={data} columns={columns} rowKey={(m) => m.id} empty="No stock movements yet." emptyIcon="stack" minWidth={680} />
          </Card>
        </div>
      </div>
    </>
  );
}
