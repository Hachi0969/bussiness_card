// Local prototype server: static site, follow-up API and a SQLite test database.
// Photos and card images never reach this server. The browser makes the card by itself.
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONFIG } from './public/config.js';
import { EMAIL_RE } from './public/contact.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(ROOT, 'public');
const MAX_BODY_BYTES = 4096;
const RATE_WINDOW_MS = 10 * 60 * 1000;
// Generous on purpose: a whole venue can share one Wi-Fi address.
const RATE_LIMIT = 60;

export const STATUSES = ['new', 'contacted', 'interested', 'not_interested', 'do_not_contact'];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob: data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id             TEXT PRIMARY KEY,
      created_at     TEXT NOT NULL,
      name           TEXT NOT NULL,
      grade          INTEGER NOT NULL CHECK (grade BETWEEN 9 AND 12),
      program_id     TEXT NOT NULL,
      contact_method TEXT NOT NULL CHECK (contact_method IN ('phone', 'email', 'line')),
      contact_value  TEXT NOT NULL,
      consent_at     TEXT NOT NULL,
      notice_version TEXT NOT NULL,
      status         TEXT NOT NULL DEFAULT 'new'
    )
  `);
  return db;
}

export function insertLead(db, lead) {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO leads (id, created_at, name, grade, program_id, contact_method, contact_value, consent_at, notice_version, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, now, lead.name, lead.grade, lead.programId, lead.contactMethod, lead.contactValue, now, CONFIG.noticeVersion, lead.status ?? 'new');
  return id;
}

// Returns { lead } or { error }. Unknown fields are dropped, so nothing extra can be stored.
export function validateLead(body) {
  if (!body || typeof body !== 'object') return { error: 'invalid_body' };
  if (body.consent !== true) return { error: 'consent_required' };
  if (body.noticeVersion !== CONFIG.noticeVersion) return { error: 'notice_outdated' };

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 80) return { error: 'invalid_name' };

  const grade = body.grade;
  if (!Number.isInteger(grade) || grade < 9 || grade > 12) return { error: 'invalid_grade' };

  if (!CONFIG.programs.some((p) => p.id === body.programId)) return { error: 'invalid_program' };

  let contactValue = typeof body.contactValue === 'string' ? body.contactValue.trim() : '';
  if (body.contactMethod === 'email') {
    if (contactValue.length > 120 || !EMAIL_RE.test(contactValue)) return { error: 'invalid_contact' };
  } else if (body.contactMethod === 'phone') {
    contactValue = contactValue.replace(/[\s-]/g, '');
    if (!/^0\d{8,9}$/.test(contactValue)) return { error: 'invalid_contact' };
  } else if (body.contactMethod === 'line') {
    contactValue = contactValue.replace(/^@/, '');
    if (!/^[A-Za-z0-9._-]{1,50}$/.test(contactValue)) return { error: 'invalid_contact' };
  } else {
    return { error: 'invalid_contact' };
  }

  return { lead: { name, grade, programId: body.programId, contactMethod: body.contactMethod, contactValue } };
}

function sendJson(res, status, payload) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(payload === undefined ? '' : JSON.stringify(payload));
}

function readJson(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolvePromise(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('bad json'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sameOrigin(req) {
  const { origin } = req.headers;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function isAuthorized(req, adminToken) {
  const header = req.headers.authorization ?? '';
  const given = Buffer.from(header.startsWith('Bearer ') ? header.slice(7) : '');
  const expected = Buffer.from(adminToken);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function serveStatic(req, res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return sendJson(res, 400, { error: 'bad_path' });
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const filePath = resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR + sep) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return sendJson(res, 404, { error: 'not_found' });
  }
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': extname(filePath) === '.woff2' ? 'public, max-age=86400' : 'no-cache',
  };
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : readFileSync(filePath));
}

export function createApp({ db, adminToken, rateLimit = RATE_LIMIT }) {
  const hits = new Map();

  function overLimit(ip) {
    const now = Date.now();
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > rateLimit;
  }

  async function submitLead(req, res) {
    if (!sameOrigin(req)) return sendJson(res, 403, { error: 'forbidden' });
    if (overLimit(req.socket.remoteAddress)) return sendJson(res, 429, { error: 'too_many_requests' });
    const body = await readJson(req);
    // Hidden field only bots fill in. Report success so they don't adapt.
    if (body?.website) return sendJson(res, 201, { ok: true });
    const { lead, error } = validateLead(body);
    if (error) return sendJson(res, 400, { error });
    insertLead(db, lead);
    return sendJson(res, 201, { ok: true });
  }

  async function handleAdmin(req, res, pathname) {
    if (!isAuthorized(req, adminToken)) return sendJson(res, 401, { error: 'unauthorized' });
    if (pathname === '/api/admin/leads' && req.method === 'GET') {
      const leads = db.prepare('SELECT * FROM leads ORDER BY created_at DESC').all();
      return sendJson(res, 200, { leads });
    }
    const match = pathname.match(/^\/api\/admin\/leads\/([0-9a-f-]{36})$/);
    if (!match) return sendJson(res, 404, { error: 'not_found' });
    if (req.method === 'PATCH') {
      const { status } = await readJson(req);
      if (!STATUSES.includes(status)) return sendJson(res, 400, { error: 'invalid_status' });
      const result = db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, match[1]);
      return result.changes ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'not_found' });
    }
    if (req.method === 'DELETE') {
      const result = db.prepare('DELETE FROM leads WHERE id = ?').run(match[1]);
      return result.changes ? sendJson(res, 200, { ok: true }) : sendJson(res, 404, { error: 'not_found' });
    }
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }

  return createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    try {
      if (pathname === '/api/leads') {
        if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
        return await submitLead(req, res);
      }
      if (pathname.startsWith('/api/admin/')) return await handleAdmin(req, res, pathname);
      if (pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'not_found' });
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'method_not_allowed' });
      return serveStatic(req, res, pathname);
    } catch (err) {
      if (err.status) return sendJson(res, err.status, { error: 'bad_request' });
      console.error(err);
      return sendJson(res, 500, { error: 'server_error' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? '127.0.0.1';
  const adminToken = process.env.ADMIN_TOKEN ?? randomBytes(18).toString('base64url');
  const db = openDatabase(process.env.DB_PATH ?? join(ROOT, 'data', 'test-leads.sqlite'));
  createApp({ db, adminToken }).listen(port, host, () => {
    console.log(`Card maker:  http://localhost:${port}/`);
    console.log(`Poster:      http://localhost:${port}/poster.html`);
    console.log(`Staff list:  http://localhost:${port}/admin.html`);
    console.log(`Staff token for this run: ${adminToken}`);
  });
}
