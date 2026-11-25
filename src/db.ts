// Small helpers over Cloudflare D1. D1 has no BEGIN/COMMIT, so a multi-step change is either
// one batch() (all statements succeed or none do) or an insert followed by a batch with a
// compensating delete (see lib/txn.ts).

export type Params = (string | number | null)[];

export const stmt = (db: D1Database, sql: string, params: Params = []) =>
  db.prepare(sql).bind(...params);

export async function all<T = Record<string, any>>(
  db: D1Database,
  sql: string,
  params: Params = [],
): Promise<T[]> {
  const r = await stmt(db, sql, params).all<T>();
  return r.results ?? [];
}

export async function first<T = Record<string, any>>(
  db: D1Database,
  sql: string,
  params: Params = [],
): Promise<T | null> {
  return stmt(db, sql, params).first<T>();
}

export async function run(db: D1Database, sql: string, params: Params = []) {
  return stmt(db, sql, params).run();
}

// Changed rows for a single UPDATE or DELETE.
export const changes = (r: D1Result) => r.meta?.changes ?? 0;

// Atomic: every statement in the list runs, or none of them do.
export const atomic = (db: D1Database, stmts: D1PreparedStatement[]) => db.batch(stmts);

export const bool = (v: unknown) => v === 1 || v === true;
