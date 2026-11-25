import { useEffect, useState, type FormEvent } from "react";
import { request } from "../api";
import { money } from "../lib";
import type { Txn } from "../types";
import { Icon, Notice, type Msg } from "./kit";
import { MorphLoader } from "./MorphLoader";
import "../invoice.css";

interface Props {
  txn: Txn;
  currency: string;
  defaultEmail: string;
  onClose: () => void;
}

export function InvoiceDialog({ txn, currency, defaultEmail, onClose }: Props) {
  const number = `INV-${String(txn.id).padStart(5, "0")}`;
  const [to, setTo] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await request<{ sent_to: string }>(
        `/sales/${txn.id}/invoice/send`,
        "POST",
        { to },
      );
      setMsg({
        type: "success",
        text: `Invoice ${number} sent to ${r.sent_to}`,
      });
    } catch (err) {
      setMsg({ type: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="inv-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inv-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="inv-dialog">
        <div className="inv-head">
          <div>
            <div className="inv-eyebrow">Invoice {number}</div>
            <h2 id="inv-title">{txn.party_name}</h2>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="Close"
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className="inv-sum">
          <span>Total</span>
          <strong>{money(txn.total, currency)}</strong>
        </div>

        <Notice msg={msg} />

        <form onSubmit={send} className="d-grid gap-3">
          <div className="field">
            <label htmlFor="inv-to" className="field-label">
              Send to (email)
            </label>
            <input
              id="inv-to"
              type="email"
              className="form-control"
              required
              placeholder="customer@example.com"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div className="inv-actions">
            <button
              type="button"
              className="btn btn-outline-dark"
              onClick={() =>
                window.open(
                  `/api/sales/${txn.id}/invoice/html`,
                  "_blank",
                  "noopener",
                )
              }
            >
              <Icon name="eye" size={14} /> Open / print
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy && <MorphLoader />}
              {busy ? "Sending…" : "Send invoice"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
