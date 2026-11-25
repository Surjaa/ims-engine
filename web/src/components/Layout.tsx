import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth";
import { useSettings } from "../context";
import { dayLabel, todayYmd } from "../lib";
import {
  AccountBlock,
  Brand,
  Drawer,
  Hamburger,
  NavLinks,
  visibleLinks,
} from "./Drawer";
import { Avatar } from "./kit";
import UserModal from "./UserModal";
import { applyTheme, getTheme, type ThemeMode } from "../themeMode";

const SunIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export default function Layout() {
  const { settings } = useSettings();
  const { user, signOut } = useAuth();
  const company = settings.company_name || user?.company || "IMS Engine";
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(getTheme);

  const toggleTheme = () => {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  };

  // Any route change (including a link click) closes the drawer.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes it and page scroll is locked while it is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const who = {
    name: user?.name ?? "Account",
    email: user?.email ?? "",
    photo: user?.photo ?? null,
  };
  const links = visibleLinks(user);

  return (
    <>
      <aside className="sidebar d-none d-lg-flex">
        <Brand company={company} />
        <NavLinks links={links} />
        <div className="sidebar-foot">
          <AccountBlock
            name={who.name}
            email={who.email}
            photo={who.photo}
            onSignOut={signOut}
            onProfile={() => setProfileOpen(true)}
          />
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="d-flex align-items-center gap-3">
            <div className="d-lg-none">
              <Hamburger open={open} onToggle={() => setOpen((o) => !o)} />
            </div>
            <span className="topbar-brand d-lg-none">{company}</span>
            <span className="topbar-date d-none d-md-inline">
              {dayLabel(todayYmd())}
            </span>
          </div>
          <div className="d-flex align-items-center gap-2">
            <span className="topbar-company d-none d-md-inline">{company}</span>
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
              {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              type="button"
              className="avatar-btn"
              aria-label="Open your profile"
              title="Your profile"
              onClick={() => setProfileOpen(true)}
            >
              <Avatar name={who.name} size={36} photo={who.photo} />
            </button>
          </div>
        </header>

        <main key={pathname} className="page-enter">
          <Outlet />
        </main>
      </div>

      <Drawer
        links={links}
        open={open}
        onClose={() => setOpen(false)}
        company={company}
        user={who}
        onSignOut={signOut}
        onProfile={() => {
          setOpen(false);
          setProfileOpen(true);
        }}
      />

      <UserModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
