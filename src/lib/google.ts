// Google services from a Worker, without the Node SDKs:
//  - sign-in: Google checks the ID token (tokeninfo endpoint)
//  - backup: a service account signs a JWT (RS256 with Web Crypto) and calls the Sheets REST API
import { HttpError } from '../http';
import { toBase64Url } from './crypto';

export interface GoogleClaims {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

// Returns the verified claims of a Google ID token, or throws 401.
export async function verifyGoogleIdToken(idToken: string, clientId: string): Promise<GoogleClaims> {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new HttpError(401, 'Google sign-in could not be verified. Please try again.');
  const c = (await res.json()) as Record<string, string | boolean>;
  const emailVerified = c.email_verified === true || c.email_verified === 'true';
  if (c.aud !== clientId) throw new HttpError(401, 'Google sign-in could not be verified. Please try again.');
  if (!c.sub || !c.email || !emailVerified) {
    throw new HttpError(401, 'Google must provide a verified email address to sign in.');
  }
  return {
    sub: String(c.sub),
    email: String(c.email),
    name: c.name ? String(c.name) : undefined,
    picture: c.picture ? String(c.picture) : undefined,
  };
}

/* Service account access token for the Sheets API */

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

const enc = new TextEncoder();

function pemToDer(pem: string): ArrayBuffer {
  const body = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

export async function googleAccessToken(serviceAccountJson: string, scope: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson) as ServiceAccount;
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claims = toBase64Url(
    enc.encode(
      JSON.stringify({
        iss: sa.client_email,
        scope,
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${claims}`));
  const assertion = `${header}.${claims}.${toBase64Url(new Uint8Array(sig))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status})`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}
