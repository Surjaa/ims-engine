import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { request } from "../api";
import { useAuth, type AuthUser } from "../auth";
import { applyTheme, getTheme, type ThemeMode } from "../themeMode";
import { FAQS, FEATURES, LEAD, SITE_NAME } from "../seoContent";
import { Icon } from "../components/home/Icons";
import { CountUp, useReveal } from "../components/home/Motion";
import Navbar from "../components/home/Navbar";
import Marquee from "../components/home/Marquee";
import Slider, { type Slide } from "../components/home/Slider";
import Footer from "../components/home/Footer";
import "./home.css";

const FEATURE_ICONS = ["box", "tag", "receipt", "chart"];

const SLIDES: Slide[] = [
  {
    icon: "shield",
    title: "Stock never goes below zero",
    text: "A sale or stock-out that would take the quantity below zero is refused, so recorded stock is always zero or more.",
  },
  {
    icon: "cart",
    title: "Average cost on every purchase",
    text: "Each purchase recalculates the item’s weighted-average cost, so the cost you see matches what you paid.",
  },
  {
    icon: "receipt",
    title: "Invoices for every sale",
    text: "Print an invoice for any sale. Send it by email once mail is set up for your account.",
  },
  {
    icon: "gauge",
    title: "Trends on one dashboard",
    text: "See sales for the last 12 months, top customers, and sales by category and city.",
  },
  {
    icon: "settings",
    title: "Two-step sign-in",
    text: "Add a one-time code from an authenticator app to protect your account.",
  },
];

const MODULES = [
  {
    icon: "gauge",
    title: "Dashboard",
    text: "Sales trend for 12 months, top customers, and sales by category and city.",
  },
  {
    icon: "box",
    title: "Inventory",
    text: "Items with SKU, category, prices and reorder levels. Filter for low or out-of-stock items.",
  },
  {
    icon: "list",
    title: "Stock movements",
    text: "A log of every stock change, from purchases and sales, so you can trace any quantity.",
  },
  {
    icon: "cart",
    title: "Purchases",
    text: "Record supplier purchases. Each one updates the item’s weighted-average cost.",
  },
  {
    icon: "receipt",
    title: "Sales and invoices",
    text: "Record sales and print invoices. Send them by email once mail is set up.",
  },
  {
    icon: "wallet",
    title: "Payments",
    text: "Log money received from customers and money paid to suppliers.",
  },
  {
    icon: "users",
    title: "Parties",
    text: "Keep suppliers and customers in one list, with each party’s running balance.",
  },
  {
    icon: "alert",
    title: "Reports",
    text: "Monthly reports for up to 24 months of sales and purchases.",
  },
];

const STEPS = [
  {
    title: "Add items and parties",
    text: "Set up items with SKU, category, price and reorder level. Add your suppliers and customers.",
  },
  {
    title: "Record purchases and sales",
    text: "Purchases add stock at their cost. Sales take stock out and keep the cost for accurate profit.",
  },
  {
    title: "Track stock, money and profit",
    text: "Watch low stock, receipts, payments and monthly trends from one dashboard.",
  },
];

const SEGMENTS = [
  "Shops and retailers",
  "Distributors and wholesalers",
  "Workshops and service centres",
  "Small warehouses",
];

const FEED = [
  {
    type: "Purchase",
    text: "Motherboard A100, 20 units received",
    tone: "primary",
  },
  { type: "Sale", text: "Processor X310, 5 units to a customer", tone: "cyan" },
  { type: "Payment", text: "Receipt from a customer, 12,500", tone: "amber" },
  {
    type: "Reorder",
    text: "Graphic Card G610 is below its reorder level",
    tone: "coral",
  },
  {
    type: "Sale",
    text: "Memory Chip 32GB, 12 units to a customer",
    tone: "cyan",
  },
  {
    type: "Purchase",
    text: "Memory Chip 32GB, 50 units received",
    tone: "primary",
  },
];

const MARQUEE = [
  "Live stock levels",
  "Weighted-average cost",
  "Purchases and sales",
  "Invoices",
  "Payments",
  "Profit reports",
  "Reorder alerts",
  "Two-step sign-in",
];
const MODULE_NAMES = [
  "Dashboard",
  "Inventory",
  "Stock movements",
  "Purchases",
  "Sales and invoices",
  "Payments",
  "Parties",
  "Reports",
  "Settings",
];

