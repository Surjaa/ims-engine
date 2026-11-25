import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./auth";
import { SettingsProvider } from "./context";
import Catalogs from "./pages/Catalogs";
import Dashboard from "./pages/Dashboard";
import Inventory from "./pages/Inventory";
import Movements from "./pages/Movements";
import Parties from "./pages/Parties";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Transactions from "./pages/Transactions";
import { canSee, visibleLinks } from "./components/Drawer";

// Opens a page only when the user's role or permissions allow it; otherwise sends them to their first allowed page.
function Guard({ to, children }: { to: string; children: ReactNode }) {
  const { user } = useAuth();
  if (canSee(user, to)) return <>{children}</>;
  const first = visibleLinks(user)[0]?.[0];
  if (!first || first === to)
    return (
      <p className="p-4 text-muted">You do not have access to this page.</p>
    );
  return <Navigate to={first} replace />;
}
import { MorphLoader } from "./components/MorphLoader";
import SignIn from "./pages/SignIn";
import Home from "./pages/Home";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash">
        <MorphLoader size={48} />
        <span className="splash-text">Loading IMS Engine…</span>
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <SettingsProvider key={user.id}>
      <Routes>
        <Route path="/signin" element={<Navigate to="/" replace />} />
        <Route element={<Layout />}>
          <Route
            index
            element={
              <Guard to="/">
                <Dashboard />
              </Guard>
            }
          />
          <Route
            path="inventory"
            element={
              <Guard to="/inventory">
                <Inventory />
              </Guard>
            }
          />
          <Route
            path="catalogs"
            element={
              <Guard to="/catalogs">
                <Catalogs />
              </Guard>
            }
          />
          <Route
            path="suppliers"
            element={
              <Guard to="/suppliers">
                <Parties kind="supplier" />
              </Guard>
            }
          />
          <Route
            path="customers"
            element={
              <Guard to="/customers">
                <Parties kind="customer" />
              </Guard>
            }
          />
          <Route
            path="purchases"
            element={
              <Guard to="/purchases">
                <Transactions kind="purchase" />
              </Guard>
            }
          />
          <Route
            path="sales"
            element={
              <Guard to="/sales">
                <Transactions kind="sale" />
              </Guard>
            }
          />
          <Route
            path="receipts"
            element={
              <Guard to="/receipts">
                <Payments direction="receipt" />
              </Guard>
            }
          />
          <Route
            path="payments"
            element={
              <Guard to="/payments">
                <Payments direction="payment" />
              </Guard>
            }
          />
          <Route
            path="movements"
            element={
              <Guard to="/movements">
                <Movements />
              </Guard>
            }
          />
          <Route
            path="reports"
            element={
              <Guard to="/reports">
                <Reports />
              </Guard>
            }
          />
          <Route
            path="settings"
            element={
              <Guard to="/settings">
                <Settings />
              </Guard>
            }
          />
          <Route
            path="*"
            element={
              <Guard to="/">
                <Dashboard />
              </Guard>
            }
          />
        </Route>
      </Routes>
    </SettingsProvider>
  );
}
