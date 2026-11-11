// Draws the card onto a canvas. Everything happens in the browser.
import { CONFIG } from './config.js';
import { PLATFORMS, buildVCard } from './contact.js';

// The QR library only handles Latin text by default. Thai names need real UTF-8 bytes.
if (globalThis.qrcode) qrcode.stringToBytes = (text) => Array.from(new TextEncoder().encode(text));

export const CARD_W = 1080;
export const CARD_H = 1350;
const M = 72; // outer margin

export const THEMES = {
  contour: { name: { th: 'เส้นภูเขา', en: 'Contour' }, ink: '#F4F1E8', muted: '#B7CFC8', accent: '#E6A06A', paint: paintContour },
  paper: { name: { th: 'กระดาษ', en: 'Paper' }, ink: '#1C2B2A', muted: '#4F5F5C', accent: '#A8481F', paint: paintPaper },
  orbit: { name: { th: 'วงโคจร', en: 'Orbit' }, ink: '#F5F5FF', muted: '#C3C5EE', accent: '#F2C14E', paint: paintOrbit },
  sun: { name: { th: 'ตะวัน', en: 'Sun' }, ink: '#2B1C08', muted: '#5A4318', accent: '#8F2A10', paint: paintSun },
};

export const AVATARS = {
  star: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  heart: 'M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  code: 'M8 6l-6 6 6 6M16 6l6 6-6 6M14 4l-4 16',
  flask: 'M9 2h6M10 2v7L4 20a1.5 1.5 0 0 0 1.3 2h13.4a1.5 1.5 0 0 0 1.3-2L14 9V2M7 15h10',
};

function linearBackground(ctx, from, to) {
  const g = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
}

function organicRing(ctx, cx, cy, radius, k, phase) {
  ctx.beginPath();
  const steps = 160;
  for (let i = 0; i <= steps; i++) {
    const t = (2 * Math.PI * i) / steps;
    const wobble =
      0.13 * Math.sin(2 * t + phase + k * 0.05) +
      0.07 * Math.sin(3 * t - phase * 1.7 + k * 0.08) +
      0.03 * Math.sin(5 * t + phase * 0.6 - k * 0.11);
    const r = radius * (1 + wobble);
    ctx.lineTo(cx + r * Math.cos(t), cy + r * Math.sin(t));
  }
  ctx.closePath();
}

