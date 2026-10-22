import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';

export async function GET(req: Request) {
  await ensureDbInitialized();
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'dokitruyen.com';
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const baseUrl = `${proto}://${host}`;

  const today = new Date().toISOString().split('T')[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><lastmod>${today}</lastmod><changefreq>hourly</changefreq><priority>1.0</priority></url>
  <url><loc>${baseUrl}/tim-truyen-nang-cao</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>${baseUrl}/tac-gia</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>
`;

  try {
    const mangas = await sql`
      SELECT "Id", "UpdatedAt" FROM "Mangas"
      WHERE "IsHidden" = false AND "IsDraft" = false
      ORDER BY "UpdatedAt" DESC
      LIMIT 1000;
    `;

    for (const m of mangas) {
      const lastmod = m.UpdatedAt ? new Date(m.UpdatedAt).toISOString().split('T')[0] : today;
      xml += `  <url><loc>${baseUrl}/truyen-tranh/${m.Id}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>\n`;
    }
  } catch {}

  xml += `</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=1800, s-maxage=3600'
    }
  });
}
