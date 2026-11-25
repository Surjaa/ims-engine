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
import { BrandMark } from "../components/BrandMark";
import "./sign-in.css";

type AuthResult = AuthUser | { twoFactor: true };

// The four stages a stock item moves through. "done" and "active" are shown as progress.
const STEPS: { label: string; state: "done" | "active" | "pending" }[] = [
  { label: "Purchase", state: "done" },
  { label: "Stock", state: "done" },
  { label: "Sale", state: "active" },
  { label: "Profit", state: "pending" },
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
    <div className="sg-page">
      <span className="sg-blob b1" aria-hidden="true" />
      <span className="sg-blob b2" aria-hidden="true" />
      <span className="sg-blob b3" aria-hidden="true" />

      <div className="sg-wrap">
        <section className="sg-intro">
          <Link to="/" className="sg-brand" aria-label={`${SITE_NAME} home`}>
            <span className="sg-logo" aria-hidden="true">
              <BrandMark size={56} />
            </span>
            <span>
              <span className="sg-brand-name">{SITE_NAME}</span>
              <span className="sg-brand-sub">
                Inventory Management Software
              </span>
            </span>
          </Link>

          <span className="sg-pill">Inventory control</span>

          <h2 className="sg-title">
            Know what is in stock.
            <span className="sg-grad">Know what each sale really earns.</span>
          </h2>

          <p className="sg-lead">
            IMS Engine tracks stock, purchases, sales and payments in one
            account, and keeps profit accurate.
          </p>

          <ol
            className="sg-steps"
            aria-label="How stock moves through IMS Engine"
          >
            {STEPS.map((s, i) => (
              <li
                key={s.label}
                className={`sg-step ${s.state}`}
                style={{ "--d": `${0.2 + i * 0.12}s` } as CSSProperties}
                aria-current={s.state === "active" ? "step" : undefined}
              >
                <span className="sg-dot">
                  {s.state === "done" ? "✓" : i + 1}
                </span>
                {s.label}
              </li>
            ))}
          </ol>

          <Link to="/" className="sg-back">
            ← Back to home
          </Link>
        </section>

        <section className="sg-card" aria-labelledby="sg-heading">
          <div className="sg-head">
            <div>
              <h1 id="sg-heading">
                {step === "2fa" ? "Enter your code" : "Welcome back"}
              </h1>
              <p className="sg-sub">
                {step === "2fa"
                  ? "Enter the 6-digit code from your authenticator app."
                  : clientId
                    ? "Sign in with your email and password, or continue with Google."
                    : "Sign in with your email and password."}
              </p>
            </div>
            <button
              type="button"
              className="sg-theme"
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
              <div ref={googleHost} className="sg-google-host" />
              <div className="sg-or">or</div>
            </>
          )}

          <form onSubmit={submit} noValidate>
            {step === "2fa" ? (
              <div className="sg-field">
                <label htmlFor="auth-code">Authentication code</label>
                <input
                  id="auth-code"
                  className="sg-input text-center"
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
                <div className="sg-field">
                  <label htmlFor="auth-email">Email</label>
                  <input
                    id="auth-email"
                    type="email"
                    className="sg-input"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="sg-field">
                  <label htmlFor="auth-password">Password</label>
                  <input
                    id="auth-password"
                    type="password"
                    className="sg-input"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </>
            )}
            <button type="submit" className="sg-submit" disabled={busy}>
              {busy ? "Please wait…" : step === "2fa" ? "Verify" : "Sign in"}
            </button>
          </form>

          {step === "form" && (
            <>
              <button
                type="button"
                className="sg-demo"
                disabled={busy}
                onClick={() =>
                  run(() => request<AuthResult>("/auth/demo", "POST"))
                }
              >
                Explore with demo data
              </button>
              <p className="sg-note">
                The demo account has sample items, purchases and sales. Your own
                account is never changed.
              </p>
            </>
          )}

          {step === "2fa" && (
            <p className="sg-note">
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
        </section>
      </div>
    </div>
  );
}