function paintContour(ctx) {
  linearBackground(ctx, '#0F2A2B', '#17403F');
  const levels = 25;
  for (let k = 1; k <= levels; k++) {
    organicRing(ctx, 930, 320, k * 34, k, 0.9);
    const accent = k === 7;
    ctx.strokeStyle = accent ? '#E6A06A' : '#7FB5A8';
    ctx.globalAlpha = accent ? 0.95 : 0.6 * Math.pow(1 - (k - 1) / levels, 1.25);
    ctx.lineWidth = accent ? 3.5 : k % 5 === 0 ? 2.6 : 1.5;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintPaper(ctx) {
  ctx.fillStyle = '#F5EFE3';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.fillStyle = '#A8481F';
  for (let y = 30; y < 760; y += 34) {
    for (let x = 400; x < CARD_W + 20; x += 34) {
      const d = Math.hypot(x - CARD_W, y - 160);
      const r = Math.max(0, 7.5 - d / 95);
      if (r > 0.3) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function paintOrbit(ctx) {
  linearBackground(ctx, '#1B1F4B', '#2E2F80');
  ctx.strokeStyle = '#9EA3F0';
  for (let k = 1; k <= 8; k++) {
    ctx.globalAlpha = 0.5 - k * 0.045;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(900, 300, k * 92, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#F2C14E';
  ctx.beginPath();
  ctx.arc(900 + 276 * Math.cos(2.5), 300 + 276 * Math.sin(2.5), 20, 0, Math.PI * 2);
  ctx.fill();
}

function paintSun(ctx) {
  ctx.fillStyle = '#F4BC3C';
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ['#F7CD68', '#F9DA8C', '#FBE6B0'].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(CARD_W, 0, 620 - i * 170, 0, Math.PI * 2);
    ctx.fill();
  });
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Largest font size, from `max` down to `min`, that fits. Long text gets an ellipsis at `min`.
function fitText(ctx, text, maxWidth, weight, family, max, min) {
  let size = max;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > min) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  let out = text;
  if (ctx.measureText(out).width > maxWidth) {
    const chars = [...text];
    while (chars.length && ctx.measureText(`${chars.join('')}…`).width > maxWidth) chars.pop();
    out = `${chars.join('')}…`;
  }
  return out;
}

// A photo is kept with a zoom and centre, so the crop screen and the card always match.
export function drawPhoto(ctx, photo, x, y, size) {
  const { image, zoom, cx, cy } = photo;
  const iw = image.width;
  const ih = image.height;
  const visible = Math.min(iw, ih) / zoom;
  const sx = Math.min(Math.max(cx * iw - visible / 2, 0), iw - visible);
  const sy = Math.min(Math.max(cy * ih - visible / 2, 0), ih - visible);
  ctx.drawImage(image, sx, sy, visible, visible, x, y, size, size);
}

function drawAvatar(ctx, id, x, y, size, theme) {
  ctx.fillStyle = theme.accent;
  ctx.fillRect(x, y, size, size);
  ctx.save();
  const scale = (size * 0.56) / 24;
  ctx.translate(x + size * 0.22, y + size * 0.22);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.7;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke(new Path2D(AVATARS[id] ?? AVATARS.star));
  ctx.restore();
}

function drawPicture(ctx, state, theme, x, y, size) {
  ctx.save();
  roundedRect(ctx, x, y, size, size, 44);
  ctx.clip();
  if (state.photo) drawPhoto(ctx, state.photo, x, y, size);
  else drawAvatar(ctx, state.avatar, x, y, size, theme);
  ctx.restore();
}

function drawHeader(ctx, theme, lang, logo) {
  const size = 84;
  if (logo) {
    ctx.save();
    roundedRect(ctx, M, M, size, size, 18);
    ctx.clip();
    ctx.drawImage(logo, M, M, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = theme.accent;
    roundedRect(ctx, M, M, size, size, 18);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 36px Kanit';
    ctx.textAlign = 'center';
    ctx.fillText(CONFIG.university.monogram, M + size / 2, M + 56);
    ctx.textAlign = 'left';
  }
  const textX = M + size + 24;
  const width = CARD_W - textX - M;
  ctx.fillStyle = theme.ink;
  ctx.fillText(fitText(ctx, CONFIG.university[lang], width, 500, 'Kanit', 36, 24), textX, M + 36);
  ctx.fillStyle = theme.muted;
  const eventLine = `${CONFIG.event[lang]} · ${CONFIG.eventDate[lang]}`;
  ctx.fillText(fitText(ctx, eventLine, width, 400, 'Sarabun', 30, 22), textX, M + 78);
}

export function futureLine(future, lang) {
  if (!future) return '';
  return lang === 'th' ? `ว่าที่${future}` : `Future ${future}`;
}

function drawQrPanel(ctx, vcard, labels, y) {
  const panelH = 350;
  ctx.fillStyle = '#FFFFFF';
  roundedRect(ctx, M, y, CARD_W - 2 * M, panelH, 36);
  ctx.fill();

  // Low error correction gives fewer, larger squares, which scan better from another phone's screen.
  const qr = qrcode(0, 'L');
  qr.addData(vcard, 'Byte');
  qr.make();
  const modules = qr.getModuleCount();
  const cell = Math.floor(310 / modules);
  const qrSize = cell * modules;
  const qrX = M + 20 + Math.floor((310 - qrSize) / 2);
  const qrY = y + Math.floor((panelH - qrSize) / 2);
  ctx.fillStyle = '#000000';
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (qr.isDark(row, col)) ctx.fillRect(qrX + col * cell, qrY + row * cell, cell, cell);
    }
  }

  const textX = M + 360;
  const width = CARD_W - M - textX - 32;
  ctx.fillStyle = '#14201F';
  ctx.fillText(fitText(ctx, labels.qrTitle, width, 700, 'Kanit', 50, 30), textX, y + 158);
  ctx.fillStyle = '#4A5654';
  ctx.fillText(fitText(ctx, labels.qrHint, width, 400, 'Sarabun', 32, 22), textX, y + 214);
}

export function renderCard(canvas, state, lang, labels, logo) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  const theme = THEMES[state.theme] ?? THEMES.contour;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  theme.paint(ctx);
  drawHeader(ctx, theme, lang, logo);

  const handle = state.platform ? state.handle : '';
  const vcard = state.includeQr ? buildVCard({ nickname: state.nickname || '-', email: state.email, platform: state.platform, handle }) : null;
  // Without the QR panel, the content moves down to fill the space.
  const shift = vcard ? 0 : 190;
  const pictureSize = vcard ? 340 : 400;
  const pictureY = 196 + (vcard ? 0 : 40);
  drawPicture(ctx, state, theme, M, pictureY, pictureSize);

  const textWidth = CARD_W - 2 * M;
  let y = 650 + shift;
  ctx.fillStyle = theme.ink;
  const nickname = state.nickname || labels.namePreview;
  ctx.globalAlpha = state.nickname ? 1 : 0.55;
  ctx.fillText(fitText(ctx, nickname, textWidth, 700, 'Kanit', 112, 60), M, y);
  ctx.globalAlpha = 1;

  const future = futureLine(state.future, lang);
  if (future) {
    y += 64;
    ctx.fillStyle = theme.accent;
    ctx.fillText(fitText(ctx, future, textWidth, 500, 'Kanit', 48, 30), M, y);
  }

  const contacts = [];
  if (handle) contacts.push(`${PLATFORMS[state.platform].label}  ${state.handle}`);
  if (state.email) contacts.push(state.email);
  if (contacts.length) {
    y += 52;
    ctx.fillStyle = theme.ink;
    ctx.fillText(fitText(ctx, contacts.join('   ·   '), textWidth, 400, 'Sarabun', 32, 22), M, y);
  }

  if (vcard) drawQrPanel(ctx, vcard, labels, 900);

  ctx.fillStyle = theme.muted;
  ctx.fillText(fitText(ctx, CONFIG.admissionsText, textWidth, 400, 'Sarabun', 28, 20), M, CARD_H - 36);
}
