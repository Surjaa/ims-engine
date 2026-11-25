import { useState, type CSSProperties, type ReactNode } from 'react';
import { statusOf } from '../lib';
import type { Item, Status } from '../types';

export type Msg = { type: 'success' | 'danger' | 'info'; text: string } | null;

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  box: 'M3 7l9-4 9 4-9 4-9-4zM3 7v10l9 4 9-4V7M12 11v10',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4.2-4.2',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M5 12l7 7 7-7',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  alert: 'M12 8v5M12 16.5v.5M10.3 3.9L2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  print: 'M7 9V3h10v6M7 17H4V9h16v8h-3M7 14h10v7H7z',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  cart: 'M3 4h2l2.5 11h10L20 7H6M9 19a1 1 0 1 0 0 .01M17 19a1 1 0 1 0 0 .01',
  users: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 19v-1a3 3 0 0 0-2.5-3M15 4.3a3.5 3.5 0 0 1 0 6.4',
  cog: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4',
  stack: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5',
  coins: 'M12 3a8 4 0 1 0 0 8 8 4 0 0 0 0-8zM4 7v5c0 2.2 3.6 4 8 4s8-1.8 8-4V7M4 12v5c0 2.2 3.6 4 8 4s8-1.8 8-4v-5',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z',
  shield: 'M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z',
  mail: 'M4 6h16v12H4zM4 7l8 6 8-6',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function PageHeader({ eyebrow, title, subtitle, actions, icon }: { eyebrow?: string; title: string; subtitle?: string; actions?: ReactNode; icon?: IconName }) {
  return (
    <header className="page-header">
      <div className="page-header-main">
        {icon && (
          <span className="page-icon" aria-hidden>
            <Icon name={icon} size={22} />
          </span>
        )}
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-sub">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, subtitle, actions, children, className = '', delay = 0 }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string; delay?: number }) {
  return (
    <section className={`card-surface ${className}`} style={{ animationDelay: `${delay}ms` } as CSSProperties}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-sub">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

const NOTICE_ICON: Record<'success' | 'danger' | 'info', IconName> = { success: 'check', danger: 'alert', info: 'sparkle' };

export function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <div className={`notice notice-${msg.type}`} role="status">
      <span className="notice-icon">
        <Icon name={NOTICE_ICON[msg.type]} size={14} />
      </span>
      <span>{msg.text}</span>
    </div>
  );
}

export function ErrorNotice({ text }: { text: string | null }) {
  return text ? <Notice msg={{ type: 'danger', text }} /> : null;
}

export function Field({ id, label, children, className = '' }: { id?: string; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label htmlFor={id} className="field-label">{label}</label>
      {children}
    </div>
  );
}

export function Empty({ text, icon = 'box' }: { text: string; icon?: IconName }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={26} />
      <span>{text}</span>
    </div>
  );
}

export function Stat({ label, value, hint, accent, icon, delay = 0 }: { label: string; value: ReactNode; hint?: string; accent: string; icon: IconName; delay?: number }) {
  return (
    <div className="stat-tile" style={{ '--kpi-accent': accent, animationDelay: `${delay}ms` } as CSSProperties}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          <Icon name={icon} size={16} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

const STATUS_CHIP: Record<Status, { cls: string; label: string }> = {
  OK: { cls: 'chip-ok', label: 'In stock' },
  LOW: { cls: 'chip-low', label: 'Reorder' },
  OUT: { cls: 'chip-out', label: 'Out of stock' },
};

export function StatusChip({ item }: { item: Pick<Item, 'qty' | 'reorder_level'> }) {
  const s = STATUS_CHIP[statusOf(item)];
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export function Sku({ children }: { children: ReactNode }) {
  return <span className="sku">{children}</span>;
}

export function Avatar({ name, size = 36, photo }: { name: string; size?: number; photo?: string | null }) {
  if (photo) {
    return <img src={photo} alt="" className="avatar-photo" style={{ width: size, height: size }} />;
  }
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || 'U';
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }} aria-hidden>
      {initials}
    </span>
  );
}

export interface Column<T> {
  key: string;
  header: string;
  align?: 'start' | 'center' | 'end';
  render: (row: T) => ReactNode;
}

const TABLE_PAGE = 50;

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  emptyIcon,
  minWidth = 620,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  empty: string;
  emptyIcon?: IconName;
  minWidth?: number;
}) {
  // Render in pages so editing a form on the same screen does not re-render every row.
  const [limit, setLimit] = useState(TABLE_PAGE);
  if (!rows.length) return <Empty text={empty} icon={emptyIcon} />;
  const shown = rows.length > limit ? rows.slice(0, limit) : rows;
  return (
    <>
    <div className="table-shell">
      <table className="ims-table" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`text-${c.align ?? 'start'}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r, i) => (
            <tr key={rowKey(r)} style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              {columns.map((c) => (
                <td key={c.key} className={`text-${c.align ?? 'start'}`}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    {rows.length > limit && (
      <div className="table-more">
        <span>Showing {shown.length} of {rows.length}</span>
        <button type="button" className="btn btn-outline-dark" onClick={() => setLimit((l) => l + TABLE_PAGE)}>
          Show {Math.min(TABLE_PAGE, rows.length - limit)} more
        </button>
      </div>
    )}
    </>
  );
}
