import { CONFIG } from './config.js';
import { TEXT } from './i18n.js';
import { AVATARS, CARD_H, CARD_W, THEMES, drawPhoto, renderCard } from './card.js';
import { EMAIL_RE, HANDLE_RE, buildVCard, normalizeHandle } from './contact.js';

const $ = (id) => document.getElementById(id);
const STEP_NUMBERS = { details: 1, picture: 2, theme: 3, save: 4 };
const MAX_PHOTO_BYTES = 30 * 1024 * 1024;
const MAX_PHOTO_EDGE = 1400;

// Held in memory only. Refreshing the page clears everything.
const state = {
  nickname: '',
  future: '',
  email: '',
  platform: '',
  handle: '',
  avatar: 'star',
  photo: null,
  theme: 'contour',
  includeQr: true,
};

let lang = 'th';
let step = 'details';
let logo = null;
let renderQueued = false;
let finalUrl = null;
let finalFile = null;
let finalRequest = 0;
let doneKey = 'doneSkipped';

const t = (key) => TEXT[lang][key] ?? key;
const labels = () => ({ namePreview: t('namePreview'), qrTitle: t('qrTitle'), qrHint: t('qrHint') });

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderCard($('preview'), state, lang, labels(), logo);
  });
}

function hasContact() {
  return Boolean(buildVCard({ nickname: 'x', email: state.email, platform: state.platform, handle: state.handle }));
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  $('langToggle').textContent = t('language');
  $('future').placeholder = t('futurePlaceholder');
  $('followBody').textContent = t('followBody')
    .replace('{uni}', CONFIG.university[lang])
    .replace('{contact}', CONFIG.privacyContact);
  $('doneMessage').textContent = t(doneKey);

  const program = $('leadProgram');
  const selected = program.value;
  program.replaceChildren(new Option(t('choose'), ''), ...CONFIG.programs.map((p) => new Option(p[lang], p.id)));
  program.value = selected;

  buildThemeChoices();
  updateStepLabel();
  queueRender();
  if (step === 'save') makeFinalCard();
}

function updateStepLabel() {
  const number = STEP_NUMBERS[step];
  $('stepLabel').textContent = number ? t('stepOf').replace('{n}', number) : '';
  $('stepLabel').hidden = !number;
}

function goTo(next, { focus = true } = {}) {
  step = next;
  document.querySelectorAll('section[data-step]').forEach((section) => {
    section.hidden = section.dataset.step !== next;
  });
  const showPreview = ['details', 'picture', 'theme'].includes(next);
  $('previewWrap').hidden = !showPreview;
  document.querySelector('.layout').classList.toggle('no-preview', !showPreview);
  updateStepLabel();
  if (next === 'picture') drawCrop();
  if (next === 'theme') updateQrControls();
  if (next === 'save') makeFinalCard();
  if (next === 'follow') prefillContact();
  window.scrollTo(0, 0);
  if (focus) document.querySelector(`section[data-step="${next}"] h2`)?.focus();
}

// Step 1
function readDetails() {
  state.nickname = $('nickname').value.trim();
  state.future = $('future').value.trim();
  state.email = $('email').value.trim();
  state.platform = $('platform').value;
  state.handle = state.platform ? normalizeHandle($('handle').value) : '';
  $('handleRow').hidden = !state.platform;
  queueRender();
}

function validateDetails() {
  if (!state.nickname) return { key: 'errNickname', field: 'nickname' };
  if (state.email && !EMAIL_RE.test(state.email)) return { key: 'errEmail', field: 'email' };
  if (state.platform && state.handle && !HANDLE_RE.test(state.handle)) return { key: 'errHandle', field: 'handle' };
  return null;
}

