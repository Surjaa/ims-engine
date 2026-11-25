import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './Icons';
import { BrandMark } from '../BrandMark';
import { SITE_NAME } from '../../seoContent';

type Col = { id: string; title: string; links: { label: string; href?: string; to?: string }[] };

const COLS: Col[] = [
  {
    id: 'product',
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Highlights', href: '#highlights' },
      { label: 'Modules', href: '#modules' },
      { label: 'Profit', href: '#profit' },
      { label: 'How it works', href: '#how' },
    ],
  },
  {
    id: 'help',
    title: 'Help',
    links: [{ label: 'FAQ', href: '#faq' }],
  },
  {
    id: 'account',
    title: 'Account',
    links: [{ label: 'Sign in', to: '/signin' }],
  },
];

export default function Footer({ onDemo, busy }: { onDemo: () => void; busy: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setShowTop(window.scrollY > 600);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const toTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  return (
    <>
      <footer className="home-footer">
        <div className="home-footer-card home-glass reveal-zoom">
          <div className="home-footer-top">
            <div className="home-footer-brand reveal-left">
              <span className="home-logo" aria-hidden="true">
                <BrandMark size={38} />
              </span>
              <p className="home-footer-word">{SITE_NAME}</p>
              <p className="home-footer-tag">Inventory management for stock, purchases, sales, payments and profit.</p>
              <button type="button" className="btn btn-primary home-btn" onClick={onDemo} disabled={busy}>
                {busy ? 'Opening demo…' : 'Explore with demo data'}
              </button>
            </div>

            <div className="home-footer-cols">
              {COLS.map((c, i) => {
                const isOpen = openId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`home-fcol reveal-right ${isOpen ? 'is-open' : ''}`}
                    style={{ '--d': `${i * 110}ms` } as CSSProperties}
                  >
                    <button
                      type="button"
                      className="home-fcol-title"
                      aria-expanded={isOpen}
                      aria-controls={`fcol-${c.id}`}
                      onClick={() => setOpenId(isOpen ? null : c.id)}
                    >
                      {c.title}
                      <span className="home-chev" aria-hidden="true">
                        <Icon name="chevron" />
                      </span>
                    </button>
                    <ul id={`fcol-${c.id}`} className="home-fcol-list">
                      {c.links.map((l) => (
                        <li key={l.label}>
                          {l.to ? <Link to={l.to}>{l.label}</Link> : <a href={l.href}>{l.label}</a>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="home-footer-bar">
            <span>
              © {new Date().getFullYear()} {SITE_NAME}. Each account sees only its own data.
            </span>
            <button type="button" className="home-totop-inline" onClick={toTop}>
              Back to top
              <Icon name="arrowUp" />
            </button>
          </div>
        </div>
      </footer>

      <button
        type="button"
        className={`home-totop ${showTop ? 'is-shown' : ''}`}
        onClick={toTop}
        aria-label="Back to top"
        tabIndex={showTop ? 0 : -1}
      >
        <Icon name="arrowUp" />
      </button>
    </>
  );
}
