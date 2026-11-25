# IMS Engine on Cloudflare

Runs as one Cloudflare Worker (API + the React app from `web/dist`) with a D1 database.

## Run locally
```bash
npm install
cd web && npm install && cd ..
npm run db:migrate:local
npm run build:web
npm run dev            # http://localhost:8787 (API on /api)
```
Sample account: sign in with `POST /api/auth/demo`, or use the demo button in the app.
For the Vite dev server (`cd web && npm run dev`), the proxy targets port 8787.

## Create the database (once)
```bash
npx wrangler d1 create ims
```
Copy the printed `database_id` into `wrangler.jsonc` (replace `REPLACE_WITH_D1_DATABASE_ID`).
```bash
npm run db:migrate:remote
```

## Deploy
```bash
npm run deploy
```

## Optional secrets (production)
```bash
npx wrangler secret put GOOGLE_SERVICE_ACCOUNT_JSON   # paste the whole JSON key
npx wrangler secret put RESEND_API_KEY                # invoice email
npx wrangler secret put GOOGLE_CLIENT_ID              # Google sign-in (plain value also works in vars)
```
Plain settings in `wrangler.jsonc` `vars`: `GOOGLE_SHEET_ID`, `MAIL_FROM`, `AUTO_BACKUP` (`"true"` turns on the 15-minute backup cron).

## Notes
- Demo data is rebuilt each time the demo account signs in.
- Stock can never go below zero: the database enforces it, so concurrent sales cannot oversell.
- Google Sheets backup uses a service account; share the target sheet with the service account's email as Editor.

## Public address, links and search
1. Pick your public address (a custom domain is best, e.g. `https://ims.yourcompany.com`).
2. Build and deploy with it, so the canonical URL, share preview, sitemap and `llms.txt` use it:
   ```bash
   SITE_URL=https://ims.yourcompany.com npm run deploy
   ```
   Without `SITE_URL` the build uses a placeholder and prints a warning.
3. Check the share preview with the Facebook Sharing Debugger or LinkedIn Post Inspector. Paste the link, then press "Scrape again" after each change to the image or text.
4. Google Search Console: add the property, verify it, then submit `https://…/sitemap.xml`. Bing Webmaster Tools: import from Search Console or add the site and submit the same sitemap.
5. Search results depend on the other sites that already use the name "IMS". Brand queries such as "IMS Engine" can rank first once the site is indexed. Generic queries like "IMS" will take longer to win.

## Google sign-in (after you add the Google Cloud client)
- In Google Cloud Console, create an OAuth client ID of type "Web application".
- Add the authorized JavaScript origin: your public address (for example `https://ims.yourcompany.com`).
- Set `GOOGLE_CLIENT_ID` in `wrangler.jsonc` `vars`, or as a secret. The Google button appears on the sign-in page only when this is set.
