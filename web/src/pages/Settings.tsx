import { useEffect, useState, type FormEvent } from "react";
import { MorphLoader } from "../components/MorphLoader";
import { request, useApi } from "../api";
import { useAuth, type AuthUser } from "../auth";
import { CurrencyPicker } from "../components/CurrencyPicker";
import {
  Card,
  Field,
  Icon,
  Notice,
  PageHeader,
  type Msg,
} from "../components/kit";
import { useSettings } from "../context";
import { when } from "../lib";
import type { BackupStatus } from "../types";

function CompanyCard() {
  const { settings, refresh } = useSettings();
  const [draft, setDraft] = useState({
    company_name: "",
    currency: "",
    currency_code: "",
  });
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    setDraft({
      company_name: settings.company_name ?? "",
      currency: settings.currency ?? "",
      currency_code: settings.currency_code ?? "",
    });
  }, [settings]);

  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await request("/settings", "PUT", draft);
      refresh();
      setMsg({ type: "success", text: "Settings saved" });
    } catch (err) {
      setMsg({ type: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Company"
      subtitle="Shown in the header and on printed reports."
      delay={120}
    >
      <Notice msg={msg} />
      <form onSubmit={save} className="row g-3">
        <div className="col-12">
          <Field id="company" label="Company name">
            <input
              id="company"
              className="form-control"
              required
              maxLength={80}
              value={draft.company_name}
              onChange={(e) =>
                setDraft({ ...draft, company_name: e.target.value })
              }
            />
          </Field>
        </div>
        <div className="col-12">
          <Field id="currency" label="Currency">
            <CurrencyPicker
              code={draft.currency_code}
              symbol={draft.currency}
              onChange={(c) =>
                setDraft({
                  ...draft,
                  currency: c.symbol,
                  currency_code: c.code,
                })
              }
            />
          </Field>
        </div>
        <div className="col-12">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? <MorphLoader /> : <Icon name="check" size={15} />} Save
            settings
          </button>
        </div>
      </form>
    </Card>
  );
}

