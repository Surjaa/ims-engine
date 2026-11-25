import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import { request } from "../api";
import { useAuth, type AuthUser } from "../auth";
import { applyTheme, getTheme, type ThemeMode } from "../themeMode";
import { SITE_NAME } from "../seoContent";
import { Icon } from "../components/home/Icons";
import "./auth-about.css";

type AuthResult = AuthUser | { twoFactor: true };

const ABOUT = [
  {
    icon: "box",
    title: "Stock levels",
    text: "Quantity for every item, with reorder alerts. A sale that would take stock below zero is refused.",
  },
  {
    icon: "cart",
    title: "Purchases",
    text: "Each purchase adds stock at its price and updates the item’s weighted-average cost.",
  },
  {
    icon: "receipt",
    title: "Sales and invoices",
    text: "Each sale records the cost it was sold at, and invoices can be printed for customers.",
  },
  {
    icon: "wallet",
    title: "Payments and reports",
    text: "Log receipts and supplier payments. Monthly reports show sales, purchases and profit.",
  },
];

const WHY = [
  "Profit you can trust: an old sale keeps the cost it was recorded at.",
  "No negative stock: the database enforces the rule, not only the screen.",
  "Your data stays yours: each account sees only its own records.",
];

declare global {
  interface Window {
    google?: any; // Google Identity Services, loaded only when a client ID is configured
  }
}

export default function SignIn() {
  const { setUser } = useAuth();
  const [step, setStep] = useState<"form" | "2fa">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(getTheme());
  const googleHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = `Sign in | ${SITE_NAME}`;
  }, []);

  useEffect(() => {
    request<{ clientId: string | null }>("/auth/google/config")
      .then((r) => setClientId(r.clientId))
      .catch(() => setClientId(null));
  }, []);

  // A signed-in user always has an id. A pending 2FA step returns only { twoFactor: true }.
  async function run(call: () => Promise<AuthResult>) {
    setBusy(true);
    setError(null);
    try {
      const res = await call();
      if ("id" in res) setUser(res);
      else setStep("2fa");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!clientId || step !== "form") return;
    const render = () => {
      if (!window.google || !googleHost.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (r: { credential: string }) =>
          run(() =>
            request<AuthResult>("/auth/google", "POST", {
              credential: r.credential,
            }),
          ),
      });
      googleHost.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleHost.current, {
        theme: theme === "dark" ? "filled_black" : "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        width: 340,
      });
    };
    if (window.google) return render();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = render;
    document.head.appendChild(s);
  }, [clientId, step, theme]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (step === "2fa")
      return run(() =>
        request<AuthResult>("/auth/2fa/verify", "POST", { code }),
      );
    return run(() =>
      request<AuthResult>("/auth/signin", "POST", { email, password }),
    );
  }

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  return (
    <div className="auth-shell row g-0">
      <section className="col-lg-6 auth-brand-panel">
        <div className="auth-orb orb-teal" aria-hidden="true" />
        <div className="auth-orb orb-amber" aria-hidden="true" />
        <div className="auth-brand-inner">
          <Link
            to="/"
            className="d-inline-flex align-items-center gap-2 fw-bold text-white text-decoration-none"
          >
            <span className="af-icon af-teal" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M3 7l9-4 9 4-9 4-9-4zm0 5l9 4 9-4M3 17l9 4 9-4" />
              </svg>
            </span>
            {SITE_NAME}
          </Link>
          <div className="auth-about mt-4">
            <p className="auth-about-kicker">Inventory management software</p>
            <h2>What IMS Engine does</h2>
            <p className="auth-about-lead">
              IMS Engine keeps stock levels, suppliers, customers, purchases,
              sales, payments and profit reports in one account.
            </p>

            <ul className="auth-about-list">
              {ABOUT.map((a, i) => (
                <li
                  className="auth-about-item"
                  style={{ "--d": `${0.1 + i * 0.08}s` } as CSSProperties}
                  key={a.title}
                >
                  <span className="auth-about-ico" aria-hidden="true">
                    <Icon name={a.icon} />
                  </span>
                  <span>
                    <b>{a.title}</b>
                    {a.text}
                  </span>
                </li>
              ))}
            </ul>

            <h3>Why it matters</h3>
            <ul className="auth-about-why">
              {WHY.map((w, i) => (
                <li
                  style={{ "--d": `${0.5 + i * 0.08}s` } as CSSProperties}
                  key={w}
                >
                  {w}
                </li>
              ))}
            </ul>
          </div>
          <Link to="/" className="auth-back">
            ← Back to home
          </Link>
        </div>
      </section>

      <section className="col-lg-6 auth-panel d-flex align-items-center justify-content-center px-3 py-5 px-md-5">
        <div className="auth-form auth-glass w-100">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h1 className="auth-title">
              {step === "2fa" ? "Enter your code" : "Sign in"}
            </h1>
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? "Switch to light theme"
                  : "Switch to black theme"
              }
              title={theme === "dark" ? "Light theme" : "Black theme"}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>

          {error && (
            <div className="alert alert-danger py-2 small" role="alert">
              {error}
            </div>
          )}

          {step === "form" && clientId && (
            <>
              <div ref={googleHost} className="google-signin-host mb-3" />
              <div className="auth-divider mb-3">or</div>
            </>
          )}

          <form onSubmit={submit} noValidate>
            {step === "2fa" ? (
              <div className="mb-4">
                <label className="form-label fw-semibold" htmlFor="auth-code">
                  Authentication code
                </label>
                <input
                  id="auth-code"
                  className="form-control form-control-lg text-center fs-4"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                />
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <label
                    className="form-label fw-semibold"
                    htmlFor="auth-email"
                  >
                    Email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    className="form-control form-control-lg"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="mb-4">
                  <label
                    className="form-label fw-semibold"
                    htmlFor="auth-password"
                  >
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    className="form-control form-control-lg"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-lg w-100"
              disabled={busy}
            >
              {busy ? "Please wait…" : step === "2fa" ? "Verify" : "Sign in"}
            </button>
          </form>

          {step === "form" && (
            <button
              type="button"
              className="btn btn-outline-secondary btn-lg w-100 mt-3"
              disabled={busy}
              onClick={() =>
                run(() => request<AuthResult>("/auth/demo", "POST"))
              }
            >
              Explore with demo data
            </button>
          )}

          {step === "2fa" && (
            <p className="auth-switch">
              <button
                type="button"
                className="btn btn-link p-0"
                onClick={() => {
                  setStep("form");
                  setCode("");
                  setError(null);
                }}
              >
                Back to sign in
              </button>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
