# IMS Engine

Inventory management for stock, purchases, sales, payments, reports and profit.
Runs on Cloudflare Workers with a D1 (SQLite) database, and a React web app.

## What it does

- **Stock levels** for every item, with reorder alerts. A sale that would take stock below zero is refused.
- **Purchases** add stock at their price and update the item's weighted-average cost.
- **Sales and invoices** record the cost each item was sold at, so profit stays accurate after later purchases.
- **Payments and reports** log receipts and supplier payments, with monthly reports and a dashboard.
- **Accounts** are separate per user. Two-step sign-in is available.

## Run locally

```
npm install
npm install --prefix web
npm run db:migrate:local
cp .dev.vars.example .dev.vars
npm run dev
```

In another terminal, to run the web app:

```
npm run dev --prefix web
```

## Create an account

```
npm run user:add -- you@example.com "your-password" "Company name"
```

Add `--remote` at the end to write to the Cloudflare database.

## Deploy to Cloudflare

1. `npx wrangler login`
2. Create the database once with `npx wrangler d1 create ims`, then put its `database_id` in `wrangler.jsonc`.
3. `npm run db:migrate:remote`
4. Set your site address and deploy:
   ```
   set "SITE_URL=https://<your-worker>.<your-subdomain>.workers.dev" && npm run deploy
   ```

See `DEPLOY.md` for Google sign-in and invoice email setup.
