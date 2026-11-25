import { all, first } from '../db';
import { HttpError, round2 } from '../http';
import { sendMail } from './mail';

export interface InvoiceLine {
  name: string;
  sku: string;
  unit: string;
  qty: number;
  price: number;
  amount: number;
}

export interface InvoiceData {
  number: string;
  date: string;
  company: string;
  currency: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    city: string;
    state: string;
  };
  lines: InvoiceLine[];
  total: number;
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const invoiceNumber = (saleId: number) => `INV-${String(saleId).padStart(5, '0')}`;

const fmt = (cur: string, n: number) =>
  `${cur}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Reads the sale, its lines and the company settings for one account. Other accounts get a 404.
export async function loadInvoice(db: D1Database, uid: number, saleId: number): Promise<InvoiceData> {
  const sale = await first<{
    date: string;
    state: string;
    city: string;
    total: number;
    party_name: string;
    party_email: string;
    party_phone: string;
    party_city: string;
  }>(
    db,
    `SELECT s.sale_date AS date, s.state, s.city, s.total,
            pa.name AS party_name, pa.email AS party_email, pa.phone AS party_phone, pa.city AS party_city
     FROM sales s JOIN parties pa ON pa.id = s.party_id
     WHERE s.id = ? AND s.user_id = ?`,
    [saleId, uid],
  );
  if (!sale) throw new HttpError(404, 'Sale not found');

  const settings = await all<{ key: string; value: string }>(
    db,
    "SELECT key, value FROM settings WHERE user_id = ? AND key IN ('company_name', 'currency')",
    [uid],
  );
  const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));

  const lines = await all<{ name: string; sku: string; unit: string; qty: number; price: number }>(
    db,
    `SELECT it.name, it.sku, it.unit, sl.qty, sl.unit_price AS price
     FROM sale_lines sl
     JOIN items it ON it.id = sl.item_id
     JOIN sales sa ON sa.id = sl.sale_id
     WHERE sl.sale_id = ? AND sa.user_id = ?
     ORDER BY sl.id`,
    [saleId, uid],
  );

  return {
    number: invoiceNumber(saleId),
    date: sale.date,
    company: s.company_name || 'My Company',
    currency: s.currency || '₹',
    customer: {
      name: sale.party_name,
      email: sale.party_email,
      phone: sale.party_phone,
      city: sale.party_city,
      state: sale.state,
    },
    lines: lines.map((l) => ({ ...l, amount: round2(l.qty * l.price) })),
    total: sale.total,
  };
}

// Self-contained HTML, so it prints cleanly to PDF from any browser and works as an email body.
export function renderInvoiceHtml(inv: InvoiceData): string {
  const rows = inv.lines
    .map(
      (l, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(l.name)}<div class="sku">${esc(l.sku)}</div></td>
        <td class="r">${l.qty} ${esc(l.unit)}</td>
        <td class="r">${fmt(inv.currency, l.price)}</td>
        <td class="r">${fmt(inv.currency, l.amount)}</td>
      </tr>`,
    )
    .join('');
  const where = [inv.customer.city, inv.customer.state].filter(Boolean).join(', ');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8" /><title>${esc(inv.number)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;color:#0F172A;margin:0;padding:32px;background:#fff}
  .wrap{max-width:760px;margin:0 auto}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #6366F1;padding-bottom:16px}
  .co{font-size:22px;font-weight:700}
  .inv{text-align:right}
  .inv h1{margin:0;font-size:26px;color:#6366F1;letter-spacing:1px}
  .muted{color:#64748B;font-size:13px}
  .bill{margin:22px 0;font-size:14px;line-height:1.5}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th{background:#F1F5F9;text-align:left;padding:10px;border-bottom:1px solid #DCE3F5;font-size:12px;text-transform:uppercase;color:#475569}
  td{padding:10px;border-bottom:1px solid #E2E8F0;vertical-align:top}
  .r{text-align:right;white-space:nowrap}
  .sku{color:#64748B;font-size:12px}
  .total{margin-top:16px;display:flex;justify-content:flex-end}
  .total div{background:#0F172A;color:#fff;padding:12px 18px;border-radius:8px;font-size:18px;font-weight:700}
  .foot{margin-top:36px;font-size:12px;color:#64748B;text-align:center}
  @media print{body{padding:0}}
</style></head>
<body><div class="wrap">
  <div class="head">
    <div><div class="co">${esc(inv.company)}</div></div>
    <div class="inv"><h1>INVOICE</h1><div class="muted">${esc(inv.number)}</div><div class="muted">Date: ${esc(inv.date)}</div></div>
  </div>
  <div class="bill">
    <div class="muted">Bill to</div>
    <strong>${esc(inv.customer.name)}</strong><br />
    ${where ? `${esc(where)}<br />` : ''}
    ${inv.customer.phone ? `Phone: ${esc(inv.customer.phone)}<br />` : ''}
    ${inv.customer.email ? `Email: ${esc(inv.customer.email)}` : ''}
  </div>
  <table>
    <thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total"><div>Total ${fmt(inv.currency, inv.total)}</div></div>
  <div class="foot">Thank you for your business. Generated by ${esc(inv.company)}.</div>
</div></body></html>`;
}

export const mailConfigured = (env: { RESEND_API_KEY?: string; MAIL_FROM?: string }) =>
  Boolean(env.RESEND_API_KEY && env.MAIL_FROM);

// Sends the invoice as the email body and as an attached HTML file.
export async function sendInvoiceEmail(
  env: { RESEND_API_KEY?: string; MAIL_FROM?: string },
  to: string,
  inv: InvoiceData,
) {
  const html = renderInvoiceHtml(inv);
  await sendMail(
    env.RESEND_API_KEY!,
    env.MAIL_FROM!,
    to,
    `Invoice ${inv.number} from ${inv.company}`,
    `Dear ${inv.customer.name},\n\nPlease find invoice ${inv.number} for ${fmt(inv.currency, inv.total)} attached.\n\nThank you,\n${inv.company}`,
    html,
    [{ filename: `${inv.number}.html`, content: html, contentType: 'text/html' }],
  );
}
