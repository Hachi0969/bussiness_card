import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createApp, openDatabase } from '../server.mjs';
import { CONFIG } from '../public/config.js';
import { buildVCard, normalizeHandle } from '../public/contact.js';

const TOKEN = 'test-token-for-api-tests';
let db;
let server;
let base;

const valid = () => ({
  name: 'นักเรียนทดสอบ',
  grade: 11,
  programId: 'dti',
  contactMethod: 'email',
  contactValue: 'student@example.com',
  consent: true,
  noticeVersion: CONFIG.noticeVersion,
  website: '',
});

const post = (body, headers = {}) =>
  fetch(`${base}/api/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
const admin = (path = '', options = {}, token = TOKEN) =>
  fetch(`${base}/api/admin/leads${path}`, { ...options, headers: { Authorization: `Bearer ${token}` } });
const rows = () => db.prepare('SELECT * FROM leads').all();

before(async () => {
  db = openDatabase(':memory:');
  server = createApp({ db, adminToken: TOKEN, rateLimit: 1000 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());
beforeEach(() => db.exec('DELETE FROM leads'));

test('stores a consented entry with its consent record', async () => {
  assert.equal((await post(valid())).status, 201);
  const [row] = rows();
  assert.equal(row.name, 'นักเรียนทดสอบ');
  assert.equal(row.notice_version, CONFIG.noticeVersion);
  assert.ok(row.consent_at);
  assert.equal(row.status, 'new');
});

test('refuses an entry without consent', async () => {
  for (const consent of [false, 'true', undefined]) {
    const response = await post({ ...valid(), consent });
    assert.equal(response.status, 400);
  }
  assert.equal(rows().length, 0);
});

test('refuses invalid fields', async () => {
  const bad = [
    { name: '   ' },
    { grade: 8 },
    { grade: '11' },
    { programId: 'nope' },
    { contactMethod: 'fax' },
    { contactValue: 'not-an-email' },
    { contactMethod: 'phone', contactValue: '12345' },
    { noticeVersion: 'old' },
  ];
  for (const change of bad) assert.equal((await post({ ...valid(), ...change })).status, 400, JSON.stringify(change));
  assert.equal(rows().length, 0);
});

test('never stores fields outside the allowed list', async () => {
  await post({ ...valid(), photo: 'data:image/png;base64,AAAA', status: 'interested' });
  const [row] = rows();
  assert.equal(row.status, 'new');
  assert.ok(!JSON.stringify(row).includes('AAAA'));
});

test('ignores bots that fill in the hidden field', async () => {
  assert.equal((await post({ ...valid(), website: 'spam' })).status, 201);
  assert.equal(rows().length, 0);
});

test('refuses other websites and oversized requests', async () => {
  assert.equal((await post(valid(), { Origin: 'https://evil.example' })).status, 403);
  const large = await post({ ...valid(), name: 'x'.repeat(5000) }).catch(() => null);
  assert.ok(large === null || large.status === 413);
  assert.equal(rows().length, 0);
});

test('applies the rate limit', async () => {
  const limited = createApp({ db, adminToken: TOKEN, rateLimit: 2 });
  await new Promise((resolve) => limited.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${limited.address().port}/api/leads`;
  const send = () => fetch(url, { method: 'POST', body: JSON.stringify(valid()) });
  assert.equal((await send()).status, 201);
  assert.equal((await send()).status, 201);
  assert.equal((await send()).status, 429);
  limited.close();
});

test('the public cannot read or change the list', async () => {
  await post(valid());
  const [{ id }] = rows();
  assert.equal((await fetch(`${base}/api/admin/leads`)).status, 401);
  assert.equal((await admin('', {}, 'wrong')).status, 401);
  assert.equal((await admin(`/${id}`, { method: 'DELETE' }, 'wrong')).status, 401);
  assert.equal((await fetch(`${base}/api/leads`)).status, 405);
  assert.equal(rows().length, 1);
});

test('staff can read, update and delete entries', async () => {
  await post(valid());
  const { leads } = await (await admin()).json();
  assert.equal(leads.length, 1);
  const url = `${base}/api/admin/leads/${leads[0].id}`;
  const headers = { Authorization: `Bearer ${TOKEN}` };
  assert.equal((await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ status: 'do_not_contact' }) })).status, 200);
  assert.equal(rows()[0].status, 'do_not_contact');
  assert.equal((await fetch(url, { method: 'PATCH', headers, body: JSON.stringify({ status: 'nope' }) })).status, 400);
  assert.equal((await fetch(url, { method: 'DELETE', headers })).status, 200);
  assert.equal(rows().length, 0);
});

test('serves the site but nothing outside the public folder', async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-security-policy'), /default-src 'none'/);
  for (const path of ['/..%2fserver.mjs', '/%2e%2e/package.json', '/..%5cserver.mjs']) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
});

test('reads handles from names and pasted links', () => {
  assert.equal(normalizeHandle('@somchai'), 'somchai');
  assert.equal(normalizeHandle('https://www.instagram.com/somchai/?hl=th'), 'somchai');
  assert.equal(normalizeHandle('https://www.tiktok.com/@somchai'), 'somchai');
  assert.equal(normalizeHandle('https://line.me/ti/p/~somchai'), 'somchai');
  assert.equal(normalizeHandle('some.name_1'), 'some.name_1');
});

test('the contact QR holds only what was filled in', () => {
  assert.equal(buildVCard({ nickname: 'ฟ้า' }), null);
  const onlyEmail = buildVCard({ nickname: 'ฟ้า', email: 'a@example.com' });
  assert.match(onlyEmail, /FN;CHARSET=UTF-8:ฟ้า/);
  assert.ok(!onlyEmail.includes('URL:'));
  const line = buildVCard({ nickname: 'a;b', platform: 'line', handle: 'fah' });
  assert.match(line, /FN;CHARSET=UTF-8:a\\;b/);
  assert.match(line, /URL:https:\/\/line\.me\/ti\/p\/~fah/);
  assert.ok(!line.includes('EMAIL'));
});