// Step 2
function loadPhoto(file) {
  $('photoError').textContent = '';
  if (!file) return;
  if (file.size > MAX_PHOTO_BYTES) {
    $('photoError').textContent = t('errPhoto');
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    // Shrink large photos so older phones don't run out of memory.
    const scale = Math.min(1, MAX_PHOTO_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const small = document.createElement('canvas');
    small.width = Math.round(img.naturalWidth * scale);
    small.height = Math.round(img.naturalHeight * scale);
    small.getContext('2d').drawImage(img, 0, 0, small.width, small.height);
    URL.revokeObjectURL(url);
    state.photo = { image: small, zoom: 1, cx: 0.5, cy: 0.5 };
    $('zoom').value = '1';
    updatePictureControls();
    drawCrop();
    queueRender();
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    $('photoError').textContent = t('errPhoto');
  };
  img.src = url;
}

function updatePictureControls() {
  $('cropper').hidden = !state.photo;
  $('avatarArea').hidden = Boolean(state.photo);
}

function drawCrop() {
  if (!state.photo) return;
  const canvas = $('cropCanvas');
  drawPhoto(canvas.getContext('2d'), state.photo, 0, 0, canvas.width);
}

function clampCrop() {
  const { image, zoom } = state.photo;
  const visible = Math.min(image.width, image.height) / zoom;
  const halfX = visible / 2 / image.width;
  const halfY = visible / 2 / image.height;
  state.photo.cx = Math.min(Math.max(state.photo.cx, halfX), 1 - halfX);
  state.photo.cy = Math.min(Math.max(state.photo.cy, halfY), 1 - halfY);
}

function setupCropper() {
  const canvas = $('cropCanvas');
  let last = null;
  canvas.addEventListener('pointerdown', (event) => {
    last = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!last || !state.photo) return;
    const { image, zoom } = state.photo;
    const perPixel = Math.min(image.width, image.height) / zoom / canvas.clientWidth;
    state.photo.cx -= ((event.clientX - last.x) * perPixel) / image.width;
    state.photo.cy -= ((event.clientY - last.y) * perPixel) / image.height;
    last = { x: event.clientX, y: event.clientY };
    clampCrop();
    drawCrop();
    queueRender();
  });
  const stop = () => { last = null; };
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointercancel', stop);

  $('zoom').addEventListener('input', (event) => {
    if (!state.photo) return;
    state.photo.zoom = Number(event.target.value);
    clampCrop();
    drawCrop();
    queueRender();
  });
  $('photoInput').addEventListener('change', (event) => {
    loadPhoto(event.target.files[0]);
    event.target.value = '';
  });
  $('removePhoto').addEventListener('click', () => {
    state.photo = null;
    updatePictureControls();
    queueRender();
  });
}

function setPressed(container, button) {
  container.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
}

function buildAvatarChoices() {
  const container = $('avatars');
  Object.keys(AVATARS).forEach((id) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.setAttribute('aria-label', id);
    button.setAttribute('aria-pressed', String(id === state.avatar));
    const icon = document.createElement('canvas');
    icon.width = 96;
    icon.height = 96;
    const ctx = icon.getContext('2d');
    ctx.fillStyle = '#17403F';
    ctx.fillRect(0, 0, 96, 96);
    ctx.translate(20, 20);
    ctx.scale(56 / 24, 56 / 24);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(new Path2D(AVATARS[id]));
    button.append(icon);
    button.addEventListener('click', () => {
      state.avatar = id;
      setPressed(container, button);
      queueRender();
    });
    container.append(button);
  });
}

// Step 3
function buildThemeChoices() {
  const container = $('themes');
  container.replaceChildren();
  Object.entries(THEMES).forEach(([id, theme]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.setAttribute('aria-pressed', String(id === state.theme));
    const swatch = document.createElement('canvas');
    swatch.width = CARD_W;
    swatch.height = CARD_H;
    theme.paint(swatch.getContext('2d'));
    const name = document.createElement('span');
    name.textContent = theme.name[lang];
    button.append(swatch, name);
    button.addEventListener('click', () => {
      state.theme = id;
      setPressed(container, button);
      queueRender();
    });
    container.append(button);
  });
}

function updateQrControls() {
  const available = hasContact();
  $('includeQr').disabled = !available;
  $('qrNote').hidden = available;
}

// Step 4
function makeFinalCard() {
  const canvas = document.createElement('canvas');
  renderCard(canvas, state, lang, labels(), logo);
  $('qrWarning').hidden = !(state.includeQr && hasContact());
  // Encoding can take a second on a phone. Saving stays unavailable until the image is ready.
  const request = ++finalRequest;
  $('saveLink').hidden = true;
  $('shareBtn').hidden = true;
  canvas.toBlob((blob) => {
    if (request !== finalRequest) return;
    $('saveLink').hidden = false;
    if (finalUrl) URL.revokeObjectURL(finalUrl);
    finalUrl = URL.createObjectURL(blob);
    finalFile = new File([blob], 'open-house-card.png', { type: 'image/png' });
    $('finalCard').src = finalUrl;
    $('finalCard').alt = state.nickname;
    $('saveLink').href = finalUrl;
    $('shareBtn').hidden = !navigator.canShare?.({ files: [finalFile] });
  }, 'image/png');
}

async function shareCard() {
  try {
    await navigator.share({ files: [finalFile] });
  } catch (err) {
    // Closing the share sheet is not an error worth showing.
    if (err.name !== 'AbortError') console.warn(err);
  }
}

