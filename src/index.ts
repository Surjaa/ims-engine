import { Hono } from 'hono';
import type { Env } from './env';
import type { AppEnv } from './types';
import { HttpError } from './http';
import { requireUser } from './lib/access';
import { runScheduledBackups } from './lib/backup';
import auth from './routes/auth';
import inventory from './routes/inventory';
import parties from './routes/parties';
import transactions from './routes/transactions';
import dashboard from './routes/dashboard';
import admin from './routes/admin';

const app = new Hono<AppEnv>();

// Every error reaches the browser as { error: "message" }, the shape the web app reads.
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status as 400);
  console.error(err);
  // Development: show the real error so the cause is visible in the browser. Off in production.
  if (c.env.SHOW_ERRORS === 'true') return c.json({ error: `Server error: ${err.message}` }, 500);
  // The most common cause in development: the database has not been created yet.
  if (/no such table/i.test(err.message)) {
    return c.json({ error: 'The database is not set up yet. Run: npm run db:migrate:local, then restart npm run dev' }, 503);
  }
  return c.json({ error: 'Something went wrong on the server' }, 500);
});

app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.get('/api/health', (c) => c.json({ ok: true }));

// Sign-in routes check their own session. Every route after them needs a signed-in account.
const api = new Hono<AppEnv>();
api.route('/', auth);
api.use('*', requireUser);
api.route('/', inventory);
api.route('/', parties);
api.route('/', transactions);
api.route('/', dashboard);
api.route('/', admin);
app.route('/api', api);

export default {
  fetch: app.fetch,
  // Cron trigger (see wrangler.jsonc): automatic Google Sheets backups, when enabled.
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledBackups(env));
  },
} satisfies ExportedHandler<Env>;
