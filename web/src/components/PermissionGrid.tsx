import type { Area, Level } from "../auth";
import "../access.css";

export const AREA_LABELS: [Area, string][] = [
  ["dashboard", "Dashboard"],
  ["inventory", "Inventory & catalogs"],
  ["parties", "Suppliers & customers"],
  ["purchases", "Purchases"],
  ["sales", "Sales & invoices"],
  ["payments", "Receipts & payments"],
  ["movements", "Movements"],
  ["reports", "Reports"],
  ["settings", "Settings & backup"],
];

export type PermValue = Partial<Record<Area, Level>>;

// One select per area: no access, view only, or view and edit.
export function PermissionGrid({
  value,
  onChange,
}: {
  value: PermValue;
  onChange: (v: PermValue) => void;
}) {
  const set = (area: Area, v: string) => {
    const next: PermValue = { ...value };
    if (v === "view" || v === "edit") next[area] = v;
    else delete next[area];
    onChange(next);
  };
  return (
    <div className="perm-grid">
      {AREA_LABELS.map(([area, label]) => (
        <div className="perm-row" key={area}>
          <span className="perm-label">{label}</span>
          <select
            className="form-select form-select-sm"
            aria-label={`Access to ${label}`}
            value={value[area] ?? ""}
            onChange={(e) => set(area, e.target.value)}
          >
            <option value="">No access</option>
            <option value="view">View</option>
            <option value="edit">View &amp; edit</option>
          </select>
        </div>
      ))}
    </div>
  );
}