// Step 5
function prefillContact() {
  if ($('leadName').value === '') $('leadName').value = state.nickname;
  setContactFromCard();
}

function setContactFromCard() {
  const method = $('leadMethod').value;
  const field = $('leadContact');
  if (field.value) return;
  if (method === 'email') field.value = state.email;
  if (method === 'line' && state.platform === 'line') field.value = state.handle;
}

function contactInputType(method) {
  const field = $('leadContact');
  field.type = method === 'email' ? 'email' : method === 'phone' ? 'tel' : 'text';
  field.inputMode = method === 'email' ? 'email' : method === 'phone' ? 'tel' : 'text';
}

async function submitLead(event) {
  event.preventDefault();
  const error = $('followError');
  error.textContent = '';
  if (!$('leadConsent').checked) {
    error.textContent = t('errConsent');
    return;
  }
  const required = ['leadName', 'leadGrade', 'leadProgram', 'leadMethod', 'leadContact'];
  if (required.some((id) => !$(id).value.trim())) {
    error.textContent = t('errForm');
    return;
  }
  const button = $('sendLead');
  button.disabled = true;
  button.textContent = t('sending');
  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: $('leadName').value,
        grade: Number($('leadGrade').value),
        programId: $('leadProgram').value,
        contactMethod: $('leadMethod').value,
        contactValue: $('leadContact').value,
        consent: true,
        noticeVersion: CONFIG.noticeVersion,
        website: $('website').value,
      }),
    });
    if (response.ok) {
      $('followForm').reset();
      doneKey = 'doneSent';
      $('doneMessage').textContent = t(doneKey);
      goTo('done');
      return;
    }
    const data = await response.json().catch(() => ({}));
    error.textContent = t(response.status === 429 ? 'errBusy' : data.error === 'invalid_contact' ? 'errContact' : 'errSend');
  } catch {
    error.textContent = t('errSend');
  } finally {
    button.disabled = false;
    button.textContent = t('send');
  }
}

function detectInAppBrowser() {
  const ua = navigator.userAgent;
  const isLine = /\bLine\//i.test(ua);
  if (!isLine && !/FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|musical_ly|BytedanceWebview/i.test(ua)) return;
  $('inAppBanner').hidden = false;
  if (isLine) {
    // LINE opens this parameter in the phone's normal browser.
    const url = new URL(location.href);
    url.searchParams.set('openExternalBrowser', '1');
    $('inAppLink').href = url.href;
    $('inAppLink').hidden = false;
  } else {
    $('inAppOther').hidden = false;
  }
}

async function loadAssets() {
  const fonts = ['500 40px Kanit', '700 40px Kanit', '400 40px Sarabun', '600 40px Sarabun'];
  await Promise.allSettled(fonts.flatMap((font) => [document.fonts.load(font, 'กขค'), document.fonts.load(font, 'Abc')]));
  if (CONFIG.logoUrl) {
    logo = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = CONFIG.logoUrl;
    });
  }
}

function init() {
  $('testBanner').hidden = !CONFIG.testMode;
  $('followTest').hidden = !CONFIG.testMode;
  detectInAppBrowser();

  ['nickname', 'future', 'email', 'platform', 'handle'].forEach((id) => {
    $(id).addEventListener('input', readDetails);
  });
  $('detailsNext').addEventListener('click', () => {
    readDetails();
    const problem = validateDetails();
    $('detailsError').textContent = problem ? t(problem.key) : '';
    if (problem) {
      $(problem.field).focus();
      return;
    }
    goTo('picture');
  });

  document.querySelectorAll('[data-go]').forEach((button) => {
    button.addEventListener('click', () => goTo(button.dataset.go));
  });

  setupCropper();
  buildAvatarChoices();

  $('includeQr').addEventListener('change', (event) => {
    state.includeQr = event.target.checked;
    queueRender();
  });
  $('makeCard').addEventListener('click', () => goTo('save'));
  $('shareBtn').addEventListener('click', shareCard);

  $('leadMethod').addEventListener('change', (event) => {
    contactInputType(event.target.value);
    $('leadContact').value = '';
    setContactFromCard();
  });
  $('followForm').addEventListener('submit', submitLead);
  $('noThanks').addEventListener('click', () => {
    doneKey = 'doneSkipped';
    $('doneMessage').textContent = t(doneKey);
    goTo('done');
  });

  $('langToggle').addEventListener('click', () => {
    lang = lang === 'th' ? 'en' : 'th';
    applyLanguage();
  });

  applyLanguage();
  goTo('details', { focus: false });
}

loadAssets().finally(init);
