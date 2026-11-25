export interface Category {
  id: number;
  name: string;
}

export interface Item {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  category: string | null;
  unit: string;
  qty: number;
  reorder_level: number;
  unit_cost: number;
  unit_price: number;
  extra: Record<string, string>;
}

export interface Movement {
  id: number;
  item_id: number;
  kind: "IN" | "OUT";
  qty: number;
  note: string;
  created_at: string;
  name: string;
  sku: string;
}

export interface CustomField {
  id: number;
  field_key: string;
  label: string;
  type: "text" | "number" | "date";
}

export interface Party {
  id: number;
  kind: "supplier" | "customer";
  name: string;
  phone: string;
  email: string;
  city: string;
  balance: number;
}

export interface Txn {
  id: number;
  party_id: number;
  party_name: string;
  date: string;
  state: string;
  city: string;
  total: number;
  lines: number;
}

export interface Payment {
  id: number;
  party_id: number;
  party_name: string;
  direction: "receipt" | "payment";
  amount: number;
  date: string;
  note: string;
}

export interface NameValue {
  name: string;
  value: number;
}

export interface DashboardData {
  kpis: {
    total_sales: number;
    total_purchases: number;
    net_profit: number;
    receivable: number;
    payable: number;
    top_location: string | null;
    top_item: string | null;
  };
  salesTrend: { month: string; sales: number }[];
  topCustomers: { name: string; total: number }[];
  purchaseByLocation: NameValue[];
  purchaseByCategory: {
    categories: string[];
    rows: Record<string, string | number>[];
  };
  salesByLocation: NameValue[];
  salesByCategory: NameValue[];
  salesByCity: NameValue[];
}

export interface MonthlyRow {
  month: string;
  revenue: number;
  cogs: number;
}

export interface BackupStatus {
  configured: boolean;
  auto: boolean;
  last_backup: string | null;
}

export type Settings = Record<string, string>;
export type Status = "OK" | "LOW" | "OUT";

export interface Member {
  id: number;
  name: string;
  email: string;
  active: boolean;
  last_login_at: string | null;
  online: boolean;
  permissions: Partial<
    Record<
      | "dashboard"
      | "inventory"
      | "parties"
      | "purchases"
      | "sales"
      | "payments"
      | "movements"
      | "reports"
      | "settings",
      "view" | "edit"
    >
  >;
}

export interface Account {
  id: number;
  name: string;
  email: string;
  company: string;
  active: boolean;
  demo: boolean;
  created_at: string;
  last_login_at: string | null;
  workspace_id: number | null;
  owner_email: string | null;
  online: boolean;
  member_count: number;
  role: "owner" | "member";
}
