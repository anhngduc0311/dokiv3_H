import { SITEMAP_SIZE, sitemapCount, sitemapHeaders, sitemapIndex } from '@/lib/sitemap';
import { catalogSitemapPaths } from '@/lib/sitemap-catalog';

export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    const [local, catalog] = await Promise.allSettled([sitemapCount(), catalogSitemapPaths()]);
    // The database is authoritative for published and moderated local URLs.
    // Keep its failures retryable, but an optional upstream outage must not
    // take the working local and static sitemaps offline as well.
    if (local.status === 'rejected') throw local.reason;
    const pages = Math.ceil(local.value / SITEMAP_SIZE);
    const catalogPaths = catalog.status === 'fulfilled' ? catalog.value : [];
    if (catalog.status === 'rejected') {
      console.warn('[SEO] Remote catalog sitemap unavailable; serving local sitemaps',
        catalog.reason instanceof Error ? catalog.reason.message : 'UnknownError');
    }
    // One continuous numbered list, with the static sitemap first.
    const paths = ['/sitemap-static.xml', ...Array.from({ length: pages + catalogPaths.length }, (_, i) => `/sitemaps/${i}.xml`)];
    // Never let a degraded index replace the full index in a browser/CDN cache.
    const headers = catalog.status === 'fulfilled' ? sitemapHeaders : {
      'Content-Type': sitemapHeaders['Content-Type'],
      'Cache-Control': 'no-store',
    };
    return new Response(sitemapIndex(paths), { headers });
  } catch (error) {
    console.error('[SEO] Sitemap index unavailable', error instanceof Error ? error.name : 'UnknownError');
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } });
  }
}
