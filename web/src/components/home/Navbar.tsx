import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../BrandMark';
import { SITE_NAME } from '../../seoContent';

const LINKS: [string, string][] = [
  ['#features', 'Features'],
  ['#modules', 'Modules'],
  ['#profit', 'Profit'],
  ['#how', 'How it works'],
  ['#faq', 'FAQ'],
];

// Full-width bar at the top of the page. After the page scrolls, it becomes a fixed,
// transparent glass pill that is 50% of the viewport wide, centred at the top.
export default function Navbar({ theme, onToggleTheme }: { theme: 'light' | 'dark'; onToggleTheme: () => void }) {
  const [pill, setPill] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setPill(window.scrollY > 120);
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

  useEffect(() => {
    if (!pill) setOpen(false);
  }, [pill]);

  const close = () => setOpen(false);

  return (
    <div className="home-nav-slot">
      <header className={`home-nav ${pill ? 'is-pill' : ''}`}>
        <Link to="/" className="home-brand" aria-label={`${SITE_NAME} home`}>
          <span className="home-logo" aria-hidden="true">
            <BrandMark size={38} />
          </span>
          <span className="home-brand-text">{SITE_NAME}</span>
        </Link>

        <nav className="home-links" aria-label="Page sections">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href}>
              {label}
            </a>
          ))}
        </nav>

        <div className="home-actions">
          <button
            type="button"
            className="home-theme"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to black theme'}
            title={theme === 'dark' ? 'Light theme' : 'Black theme'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <Link to="/signin" className="btn btn-primary home-signin">
            Sign in
          </Link>
          <button
            type="button"
            className={`home-burger ${open ? 'is-open' : ''}`}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="home-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {open && (
          <nav id="home-mobile-menu" className="home-mobile" aria-label="Mobile menu">
            {LINKS.map(([href, label]) => (
              <a key={href} href={href} onClick={close}>
                {label}
              </a>
            ))}
            <Link to="/signin" className="btn btn-primary" onClick={close}>
              Sign in
            </Link>
          </nav>
        )}
      </header>
    </div>
  );
}
