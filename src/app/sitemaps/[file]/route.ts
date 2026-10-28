import { SITEMAP_SIZE, sitemapHeaders, sitemapRows, urlset } from '@/lib/sitemap';
import { CATALOG_SITEMAP_SIZE, catalogSitemapRows } from '@/lib/sitemap-catalog';

export const dynamic = 'force-dynamic';
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = /^(catalog-)?(0|[1-9]\d*)\.xml$/.exec(file);
  if (!match) return new Response('Not found', { status: 404 });
  const catalog = !!match[1];
  const page = Number(match[2]);
  if (!Number.isSafeInteger(page) || page > Math.floor(Number.MAX_SAFE_INTEGER / (catalog ? CATALOG_SITEMAP_SIZE : SITEMAP_SIZE))) return new Response('Not found', { status: 404 });
  try {
    if (catalog) {
      const rows = await catalogSitemapRows(page);
      // An entirely moderated shard is valid and may be empty.
      return new Response(urlset(rows), { headers: sitemapHeaders });
    }
    const rows = await sitemapRows(page);
    if (!rows.length) return new Response('Not found', { status: 404 });
    return new Response(urlset(rows.map(row => ({ path: `${row.prefix}${encodeURIComponent(row.id)}`, modified: row.modified }))), { headers: sitemapHeaders });
  } catch (error) {
    console.error('[SEO] Sitemap shard unavailable', error instanceof Error ? error.name : 'UnknownError');
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } });
  }
}
