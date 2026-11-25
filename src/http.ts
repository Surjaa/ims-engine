import type { Context } from 'hono';

// An error with an HTTP status. Thrown inside routes; turned into { error } JSON by index.ts.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const str = (v: unknown, max = 200) => String(v ?? '').trim().slice(0, max);

export const int = (v: unknown) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
};

export const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const isDate = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Reads a JSON body. Non-JSON requests get an empty object; broken JSON gets a 400.
export async function readBody(c: Context): Promise<Record<string, any>> {
  const type = c.req.header('content-type') ?? '';
  if (!type.includes('application/json')) return {};
  const text = await c.req.text();
  if (!text) return {};
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' ? value : {};
  } catch {
    throw new HttpError(400, 'Invalid request');
  }
}

// D1 reports constraint failures in the error message, not as PostgreSQL codes.
const msg = (e: unknown) => String((e as Error)?.message ?? e);

// UNIQUE violation -> 409 with the given message.
export const dupe = (e: unknown, message: string): never => {
  if (/UNIQUE constraint failed/i.test(msg(e))) throw new HttpError(409, message);
  throw e;
};

// FOREIGN KEY violation (row still referenced) -> 409.
export const inUse = (e: unknown, message: string): never => {
  if (/FOREIGN KEY constraint failed/i.test(msg(e))) throw new HttpError(409, message);
  throw e;
};

// CHECK violation (for example, stock would go below zero) -> 409.
export const checkFailed = (e: unknown, message: string): never => {
  if (/CHECK constraint failed/i.test(msg(e))) throw new HttpError(409, message);
  throw e;
};
