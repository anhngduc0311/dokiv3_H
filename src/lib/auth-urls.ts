import { SITE_URL } from './seo';

// Cloudflare Flexible reaches Nginx over HTTP, so forwarded-proto alone cannot
// identify the public OAuth callback. Only accept known application hosts.
export function googleAuthOrigin(request: Request): string {
  const configured = new URL(process.env.NEXT_PUBLIC_APP_URL || SITE_URL);
  const canonical = new URL(SITE_URL);
  const allowed = new Set([configured.host, canonical.host]);
  const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host).split(',')[0].trim();
  if (process.env.NODE_ENV !== 'production' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
    return `http://${host}`;
  }
  return `https://${allowed.has(host) ? host : canonical.host}`;
}

export function safeReturnUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return '/';
  return value;
}
