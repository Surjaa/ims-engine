import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { MorphLoader } from "./MorphLoader";
import { useNavigate } from "react-router-dom";
import { request } from "../api";
import { useAuth, type AuthUser } from "../auth";
import { useSettings } from "../context";
import { Avatar, Field, Icon, Notice, type Msg } from "./kit";

type Form = {
  name: string;
  email: string;
  phone: string;
  title: string;
  company: string;
};

function toForm(u: AuthUser, workspace: string): Form {
  return {
    name: u.name,
    email: u.email,
    phone: u.phone ?? "",
    title: u.title ?? "",
    company: workspace,
  };
}

/** Crops an image to a square and returns a small JPEG data URL. */
function readPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () =>
        reject(new Error("That file is not a supported image"));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx)
          return reject(
            new Error("Image editing is not supported in this browser"),
          );
        const side = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          size,
          size,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function UserModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, setUser, signOut } = useAuth();
  const { settings, refresh } = useSettings();
  const navigate = useNavigate();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Form>({
    name: "",
    email: "",
    phone: "",
    title: "",
    company: "",
  });
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  // Escape closes the dialog while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Lock page scroll while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Start from the saved values each time the dialog opens.
  useEffect(() => {
    if (open && user) {
      setForm(toForm(user, settings.company_name || user.company));
      setMsg(null);
      setPwOpen(false);
      setPwMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !user) return null;

  const workspace = settings.company_name || user.company;
  const saved = toForm(user, workspace);
  const dirty = (Object.keys(saved) as (keyof Form)[]).some(
    (k) => form[k] !== saved[k],
  );

  const checks = [
    ...(user.demo
      ? []
      : [
          {
            label: "Password protected",
            hint: "Your password is stored as a salted hash",
            ok: true,
          },
        ]),
    {
      label: "Two-factor sign-in",
      hint: user.twoFactor
        ? "Sign-in asks for a code from your authenticator app"
        : "Add Google Authenticator in Settings",
      ok: !!user.twoFactor,
    },
  ];
  const done = checks.filter((c) => c.ok).length;
  const pct = Math.round((done / checks.length) * 100);

  const set = (k: keyof Form) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      setUser(await request<AuthUser>("/auth/profile", "POST", form));
      refresh();
      setMsg({ type: "success", text: "Profile saved" });
    } catch (err) {
      setMsg({ type: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMsg({ type: "danger", text: "Choose an image file" });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const photo = await readPhoto(file);
      setUser(await request<AuthUser>("/auth/profile", "POST", { photo }));
      setMsg({ type: "success", text: "Photo updated" });
    } catch (err) {
      setMsg({ type: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const removePhoto = async () => {
    setBusy(true);
    setMsg(null);
    try {
      setUser(
        await request<AuthUser>("/auth/profile", "POST", { photo: null }),
      );
      setMsg({ type: "success", text: "Photo removed" });
    } catch (err) {
      setMsg({ type: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pw.next !== pw.confirm) {
      setPwMsg({ type: "danger", text: "The new passwords do not match" });
      return;
    }
    setBusy(true);
    setPwMsg(null);
    try {
      await request("/auth/password", "POST", {
        current: pw.current,
        next: pw.next,
      });
      setPw({ current: "", next: "", confirm: "" });
      setPwOpen(false);
      setMsg({ type: "success", text: "Password changed" });
    } catch (err) {
      setPwMsg({ type: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const openSettings = () => {
    onClose();
    navigate("/settings");
  };

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-dialog profile-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-title"
      >
        <div className="profile-hero">
          <button
            type="button"
            className="modal-close profile-close"
            aria-label="Close profile"
            onClick={onClose}
          >
            ×
          </button>
          <div className="profile-hero-inner">
            <div className="profile-avatar-wrap">
              <span className="profile-avatar">
                <Avatar name={user.name} size={84} photo={user.photo} />
              </span>
              <button
                type="button"
                className="profile-cam"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
              >
                Edit
              </button>
            </div>
            <div className="profile-id">
              <h2 id="user-title" className="profile-name">
                {user.name}
              </h2>
              <div className="profile-email">{user.email}</div>
              <div className="profile-tags">
                <span className="profile-tag">{workspace}</span>
                {user.demo && <span className="profile-tag">Sample data</span>}
              </div>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPhoto}
          />
        </div>

        <div className="profile-body">
          <section className="profile-section">
            <div className="profile-section-head">
              <h4>Personal details</h4>
              {dirty && <span className="profile-dirty">Unsaved changes</span>}
            </div>

            <Notice msg={msg} />

            <div className="profile-photo-row">
              <span className="profile-photo-preview">
                <Avatar name={user.name} size={64} photo={user.photo} />
              </span>
              <div className="d-flex gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-dark"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                >
                  <Icon name="up" size={14} />{" "}
                  {user.photo ? "Change photo" : "Upload photo"}
                </button>
                {user.photo && (
                  <button
                    type="button"
                    className="btn btn-danger-soft"
                    onClick={removePhoto}
                    disabled={busy}
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <div className="profile-photo-hint">
                Any image works. It is cropped to a square.
              </div>
            </div>

            <form onSubmit={saveProfile} className="row g-3">
              <div className="col-12 col-md-6">
                <Field id="pf-name" label="Full name">
                  <input
                    id="pf-name"
                    className="form-control"
                    required
                    maxLength={80}
                    value={form.name}
                    onChange={set("name")}
                  />
                </Field>
              </div>
              <div className="col-12 col-md-6">
                <Field id="pf-email" label="Email (sign-in ID)">
                  <input
                    id="pf-email"
                    type="email"
                    className="form-control"
                    required
                    maxLength={120}
                    value={form.email}
                    onChange={set("email")}
                    disabled={!!user.demo}
                  />
                </Field>
              </div>
              <div className="col-12 col-md-6">
                <Field id="pf-phone" label="Phone">
                  <input
                    id="pf-phone"
                    className="form-control"
                    inputMode="tel"
                    maxLength={20}
                    value={form.phone}
                    onChange={set("phone")}
                  />
                </Field>
              </div>
              <div className="col-12 col-md-6">
                <Field id="pf-title" label="Job title">
                  <input
                    id="pf-title"
                    className="form-control"
                    maxLength={80}
                    value={form.title}
                    onChange={set("title")}
                  />
                </Field>
              </div>
              <div className="col-12">
                <Field id="pf-company" label="Workspace name">
                  <input
                    id="pf-company"
                    className="form-control"
                    required
                    maxLength={80}
                    value={form.company}
                    onChange={set("company")}
                  />
                </Field>
              </div>
              <div className="col-12 d-flex gap-2 flex-wrap">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!dirty || busy}
                >
                  {busy ? <MorphLoader /> : <Icon name="check" size={15} />}{" "}
                  {busy ? "Saving…" : "Save changes"}
                </button>
                {dirty && (
                  <button
                    type="button"
                    className="btn btn-outline-dark"
                    disabled={busy}
                    onClick={() => setForm(saved)}
                  >
                    Discard
                  </button>
                )}
              </div>
            </form>
          </section>

          <section className="profile-section">
            <div className="profile-section-head">
              <h4>
                <Icon name="shield" size={13} /> Security
              </h4>
              <span className="profile-score">
                {done} of {checks.length} complete
              </span>
            </div>
            <div
              className="profile-meter"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <span style={{ width: `${pct}%` }} />
            </div>
            <ul className="profile-checks">
              {checks.map((c) => (
                <li key={c.label} className={c.ok ? "is-ok" : "is-todo"}>
                  <span className="profile-check-icon">
                    <Icon name={c.ok ? "check" : "lock"} size={14} />
                  </span>
                  <span>
                    <strong>{c.label}</strong>
                    <small>{c.hint}</small>
                  </span>
                  {!c.ok && <span className="profile-todo">To do</span>}
                </li>
              ))}
            </ul>

            <div className="profile-sec-actions">
              <button
                type="button"
                className="btn btn-outline-dark"
                onClick={openSettings}
              >
                <Icon name="cog" size={15} /> Two-factor in Settings
              </button>
              {!user.demo && (
                <button
                  type="button"
                  className="btn btn-outline-dark"
                  onClick={() => setPwOpen((o) => !o)}
                >
                  <Icon name="lock" size={15} />{" "}
                  {pwOpen ? "Close password form" : "Change password"}
                </button>
              )}
            </div>
            {user.demo && (
              <div className="profile-photo-hint mt-2">
                Sample accounts sign in without a password.
              </div>
            )}

            {pwOpen && !user.demo && (
              <form onSubmit={changePassword} className="profile-pw">
                <Notice msg={pwMsg} />
                <Field id="pw-cur" label="Current password">
                  <input
                    id="pw-cur"
                    type="password"
                    autoComplete="current-password"
                    className="form-control"
                    required
                    value={pw.current}
                    onChange={(e) => setPw({ ...pw, current: e.target.value })}
                  />
                </Field>
                <Field id="pw-new" label="New password (at least 8 characters)">
                  <input
                    id="pw-new"
                    type="password"
                    autoComplete="new-password"
                    className="form-control"
                    required
                    minLength={8}
                    value={pw.next}
                    onChange={(e) => setPw({ ...pw, next: e.target.value })}
                  />
                </Field>
                <Field id="pw-con" label="Confirm new password">
                  <input
                    id="pw-con"
                    type="password"
                    autoComplete="new-password"
                    className="form-control"
                    required
                    minLength={8}
                    value={pw.confirm}
                    onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
                  />
                </Field>
                <div>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={busy}
                  >
                    <Icon name="check" size={15} /> Update password
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <div className="profile-foot">
          <button
            type="button"
            className="btn btn-danger-soft"
            onClick={() => {
              onClose();
              signOut();
            }}
          >
            <Icon name="logout" size={15} /> Sign out
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
