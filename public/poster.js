import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const CELL = 16;
const QUIET_MODULES = 4;

// The extra parameter makes LINE's scanner open the normal browser, where saving works best.
const target = `${location.origin}/?openExternalBrowser=1`;

const qr = qrcode(0, 'M');
qr.addData(target);
qr.make();
const modules = qr.getModuleCount();
const canvas = $('qr');
canvas.width = canvas.height = (modules + QUIET_MODULES * 2) * CELL;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#000';
for (let row = 0; row < modules; row++) {
  for (let col = 0; col < modules; col++) {
    if (qr.isDark(row, col)) ctx.fillRect((col + QUIET_MODULES) * CELL, (row + QUIET_MODULES) * CELL, CELL, CELL);
  }
}

$('event').textContent = `${CONFIG.university.th} · ${CONFIG.event.th}`;
$('url').textContent = location.origin;
$('localWarning').hidden = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
$('print').addEventListener('click', () => window.print());
