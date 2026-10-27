export const COVER_HOSTS = ['moe-cdn.net', 'mimihentai.moe', 'uploads.mangadex.org'];

export function canOptimizeCover(src: string) {
  if (src.startsWith('/') && !src.startsWith('//') && !src.startsWith('/api/')) return true;
  try {
    const url = new URL(src);
    return url.protocol === 'https:' && url.port === '' && COVER_HOSTS.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}
