// Bindings and secrets the Worker reads. Set secrets with `npx wrangler secret put NAME`
// (or put them in .dev.vars for local runs). Plain values live in wrangler.jsonc.
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;

  AUTO_BACKUP?: string; // "true" = back up changed accounts every 15 minutes
  SUPER_ADMIN_EMAIL?: string;
  SHOW_ERRORS?: string; // "true" = return the real server error text (development only)

  // Google sign-in (optional). The OAuth client ID from Google Cloud Console.
  GOOGLE_CLIENT_ID?: string;

  // Google Sheets backup (optional). The whole service-account JSON key as one secret.
  GOOGLE_SHEET_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;

  // Invoice email (optional) through Resend (https://resend.com).
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
}
