import { createMiddleware } from 'hono/factory';
import { first, all } from '../db';
import { HttpError } from '../http';
import type { AppEnv } from '../types';
import { currentUserId } from './auth';

// The one super admin. Matching is case-insensitive. Can be overridden with the SUPER_ADMIN_EMAIL variable.
export const DEFAULT_SUPER_ADMIN = 'gurwinderanusurja@gmail.com';

// Areas a company owner can grant to a team member. Each is view or edit.
export const AREAS = [
  'dashboard',
  'inventory',
  'parties',
  'purchases',
  'sales',
  'payments',
  'movements',
  'reports',
  'settings',
] as const;
export type Area = (typeof AREAS)[number];
export type Level = 'view' | 'edit';
export type Perms = Partial<Record<Area, Level>>;

export interface Actor {
  id: number; // the signed-in account
  email: string;
  workspaceId: number; // the owner whose data this account works on
  isOwner: boolean; // true for the owner of a workspace, false for a team member
  isSuper: boolean;
  perms: Perms; // team members only
}

// Maps a request path (relative to /api) to the area it belongs to.
export function areaOf(path: string): Area | null {
  const rules: [RegExp, Area][] = [
    [/^\/dashboard(\/|$)/, 'dashboard'],
    [/^\/(items|categories|fields)(\/|$)/, 'inventory'],
    [/^\/parties(\/|$)/, 'parties'],
    [/^\/purchases(\/|$)/, 'purchases'],
    [/^\/sales(\/|$)/, 'sales'],
    [/^\/payments(\/|$)/, 'payments'],
    [/^\/movements(\/|$)/, 'movements'],
    [/^\/reports(\/|$)/, 'reports'],
    [/^\/(settings|backup)(\/|$)/, 'settings'],
  ];
  return rules.find(([re]) => re.test(path))?.[1] ?? null;
}

export async function loadActor(db: D1Database, userId: number, superEmail: string): Promise<Actor> {
  const u = await first<{ id: number; email: string; workspace_id: number | null; owner_active: number | null }>(
    db,
    `SELECT u.id, u.email, u.workspace_id, w.active AS owner_active
     FROM users u LEFT JOIN users w ON w.id = u.workspace_id
     WHERE u.id = ?`,
    [userId],
  );
  if (!u) throw new HttpError(401, 'Please sign in');
  if (u.workspace_id !== null && !u.owner_active) {
    throw new HttpError(403, 'The company account for this login has been deactivated');
  }

  const isOwner = u.workspace_id === null;
  let perms: Perms = {};
  if (!isOwner) {
    const rows = await all<{ area: Area; level: Level }>(
      db,
      'SELECT area, level FROM member_permissions WHERE user_id = ?',
      [u.id],
    );
    perms = Object.fromEntries(rows.map((r) => [r.area, r.level])) as Perms;
  }

  return {
    id: u.id,
    email: u.email,
    workspaceId: isOwner ? u.id : u.workspace_id!,
    isOwner,
    isSuper: isOwner && u.email.toLowerCase() === superEmail,
    perms,
  };
}

export const superEmailOf = (env: AppEnv['Bindings']) =>
  (env.SUPER_ADMIN_EMAIL ?? DEFAULT_SUPER_ADMIN).toLowerCase();

// Signed-in check for every business route. Owners get full access to their workspace.
// Team members get only the areas they were granted: view for GET, edit for writes.
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const actor = await loadActor(c.env.DB, await currentUserId(c), superEmailOf(c.env));
  if (!actor.isOwner) {
    const area = areaOf(c.req.path.replace(/^\/api/, ''));
    const level = area ? actor.perms[area] : undefined;
    if (!level) throw new HttpError(403, 'You do not have access to this area');
    if (c.req.method !== 'GET' && level !== 'edit') {
      throw new HttpError(403, 'You have view-only access to this area');
    }
  }
  c.set('actor', actor);
  c.set('userId', actor.workspaceId);
  await next();
});

// Owner-only pages (team management). Must run after requireUser.
export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('actor')?.isOwner) throw new HttpError(403, 'Only the company owner can do this');
  await next();
});

// Super-admin-only pages (all accounts). Must run after requireUser.
export const requireSuper = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('actor')?.isSuper) throw new HttpError(403, 'Only the super admin can do this');
  await next();
});

// Ready-to-send view of what the signed-in user may see in the UI.
export function permissionView(a: Actor) {
  return {
    role: a.isSuper ? 'super' : a.isOwner ? 'owner' : 'member',
    isSuper: a.isSuper,
    permissions: a.isOwner ? Object.fromEntries(AREAS.map((k) => [k, 'edit'])) : a.perms,
  };
}
