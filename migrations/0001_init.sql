-- IMS Engine schema for Cloudflare D1 (SQLite).
-- Converted from the PostgreSQL schema. Every business table carries user_id,
-- so each account (or company workspace) sees only its own data.
-- Money is REAL, booleans are 0/1, timestamps are ISO-8601 text in UTC.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  company       TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  photo         TEXT,
  password_hash TEXT,
  totp_secret   TEXT,
  totp_pending  TEXT,
  demo          INTEGER NOT NULL DEFAULT 0 CHECK (demo IN (0, 1)),
  active        INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  last_login_at TEXT,
  workspace_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  verified   INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  expires_at INTEGER NOT NULL -- epoch milliseconds
);
CREATE INDEX sessions_expires ON sessions (expires_at);

CREATE TABLE categories (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  UNIQUE (user_id, name)
);

CREATE TABLE items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sku           TEXT NOT NULL,
  name          TEXT NOT NULL,
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  unit          TEXT NOT NULL DEFAULT 'pcs',
  qty           INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  unit_cost     REAL NOT NULL DEFAULT 0,
  unit_price    REAL NOT NULL DEFAULT 0,
  extra         TEXT NOT NULL DEFAULT '{}',   -- JSON object
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, sku)
);

CREATE TABLE movements (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('IN', 'OUT')),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX movements_user ON movements (user_id, created_at);

CREATE TABLE custom_fields (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  field_key  TEXT NOT NULL,
  label      TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('text', 'number', 'date')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, field_key)
);

CREATE TABLE settings (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key     TEXT NOT NULL,
  value   TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE parties (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL CHECK (kind IN ('supplier', 'customer')),
  name       TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL DEFAULT '',
  city       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE purchases (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_id      INTEGER NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  purchase_date TEXT NOT NULL DEFAULT (date('now')),   -- YYYY-MM-DD
  state         TEXT NOT NULL DEFAULT '',
  city          TEXT NOT NULL DEFAULT '',
  total         REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX purchases_user ON purchases (user_id, purchase_date);

CREATE TABLE purchase_lines (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty         INTEGER NOT NULL CHECK (qty > 0),
  unit_cost   REAL NOT NULL
);

CREATE TABLE sales (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_id   INTEGER NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  sale_date  TEXT NOT NULL DEFAULT (date('now')),      -- YYYY-MM-DD
  state      TEXT NOT NULL DEFAULT '',
  city       TEXT NOT NULL DEFAULT '',
  total      REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX sales_user ON sales (user_id, sale_date);

CREATE TABLE sale_lines (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id    INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  item_id    INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  qty        INTEGER NOT NULL CHECK (qty > 0),
  unit_price REAL NOT NULL,
  unit_cost  REAL NOT NULL DEFAULT 0
);

CREATE TABLE payments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  party_id   INTEGER NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,
  direction  TEXT NOT NULL CHECK (direction IN ('receipt', 'payment')),
  amount     REAL NOT NULL CHECK (amount > 0),
  pay_date   TEXT NOT NULL DEFAULT (date('now')),      -- YYYY-MM-DD
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE member_permissions (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area    TEXT NOT NULL,
  level   TEXT NOT NULL CHECK (level IN ('view', 'edit')),
  PRIMARY KEY (user_id, area)
);
