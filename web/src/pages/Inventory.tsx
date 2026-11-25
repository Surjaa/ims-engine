import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { request, useApi } from '../api';
import { Card, DataTable, ErrorNotice, Icon, Notice, PageHeader, Sku, Stat, StatusChip, type Column, type Msg } from '../components/kit';
import { useSettings } from '../context';
import { AXIS_TICK, COLORS, PALETTE, TOOLTIP_STYLE } from '../theme';
import { money, statusOf } from '../lib';
import type { Item } from '../types';

type Filter = 'all' | 'reorder' | 'out';
const FILTERS: [Filter, string][] = [
  ['all', 'All items'],
  ['reorder', 'Needs reorder'],
  ['out', 'Out of stock'],
];

export default function Inventory() {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const { settings } = useSettings();
  const cur = settings.currency ?? '₹';

  const { data: items, error, reload } = useApi<Item[]>(`/items?q=${encodeURIComponent(q)}&filter=${filter}`, []);
  const all = useApi<Item[]>('/items', []);

  const totals = useMemo(
    () => ({
      units: all.data.reduce((a, i) => a + i.qty, 0),
      value: all.data.reduce((a, i) => a + i.qty * i.unit_cost, 0),
      low: all.data.filter((i) => statusOf(i) === 'LOW').length,
      out: all.data.filter((i) => statusOf(i) === 'OUT').length,
    }),
    [all.data],
  );

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of all.data) {
      const k = i.category ?? 'Uncategorized';
      m.set(k, (m.get(k) ?? 0) + i.qty);
    }
    return [...m.entries()].map(([name, units]) => ({ name, units })).sort((a, b) => b.units - a.units);
  }, [all.data]);

  const move = async (item: Item, kind: 'IN' | 'OUT') => {
    const qty = qtys[item.id] ?? 1;
    try {
      await request('/movements', 'POST', { item_id: item.id, kind, qty, note: `Manual ${kind.toLowerCase()}` });
      setMsg({ type: 'success', text: `${kind === 'IN' ? 'Added' : 'Removed'} ${qty} × ${item.name}` });
      reload();
      all.reload();
    } catch (e) {
      setMsg({ type: 'danger', text: (e as Error).message });
    }
  };

  const columns: Column<Item>[] = [
    {
      key: 'item',
      header: 'Item',
      render: (i) => (
        <>
          <div className="cell-main">{i.name}</div>
          <div className="cell-sub">{i.category ?? 'Uncategorized'}</div>
        </>
      ),
    },
    { key: 'sku', header: 'SKU', render: (i) => <Sku>{i.sku}</Sku> },
    { key: 'status', header: 'Status', render: (i) => <StatusChip item={i} /> },
    {
      key: 'qty',
      header: 'In stock',
      align: 'end',
      render: (i) => (
        <span className="stock-figure">
          {i.qty}
          <small>{i.unit}</small>
        </span>
      ),
    },
    {
      key: 'reorder',
      header: 'Reorder at',
      align: 'end',
      render: (i) => <span className="text-muted">{i.reorder_level} {i.unit}</span>,
    },
    {
      key: 'adjust',
      header: 'Adjust',
      render: (i) => (
        <div className="stepper">
          <input
            type="number"
            min={1}
            aria-label={`Quantity for ${i.name}`}
            value={qtys[i.id] ?? 1}
            onChange={(e) => setQtys({ ...qtys, [i.id]: Math.max(1, Number(e.target.value) || 1) })}
          />
          <button type="button" className="step-in" onClick={() => move(i, 'IN')}>
            <Icon name="up" size={13} /> In
          </button>
          <button type="button" className="step-out" onClick={() => move(i, 'OUT')}>
            <Icon name="down" size={13} /> Out
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon="box"
        eyebrow="Stock levels"
        title="Inventory"
        subtitle="See what is on the shelf, what needs ordering, and record stock coming in or going out."
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3"><Stat label="Units in stock" value={totals.units.toLocaleString('en-IN')} accent={COLORS.teal} icon="stack" hint={`${all.data.length} items`} delay={0} /></div>
        <div className="col-6 col-xl-3"><Stat label="Stock value" value={money(totals.value, cur)} accent={COLORS.navy} icon="coins" hint="At average cost" delay={60} /></div>
        <div className="col-6 col-xl-3"><Stat label="Needs reorder" value={totals.low} accent={COLORS.amber} icon="alert" hint="At or below reorder level" delay={120} /></div>
        <div className="col-6 col-xl-3"><Stat label="Out of stock" value={totals.out} accent={COLORS.coral} icon="down" hint="Zero units" delay={180} /></div>
      </div>

      <div className="row g-4 align-items-start">
        <div className="col-12 col-xl-8">
          <Card title="Stock items" subtitle="Use In or Out to change a quantity. Each change is logged in Movements." delay={120}>
            <div className="d-flex flex-wrap gap-2 align-items-center justify-content-between mb-3">
              <div className="search-wrap" style={{ flex: '1 1 240px', maxWidth: 360 }}>
                <span className="search-icon">
                  <Icon name="search" size={15} />
                </span>
                <input
                  className="form-control"
                  type="search"
                  placeholder="Search name, SKU or category"
                  aria-label="Search items"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
              <div className="seg" role="tablist">
                {FILTERS.map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={filter === key} className={filter === key ? 'is-active' : ''} onClick={() => setFilter(key)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Notice msg={msg} />
            <ErrorNotice text={error} />
            <DataTable rows={items} columns={columns} rowKey={(i) => i.id} empty="No items match this search or filter." emptyIcon="box" minWidth={760} />
          </Card>
        </div>

        <div className="col-12 col-xl-4">
          <Card title="Units by category" subtitle="Where your stock sits right now." delay={180}>
            {byCategory.length ? (
              <ResponsiveContainer width="100%" height={Math.max(220, byCategory.length * 42)}>
                <BarChart data={byCategory} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${Number(v)} units`} cursor={{ fill: 'rgba(15, 23, 42,.04)' }} />
                  <Bar isAnimationActive={false} dataKey="units" radius={[0, 8, 8, 0]} animationDuration={800}>
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted small mb-0">No items yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
