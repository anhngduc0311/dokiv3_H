import { absoluteUrl } from '@/lib/seo';
import { SITEMAP_SIZE, sitemapCount, sitemapHeaders, xmlEscape } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const pages = Math.ceil(await sitemapCount() / SITEMAP_SIZE);
    const paths = ['/sitemap-static.xml', ...Array.from({ length: pages }, (_, i) => `/sitemaps/${i}.xml`)];
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<sitemap><loc>${xmlEscape(absoluteUrl(path))}</loc></sitemap>`).join('')}</sitemapindex>`, { headers: sitemapHeaders });
  } catch (error) {
    console.error('[SEO] Sitemap index unavailable', error instanceof Error ? error.name : 'UnknownError');
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } });
  }
}
