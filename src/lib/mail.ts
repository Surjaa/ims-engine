// Sends email through the Resend HTTP API. Workers cannot open SMTP connections, so the
// Nodemailer/SMTP setup from the server build is replaced by this.
import { toBase64 } from './crypto';

export interface MailAttachment {
  filename: string;
  content: string; // text content
  contentType: string;
}

export async function sendMail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  text: string,
  html: string,
  attachments: MailAttachment[],
) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: toBase64(new TextEncoder().encode(a.content)),
      })),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Email provider refused the message (${res.status}) ${detail.slice(0, 200)}`);
  }
}
