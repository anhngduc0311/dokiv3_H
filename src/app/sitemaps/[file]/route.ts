import { SITEMAP_SIZE, sitemapHeaders, sitemapRows, urlset } from '@/lib/sitemap';

export const dynamic = 'force-dynamic';
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^(0|[1-9]\d*)\.xml$/.test(file)) return new Response('Not found', { status: 404 });
  const page = Number(file.slice(0, -4));
  if (!Number.isSafeInteger(page) || page > Math.floor(Number.MAX_SAFE_INTEGER / SITEMAP_SIZE)) return new Response('Not found', { status: 404 });
  try {
    const rows = await sitemapRows(page);
    if (!rows.length) return new Response('Not found', { status: 404 });
    return new Response(urlset(rows.map(row => ({ path: `${row.prefix}${encodeURIComponent(row.id)}`, modified: row.modified }))), { headers: sitemapHeaders });
  } catch (error) {
    console.error('[SEO] Sitemap shard unavailable', error instanceof Error ? error.name : 'UnknownError');
    return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Retry-After': '300', 'Cache-Control': 'no-store' } });
  }
}
