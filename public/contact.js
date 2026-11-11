// Contact helpers shared by the browser and the tests.

export const PLATFORMS = {
  line: { label: 'LINE', url: (h) => `https://line.me/ti/p/~${encodeURIComponent(h)}` },
  instagram: { label: 'Instagram', url: (h) => `https://www.instagram.com/${encodeURIComponent(h)}` },
  tiktok: { label: 'TikTok', url: (h) => `https://www.tiktok.com/@${encodeURIComponent(h)}` },
  facebook: { label: 'Facebook', url: (h) => `https://www.facebook.com/${encodeURIComponent(h)}` },
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const HANDLE_RE = /^[\p{L}\p{N}._-]{1,50}$/u;

// Accepts "@name", "name" or a pasted profile link, and returns just the handle.
export function normalizeHandle(input) {
  let value = String(input ?? '').trim();
  const fromUrl = value.match(/^(?:https?:\/\/)?(?:www\.|m\.)?[a-z0-9.-]+\.[a-z]{2,}\/(.+)$/i);
  if (fromUrl) value = fromUrl[1].split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop();
  return value.replace(/^(?:ti\/p\/)?[~@]+/, '');
}

function escapeVCard(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/([,;])/g, '\\$1');
}

// Holds only what the student filled in. Returns null when there is nothing to swap.
export function buildVCard({ nickname, email, platform, handle }) {
  const url = platform && handle && PLATFORMS[platform] ? PLATFORMS[platform].url(handle) : '';
  if (!email && !url) return null;
  const name = escapeVCard(nickname);
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N;CHARSET=UTF-8:;${name};;;`, `FN;CHARSET=UTF-8:${name}`];
  if (email) lines.push(`EMAIL:${escapeVCard(email)}`);
  if (url) lines.push(`URL:${url}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}
