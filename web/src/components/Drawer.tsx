import type { CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import type { Area, AuthUser } from "../auth";
import { Avatar, Icon } from "./kit";

export const LINKS: [string, string][] = [
  ["/", "Dashboard"],
  ["/inventory", "Inventory"],
  ["/catalogs", "Catalogs"],
  ["/suppliers", "Suppliers"],
  ["/customers", "Customers"],
  ["/purchases", "Purchases"],
  ["/sales", "Sales"],
  ["/receipts", "Receipts"],
  ["/payments", "Payments"],
  ["/movements", "Movements"],
  ["/reports", "Reports"],
  ["/settings", "Settings"],
];

// Which permission area each page needs. 'owner' and 'super' are role checks instead.
const ROUTE_AREA: Record<string, Area | "owner" | "super"> = {
  "/": "dashboard",
  "/inventory": "inventory",
  "/catalogs": "inventory",
  "/builder": "inventory",
  "/suppliers": "parties",
  "/customers": "parties",
  "/purchases": "purchases",
  "/sales": "sales",
  "/receipts": "payments",
  "/payments": "payments",
  "/movements": "movements",
  "/reports": "reports",
  "/settings": "settings",
};

export function canSee(user: AuthUser | null, to: string): boolean {
  if (!user) return false;
  const area = ROUTE_AREA[to];
  if (area === "super") return !!user.isSuper;
  if (area === "owner") return user.role === "owner" || user.role === "super";
  if (user.role === "member") return !!(area && user.permissions?.[area]);
  return true; // owners and the super admin see every area of their own workspace
}

export const visibleLinks = (user: AuthUser | null): [string, string][] =>
  LINKS.filter(([to]) => canSee(user, to));

export function Brand({ company }: { company: string }) {
  return (
    <div className="brand">
      <span className="brand-mark">{company.charAt(0).toUpperCase()}</span>
      <span className="brand-name">{company}</span>
    </div>
  );
}

export function NavLinks({
  onNavigate,
  links = LINKS,
}: {
  onNavigate?: () => void;
  links?: [string, string][];
}) {
  return (
    <nav className="nav-links" aria-label="Main">
      {links.map(([to, label], i) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          onClick={onNavigate}
          className="nav-link-item"
          style={{ "--i": i } as CSSProperties}
        >
          <span className="nav-dot" aria-hidden />
          <span className="nav-text">{label}</span>
          <span className="nav-arrow" aria-hidden>
            →
          </span>
        </NavLink>
      ))}
    </nav>
  );
}

export function AccountBlock({
  name,
  email,
  photo,
  onSignOut,
  onProfile,
}: {
  name: string;
  email: string;
  photo?: string | null;
  onSignOut: () => void;
  onProfile?: () => void;
}) {
  return (
    <div className="account-block">
      {onProfile ? (
        <button
          type="button"
          className="avatar-btn"
          aria-label="Open your profile"
          title="Your profile"
          onClick={onProfile}
        >
          <Avatar name={name} size={38} photo={photo} />
        </button>
      ) : (
        <Avatar name={name} size={38} photo={photo} />
      )}
      <div className="account-text">
        <div className="account-name">{name}</div>
        <div className="account-mail">{email}</div>
      </div>
      <button
        type="button"
        className="icon-btn account-out"
        aria-label="Sign out"
        title="Sign out"
        onClick={onSignOut}
      >
        <Icon name="logout" size={15} />
      </button>
    </div>
  );
}

export function Hamburger({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`hamburger ${open ? "is-open" : ""}`}
      onClick={onToggle}
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      aria-controls="app-drawer"
    >
      <span />
      <span />
      <span />
    </button>
  );
}

export function Drawer({
  open,
  onClose,
  company,
  user,
  onSignOut,
  onProfile,
  links,
}: {
  open: boolean;
  onClose: () => void;
  company: string;
  user: { name: string; email: string; photo?: string | null };
  onSignOut: () => void;
  onProfile?: () => void;
  links?: [string, string][];
}) {
  return (
    <div id="app-drawer" className={`drawer ${open ? "is-open" : ""}`}>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden />
      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal={open}
        aria-label="Main menu"
      >
        <div className="drawer-head">
          <Brand company={company} />
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
        <NavLinks onNavigate={onClose} links={links} />
        <div className="drawer-foot">
          <AccountBlock
            name={user.name}
            email={user.email}
            photo={user.photo}
            onSignOut={onSignOut}
            onProfile={onProfile}
          />
        </div>
      </aside>
    </div>
  );
}