function TwoFactorCard() {
  const { user, setUser } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  if (!user) return null;

  const fail = (err: unknown) =>
    setMsg({ type: "danger", text: (err as Error).message });

  const start = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setSetup(
        await request<{ secret: string; uri: string }>(
          "/auth/2fa/setup",
          "POST",
        ),
      );
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const enable = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await request<AuthUser>("/auth/2fa/enable", "POST", { code });
      setUser(u);
      setSetup(null);
      setCode("");
      setMsg({
        type: "success",
        text: "Two-factor sign-in is on. You will be asked for a code at every sign-in.",
      });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await request<AuthUser>("/auth/2fa/disable", "POST", { code });
      setUser(u);
      setCode("");
      setMsg({ type: "success", text: "Two-factor sign-in is off." });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const copySecret = () => {
    if (setup) navigator.clipboard?.writeText(setup.secret).catch(() => {});
  };

  return (
    <Card
      title="Two-factor sign-in"
      subtitle="Uses Google Authenticator (or any TOTP app) for a 6-digit code at sign-in."
      delay={180}
    >
      <Notice msg={msg} />

      <div className="info-tile mb-3">
        <span className="k">Status</span>
        <span className={`chip ${user.twoFactor ? "chip-ok" : "chip-neutral"}`}>
          {user.twoFactor ? "On" : "Off"}
        </span>
      </div>

      {user.twoFactor ? (
        <form onSubmit={disable} className="d-grid gap-3">
          <Field id="dis-code" label="Enter a current code to turn it off">
            <input
              id="dis-code"
              className="form-control"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <div>
            <button
              className="btn btn-danger-soft"
              type="submit"
              disabled={busy || code.length !== 6}
            >
              Turn off two-factor
            </button>
          </div>
        </form>
      ) : setup ? (
        <div className="d-grid gap-3">
          <ol className="small ps-3 mb-0" style={{ lineHeight: 1.7 }}>
            <li>
              In Google Authenticator tap <strong>+</strong>, then{" "}
              <strong>Enter a setup key</strong>.
            </li>
            <li>Name it "IMS Engine" and paste this key:</li>
          </ol>
          <div className="d-flex gap-2 align-items-stretch">
            <div className="secret-box flex-grow-1">{setup.secret}</div>
            <button
              type="button"
              className="icon-btn"
              aria-label="Copy setup key"
              onClick={copySecret}
            >
              <Icon name="copy" size={15} />
            </button>
          </div>
          <a className="small fw-semibold" href={setup.uri}>
            Or open the setup link on your phone
          </a>
          <form onSubmit={enable} className="d-grid gap-3">
            <Field id="en-code" label="Then enter the 6-digit code it shows">
              <input
                id="en-code"
                className="form-control otp-input"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <div className="d-flex gap-2 flex-wrap">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={busy || code.length !== 6}
              >
                <Icon name="shield" size={15} /> Turn on two-factor
              </button>
              <button
                className="btn btn-outline-dark"
                type="button"
                onClick={() => {
                  setSetup(null);
                  setCode("");
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          className="btn btn-dark"
          type="button"
          onClick={start}
          disabled={busy}
        >
          <Icon name="lock" size={15} /> Set up two-factor
        </button>
      )}
    </Card>
  );
}

function BackupCard() {
  const backup = useApi<BackupStatus>("/backup/status", {
    configured: false,
    auto: false,
    last_backup: null,
  });
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const runBackup = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await request<{ at: string; tabs: number; rows: number }>(
        "/backup",
        "POST",
      );
      setMsg({
        type: "success",
        text: `Backed up ${r.rows} rows across ${r.tabs} tabs to Google Sheets`,
      });
      backup.reload();
    } catch (err) {
      setMsg({ type: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Google Sheets backup"
      subtitle="Every table is copied to its own tab. The app stays the source of truth."
      delay={240}
    >
      <Notice msg={msg} />
      <div className="mb-3">
        <div className="info-tile">
          <span className="k">Connection</span>
          <span
            className={`chip ${backup.data.configured ? "chip-ok" : "chip-neutral"}`}
          >
            {backup.data.configured ? "Configured" : "Not configured"}
          </span>
        </div>
        <div className="info-tile">
          <span className="k">Automatic backup</span>
          <span className="v">
            {backup.data.auto ? "On · 30 s after a change" : "Off"}
          </span>
        </div>
        <div className="info-tile">
          <span className="k">Last backup</span>
          <span className="v">
            {backup.data.last_backup ? when(backup.data.last_backup) : "Never"}
          </span>
        </div>
      </div>

      {!backup.data.configured && (
        <div className="notice notice-info">
          <span className="notice-icon">
            <Icon name="cog" size={13} />
          </span>
          <span>
            Set <code>GOOGLE_SHEET_ID</code> and{" "}
            <code>GOOGLE_APPLICATION_CREDENTIALS</code> in{" "}
            <code>server/.env</code>, then restart the API.
          </span>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary"
        disabled={!backup.data.configured || busy}
        onClick={runBackup}
      >
        {busy ? <MorphLoader /> : <Icon name="up" size={15} />}{" "}
        {busy ? "Backing up…" : "Back up now"}
      </button>
    </Card>
  );
}

export default function Settings() {
  return (
    <>
      <PageHeader
        icon="cog"
        eyebrow="Configuration"
        title="Settings"
        subtitle="Company details, currency, two-factor sign-in and the Google Sheets backup."
      />
      <div className="row g-4 align-items-start">
        <div className="col-12 col-lg-6">
          <CompanyCard />
        </div>
        <div className="col-12 col-lg-6">
          <TwoFactorCard />
          <div className="mt-4">
            <BackupCard />
          </div>
        </div>
      </div>
    </>
  );
}
