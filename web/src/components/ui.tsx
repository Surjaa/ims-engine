import type { ReactNode } from 'react';
import { createUseStyles } from 'react-jss';
import type { Status } from '../types';

const useStyles = createUseStyles({
  band: {
    padding: '4.5rem 0',
    '@media (max-width: 575.98px)': { padding: '2.75rem 0' },
  },
  dark: { background: '#010B13', color: '#EBF1F5' },
  light: { background: '#EBF1F5', color: '#0D0A1F' },
  heading: {
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    letterSpacing: '-0.045em',
    lineHeight: 0.95,
    fontSize: 'clamp(2.25rem, 6vw, 4.5rem)',
    margin: '0.75rem 0 1.5rem',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    border: '1px solid currentColor',
    borderRadius: 999,
    padding: '0.4rem 1rem',
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  panel: {
    background: '#fff',
    border: '1px solid #CBD5E1',
    borderRadius: 28,
    padding: '1.5rem',
    height: '100%',
  },
  stat: {
    border: '1px solid #1E2A35',
    borderRadius: 24,
    padding: '1.25rem',
    height: '100%',
  },
  statValue: {
    fontFamily: 'var(--font-display)',
    fontWeight: 900,
    fontSize: 'clamp(1.8rem, 4.5vw, 3rem)',
    letterSpacing: '-0.04em',
    lineHeight: 1,
    marginTop: '1rem',
    fontVariantNumeric: 'tabular-nums',
    wordBreak: 'break-word',
  },
  track: { height: 10, borderRadius: 999, background: '#DCE4EA', overflow: 'hidden' },
  fill: { height: '100%', background: '#010B13', borderRadius: 999 },
});

export function Band({ tone, children }: { tone: 'light' | 'dark'; children: ReactNode }) {
  const c = useStyles();
  return (
    <section className={`${c.band} ${tone === 'dark' ? c.dark : c.light}`}>
      <div className="container">{children}</div>
    </section>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const c = useStyles();
  return <h2 className={c.heading}>{children}</h2>;
}

export function Pill({ children }: { children: ReactNode }) {
  const c = useStyles();
  return <span className={c.pill}>{children}</span>;
}

export function Panel({ children }: { children: ReactNode }) {
  const c = useStyles();
  return <div className={c.panel}>{children}</div>;
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  const c = useStyles();
  return (
    <div className={c.stat}>
      <Pill>{label}</Pill>
      <div className={c.statValue}>{value}</div>
    </div>
  );
}

export function Bar({ value, max }: { value: number; max: number }) {
  const c = useStyles();
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={c.track}>
      <div className={c.fill} style={{ width: `${pct}%` }} />
    </div>
  );
}

const STATUS_COLOR: Record<Status, string> = { OK: '#1C7A50', LOW: '#9A6510', OUT: '#B3372A' };
const STATUS_LABEL: Record<Status, string> = { OK: 'In stock', LOW: 'Reorder', OUT: 'Out' };

export function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className="badge rounded-pill bg-transparent border"
      style={{ color: STATUS_COLOR[status], borderColor: 'currentColor' }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
