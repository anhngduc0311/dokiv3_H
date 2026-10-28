import { sql } from './db';
import { absoluteUrl, isoDate } from './seo';

export const SITEMAP_SIZE = 5000;
export const xmlEscape = (value: string) => value.replace(/[<>&'\"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
export const sitemapHeaders = { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' };
export function sitemapIndex(paths: string[]) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map(path => `  <sitemap>\n    <loc>${xmlEscape(absoluteUrl(path))}</loc>\n  </sitemap>`),
    '</sitemapindex>',
  ].join('\n');
}
export function urlset(rows: { path: string; modified?: string | Date | null }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows.map(row => {
    const date = isoDate(row.modified);
    return `<url><loc>${xmlEscape(absoluteUrl(row.path))}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`;
  }).join('')}</urlset>`;
}
// Read-only: sitemap requests must never run migrations or seed data.
export async function sitemapCount() {
  const rows = await sql`
    SELECT
      (SELECT count(*) FROM "Mangas" WHERE "IsHidden" = false AND "IsDraft" = false) +
      (SELECT count(*) FROM "Chapters" c JOIN "Mangas" m ON m."Id" = c."MangaId"
       WHERE m."IsHidden" = false AND m."IsDraft" = false
       AND c."PublishedAt" <= NOW() AND (c."ScheduledPublishAt" IS NULL OR c."ScheduledPublishAt" <= NOW())
       AND c."IsLocked" = false) AS total;
  `;
  return Number(rows[0]?.total || 0);
}
export async function sitemapRows(page: number) {
  return sql`
    SELECT * FROM (
      SELECT '/truyen-tranh/' AS prefix, "Id" AS id, "UpdatedAt" AS modified
      FROM "Mangas" WHERE "IsHidden" = false AND "IsDraft" = false
      UNION ALL
      SELECT '/chuong/' AS prefix, c."Id" AS id, c."PublishedAt" AS modified
      FROM "Chapters" c JOIN "Mangas" m ON m."Id" = c."MangaId"
      WHERE m."IsHidden" = false AND m."IsDraft" = false
      AND c."PublishedAt" <= NOW() AND (c."ScheduledPublishAt" IS NULL OR c."ScheduledPublishAt" <= NOW())
      AND c."IsLocked" = false
    ) urls ORDER BY prefix, id LIMIT ${SITEMAP_SIZE} OFFSET ${page * SITEMAP_SIZE};
  `;
}