const STOCK = [
  { name: "Motherboard A100", pct: 78, qty: 286 },
  { name: "Processor X310", pct: 55, qty: 120 },
  { name: "Graphic Card G610", pct: 34, qty: 74 },
  { name: "Memory Chip 32GB", pct: 90, qty: 410 },
];

const STATS = [
  { to: 24, label: "months in the monthly report" },
  { to: 12, label: "months of sales trend on the dashboard" },
  { to: 8, label: "customers in the demo account" },
  { to: 0, label: "stock can go below zero" },
];

function Section({
  id,
  kicker,
  title,
  sub,
  children,
}: {
  id?: string;
  kicker: string;
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="home-section">
      <div className="reveal">
        <span className="home-kicker">{kicker}</span>
        <h2>{title}</h2>
        {sub && <p className="home-sub">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

export default function Home() {
  const { setUser } = useAuth();
  const root = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<ThemeMode>(getTheme());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useReveal(root);

  useEffect(() => {
    document.title = `${SITE_NAME}: Inventory Management Software`;
  }, []);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduce) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 2600);
    return () => window.clearInterval(id);
  }, []);

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      const u = await request<AuthUser | { twoFactor: true }>(
        "/auth/demo",
        "POST",
      );
      if ("id" in u) setUser(u);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Newest activity first. Each new row mounts with its own entrance animation.
  const feedRows = [0, 1, 2, 3].map((i) => {
    const idx = tick - i;
    return {
      key: idx,
      item: FEED[((idx % FEED.length) + FEED.length) % FEED.length],
    };
  });

  return (
    <div className="home" ref={root}>
      <Navbar theme={theme} onToggleTheme={toggleTheme} />

      <main>
        <section className="home-hero">
          <span className="home-orb o1" aria-hidden="true" />
          <span className="home-orb o2" aria-hidden="true" />
          <span className="home-orb o3" aria-hidden="true" />

          <div className="home-hero-copy">
            <span className="home-eyebrow">Inventory management software</span>
            <h1>
              Inventory management software{" "}
              <span className="home-grad">for stock, purchases and sales</span>
            </h1>
            <p className="home-lead">{LEAD}</p>
            <div className="home-cta">
              <Link to="/signin" className="btn btn-primary btn-lg home-btn">
                Sign in
              </Link>
              <button
                type="button"
                className="btn btn-outline-secondary btn-lg home-btn"
                onClick={demo}
                disabled={busy}
              >
                {busy ? "Opening demo…" : "Explore with demo data"}
              </button>
            </div>
          </div>

          <div className="home-visual" aria-hidden="true">
            <div className="home-stock home-glass">
              <div className="home-stock-head">
                <b>Stock on hand</b>
                <span className="home-ok">Never below zero</span>
              </div>
              {STOCK.map((s, i) => (
                <div className="home-stock-row" key={s.name}>
                  <div className="home-stock-line">
                    <span>{s.name}</span>
                    <b>{s.qty}</b>
                  </div>
                  <div className="home-bar">
                    <span
                      style={{
                        width: `${s.pct}%`,
                        animationDelay: `${0.3 + i * 0.12}s`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="home-feed home-glass">
              <div className="home-feed-head">Live activity</div>
              {feedRows.map(({ key, item }) => (
                <div className="home-feed-row" key={key}>
                  <span className={`home-tag tone-${item.tone}`}>
                    {item.type}
                  </span>
                  <span className="home-feed-text">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Marquee items={MARQUEE} />

        <div className="home-stats">
          {STATS.map((s, i) => (
            <div
              className="home-stat home-glass reveal-zoom"
              style={delay(i * 90)}
              key={s.label}
            >
              <b>
                <CountUp to={s.to} />
              </b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        <Section
          id="features"
          kicker="Features"
          title="Everything stock-keeping needs, in one place"
          sub="One account holds your items, suppliers, customers, purchases, sales and money. Each figure is calculated from the same records."
        >
          <div className="home-grid">
            {FEATURES.map((f, i) => (
              <div className="reveal" style={delay(i * 90)} key={f.title}>
                <article className="home-card">
                  <span className="home-ico-wrap">
                    <Icon name={FEATURE_ICONS[i]} />
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="highlights"
          kicker="Highlights"
          title="Rules that keep your numbers right"
          sub="These checks run in the database itself, so they hold for every page and every user."
        >
          <div className="reveal-zoom">
            <Slider slides={SLIDES} />
          </div>
        </Section>

        <Section
          id="modules"
          kicker="Modules"
          title="Eight pages, one connected record"
          sub="Every page reads from the same stock and money records, so a sale on one page shows up on the dashboard and the reports."
        >
          <div className="home-grid">
            {MODULES.map((m, i) => (
              <div
                className={i % 2 ? "reveal-right" : "reveal-left"}
                style={delay((i % 4) * 90)}
                key={m.title}
              >
                <article className="home-card home-card-sm">
                  <span className="home-ico-wrap sm">
                    <Icon name={m.icon} />
                  </span>
                  <h3>{m.title}</h3>
                  <p>{m.text}</p>
                </article>
              </div>
            ))}
          </div>
        </Section>

        <Marquee items={MODULE_NAMES} reverse variant="chips" />

        <Section
          id="profit"
          kicker="Profit"
          title="Profit uses the cost each item had when it sold"
          sub="A purchase at a new price changes the average cost. Earlier sales keep the cost they were recorded at, so old profit figures never change."
        >
          <div className="home-profit">
            <div className="reveal-left home-glass home-table-wrap">
              <table className="home-table">
                <caption className="home-caption">
                  Example: one item, two purchases, one sale
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Step</th>
                    <th scope="col">Units</th>
                    <th scope="col">Cost each</th>
                    <th scope="col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Purchase 1</td>
                    <td>10</td>
                    <td>100</td>
                    <td>1,000</td>
                  </tr>
                  <tr>
                    <td>Purchase 2</td>
                    <td>10</td>
                    <td>120</td>
                    <td>1,200</td>
                  </tr>
                  <tr>
                    <td>Average cost now</td>
                    <td>20</td>
                    <td>110</td>
                    <td>2,200</td>
                  </tr>
                  <tr>
                    <td>Sale at 150 each</td>
                    <td>5</td>
                    <td>110</td>
                    <td>550</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Profit on the sale: (150 − 110) × 5</td>
                    <td>200</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <ul className="home-checks">
              {[
                "Each purchase updates the item’s average cost automatically.",
                "Each sale stores the unit cost at the moment it happens.",
                "Profit is the sale price minus that stored cost.",
                "A sale that would take stock below zero is refused.",
              ].map((t, i) => (
                <li className="reveal-right" style={delay(i * 110)} key={t}>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <Section
          id="how"
          kicker="How it works"
          title="Three steps from first item to clear profit"
          sub="Start with the demo data to see every page, then replace it with your own items, parties and records."
        >
          <ol className="home-steps">
            {STEPS.map((s, i) => (
              <li
                className="reveal home-step"
                style={delay(i * 120)}
                key={s.title}
              >
                <span className="home-step-num">{i + 1}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section
          kicker="Who it is for"
          title="Built for businesses that buy and sell stock"
        >
          <div className="home-chips">
            {SEGMENTS.map((s, i) => (
              <span
                className="home-chip reveal-zoom"
                style={delay(i * 80)}
                key={s}
              >
                {s}
              </span>
            ))}
          </div>
        </Section>

        <Section id="faq" kicker="FAQ" title="Frequently asked questions">
          <div className="home-faq">
            {FAQS.map((f, i) => (
              <details className="reveal" style={delay(i * 60)} key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        <div className="home-cta-wrap reveal-zoom">
          <div className="home-cta-band">
            <div>
              <h2>See your stock clearly today</h2>
              <p>
                Sign in to your account, or open the demo with sample data
                first.
              </p>
            </div>
            <div className="home-cta">
              <Link to="/signin" className="btn btn-light btn-lg home-btn">
                Sign in
              </Link>
              <button
                type="button"
                className="btn btn-outline-light btn-lg home-btn"
                onClick={demo}
                disabled={busy}
              >
                {busy ? "Opening demo…" : "Explore demo"}
              </button>
            </div>
          </div>
          {error && (
            <p className="home-error small mt-3 text-center">{error}</p>
          )}
        </div>
      </main>

      <Footer onDemo={demo} busy={busy} />
    </div>
  );
}
