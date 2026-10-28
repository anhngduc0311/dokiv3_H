import { SITEMAP_SIZE, sitemapCount, sitemapHeaders, sitemapRows, urlset } from '@/lib/sitemap';
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
    if (!rows.length) {
      // Remote shards follow the local shards in the same numbered index.
      // Keep catalog-N.xml above as a compatible alias for existing crawlers.
      const localPages = Math.ceil(await sitemapCount() / SITEMAP_SIZE);
      if (page < localPages) throw new Error('Local sitemap changed during pagination');
      const catalogRows = await catalogSitemapRows(page - localPages);
      // A shard with all entries moderated/stored locally may validly be empty.
      return new Response(urlset(catalogRows), { headers: sitemapHeaders });
    }
    return new Response(urlset(rows.map(row => ({ path: `${row.prefix}${encodeURIComponent(row.id)}`, modified: row.modified }))), { headers: sitemapHeaders });
  } catch (error) {
    console.error('[SEO] Sitemap shard unavailable', error instanceof Error ? error.name : 'UnknownError');
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } });
  }
}
