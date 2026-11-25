// Creates an account, or resets its password if the email already exists.
// Usage:  npm run user:add -- you@example.com "your password" "Company name"
// Add --remote at the end to write to the deployed database instead of the local one.
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const remote = args.includes('--remote');
const [rawEmail = '', password = '', company = 'IMS Engine'] = args.filter((a) => a !== '--remote');
const email = rawEmail.trim().toLowerCase();

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Usage: npm run user:add -- you@example.com "password" "Company name"');
if (password.length < 8) fail('The password must be at least 8 characters.');

// Same format the Worker uses (lib/crypto.ts): pbkdf2$iterations$salt$hash, SHA-256, 100,000 rounds.
const ITERATIONS = 100000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
const stored = `pbkdf2$${ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;

const quote = (text) => `'${String(text).replace(/'/g, "''")}'`;
const name = email.split('@')[0];
const sql =
  `INSERT INTO users (email, name, company, password_hash, active, demo) ` +
  `VALUES (${quote(email)}, ${quote(name)}, ${quote(company)}, ${quote(stored)}, 1, 0) ` +
  `ON CONFLICT (email) DO UPDATE SET password_hash = excluded.password_hash, active = 1;`;

const file = join(tmpdir(), `ims-add-user-${Date.now()}.sql`);
writeFileSync(file, sql);
try {
  const win = process.platform === 'win32';
  execFileSync(
    win ? 'npx.cmd' : 'npx',
    ['wrangler', 'd1', 'execute', 'ims', remote ? '--remote' : '--local', `--file=${file}`],
    { stdio: 'inherit', shell: win },
  );
} finally {
  unlinkSync(file);
}
console.log(`Account ready: ${email} (${remote ? 'remote' : 'local'} database). Sign in with this email and password.`);
