import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { CURRENCIES, findCurrency, type Currency } from '../currencies';

export function Flag({ cc, code }: { cc: string; code: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="cur-flag cur-flag-fallback" aria-hidden>
        {code.slice(0, 2)}
      </span>
    );
  }
  return (
    <img
      className="cur-flag"
      src={`https://flagcdn.com/w40/${cc}.png`}
      srcSet={`https://flagcdn.com/w80/${cc}.png 2x`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function CurrencyPicker({ code, symbol, onChange }: { code?: string; symbol?: string; onChange: (c: Currency) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = findCurrency(code, symbol);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return CURRENCIES;
    return CURRENCIES.filter((c) => `${c.code} ${c.symbol} ${c.name} ${c.country}`.toLowerCase().includes(s));
  }, [q]);

  // Clicking anywhere outside the picker closes its list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (c: Currency) => {
    onChange(c);
    setOpen(false);
    setQ('');
  };

  // Escape closes the list only; the event stops here so the settings dialog stays open.
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="cur-picker" ref={wrapRef} onKeyDown={onKey}>
      <button type="button" className={`cur-trigger ${open ? 'is-open' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Flag key={current.cc} cc={current.cc} code={current.code} />
        <span className="cur-trigger-text">
          <strong>{current.symbol}</strong>
          <span>{current.code}</span>
          <small>{current.country}</small>
        </span>
        <span className="cur-chevron" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="cur-panel">
          <input className="form-control cur-search" placeholder="Search country, currency or code" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <ul className="cur-list" role="listbox" aria-label="Currencies">
            {list.map((c) => {
              const active = c.code === current.code;
              return (
                <li key={c.code}>
                  <button type="button" role="option" aria-selected={active} className={`cur-item ${active ? 'is-active' : ''}`} onClick={() => pick(c)}>
                    <Flag cc={c.cc} code={c.code} />
                    <span className="cur-item-text">
                      <span className="cur-item-country">{c.country}</span>
                      <small>{c.name}</small>
                    </span>
                    <span className="cur-item-symbol">{c.symbol}</span>
                    <span className="cur-item-code">{c.code}</span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="cur-empty">No currency matches "{q}"</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
