import { sql } from './db';
import { getMimiSitemapPage } from './mimi-catalog';
import { mangaPath } from './seo';

// Ten bounded API pages per shard: no full-catalog crawl in one request.
// The upstream caps page_size at 48, even when asked for 50.
const API_PAGE_SIZE = 48;
const PAGES_PER_SHARD = 10;
export const CATALOG_SITEMAP_SIZE = API_PAGE_SIZE * PAGES_PER_SHARD;

export async function catalogSitemapPaths() {
  const first = await getMimiSitemapPage(1);
  return Array.from({ length: Math.ceil(first.total_items / CATALOG_SITEMAP_SIZE) },
    (_, i) => `/sitemaps/catalog-${i}.xml`);
}

export async function catalogSitemapRows(shard: number) {
  const firstPage = shard * PAGES_PER_SHARD + 1;
  const first = await getMimiSitemapPage(firstPage);
  const totalPages = Math.ceil(first.total_items / API_PAGE_SIZE);
  if (firstPage > totalPages) return [];
  const remaining = Math.min(PAGES_PER_SHARD - 1, totalPages - firstPage);
  // Limit upstream concurrency to three, including on cold cache.
  const items = [...first.items];
  for (let offset = 1; offset <= remaining; offset += 3) {
    const pages = await Promise.all(Array.from({ length: Math.min(3, remaining - offset + 1) },
      (_, i) => getMimiSitemapPage(firstPage + offset + i)));
    items.push(...pages.flatMap(page => page.items));
  }
  const unique = [...new Map(items.map(item => [String(item.id), item])).values()];
  if (!unique.length) throw new Error('Unexpected empty sitemap catalog page');
  // Honor local moderation even when the same story remains public upstream.
  // Already stored public manga are covered by the existing database sitemap.
  const stored = await sql`SELECT "Id" FROM "Mangas" WHERE "Id"::text = ANY(${unique.map(item => String(item.id))}::text[])`;
  const localIds = new Set(stored.map(row => String(row.Id)));
  return unique.filter(item => !localIds.has(String(item.id)))
    .map(item => ({ path: mangaPath(String(item.id)), modified: item.last_updated }));
}
