import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';
import { getMangaChapters, searchCatalog } from '@/lib/catalog-service';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: Request) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '15', 10) || 15));
    const q = (searchParams.get('q') || '').trim();
    const status = searchParams.get('status') || 'all';
    const sourceType = searchParams.get('sourceType') || 'all';
    const visibility = searchParams.get('visibility') || 'all';

    if (searchParams.get('catalog') === 'public') {
      const catalog = await searchCatalog({ page, pageSize: Math.min(pageSize, 50), q, sort: 'latest' });
      const items = catalog.items.map(manga => ({
        ...manga,
        artist: '',
        sourceType: 'public',
        isHidden: false,
        isDraft: false,
        featured: false,
        views: manga.views ?? 0,
        chaptersCount: manga.totalChapters ?? manga.chaptersCount ?? null,
      }));
      return NextResponse.json({ ...catalog, items });
    }

    const offset = (page - 1) * pageSize;

    // Build dynamic conditions safely
    let whereConditions: string[] = [];
    const params: any[] = [];

    if (q) {
      whereConditions.push(`("Title" ILIKE $${params.length + 1} OR "Author" ILIKE $${params.length + 1})`);
      params.push(`%${q}%`);
    }

    if (status && status !== 'all') {
      whereConditions.push(`"Status" = $${params.length + 1}`);
      params.push(status);
    }

    if (sourceType && sourceType !== 'all') {
      whereConditions.push(`"SourceType" = $${params.length + 1}`);
      params.push(sourceType);
    }

    if (visibility === 'hidden') {
      whereConditions.push(`"IsHidden" = true`);
    } else if (visibility === 'visible') {
      whereConditions.push(`"IsHidden" = false`);
    } else if (visibility === 'draft') {
      whereConditions.push(`"IsDraft" = true`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Total count
    const countQuery = `SELECT count(*)::int as total FROM "Mangas" ${whereClause};`;
    const countRes = (await (sql as any).query(countQuery, params)) as any[];
    const total = countRes[0]?.total || 0;

    // Items query with chapters count
    const itemsQuery = `
      SELECT m."Id", m."Title", m."AlternativeTitle", m."Author", m."Artist",
             m."Cover", m."Status", m."SourceType", m."IsHidden", m."IsDraft",
             m."Featured", m."Views", m."Country", m."Genres", m."UpdatedAt",
             (SELECT count(*)::int FROM "Chapters" c WHERE c."MangaId" = m."Id") as "localChaptersCount"
      FROM "Mangas" m
      ${whereClause}
      ORDER BY m."UpdatedAt" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    const rawItems = (await (sql as any).query(itemsQuery, [...params, pageSize, offset])) as any[];

    // Process chapters count
    const items = await Promise.all(
      rawItems.map(async (m: any) => {
        let count = Number(m.localChaptersCount || 0);
        if (count <= 2) {
          try {
            const extChaps = await getMangaChapters(m.Id, 1, false);
            if (extChaps?.items && extChaps.items.length > count) {
              count = extChaps.items.length;
            }
          } catch {
            // ignore external fetch failures
          }
        }

        return {
          id: m.Id,
          title: m.Title,
          alternativeTitle: m.AlternativeTitle,
          author: m.Author,
          artist: m.Artist,
          cover: m.Cover,
          status: m.Status,
          sourceType: m.SourceType,
          isHidden: !!m.IsHidden,
          isDraft: !!m.IsDraft,
          featured: !!m.Featured,
          views: Number(m.Views || 0),
          country: m.Country,
          genres: m.Genres || [],
          chaptersCount: count,
          updatedAt: m.UpdatedAt
        };
      })
    );

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi tải danh sách truyện.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const body = await req.json();
    const title = (body.title || body.Title || '').trim();
    if (!title) {
      return NextResponse.json({ message: 'Tên truyện không được để trống.' }, { status: 400 });
    }

    const id = uuidv4();
    const alternativeTitle = (body.alternativeTitle || body.AlternativeTitle || '').trim();
    const author = (body.author || body.Author || '').trim();
    const artist = (body.artist || body.Artist || '').trim();
    const cover = (body.cover || body.Cover || '/cover-placeholder.svg').trim();
    const description = (body.description || body.Description || '').trim();
    const genres = Array.isArray(body.genres) ? body.genres : [];
    const status = (body.status || body.Status || 'ongoing').trim();
    const country = (body.country || body.Country || 'jp').trim();
    const demographic = (body.demographic || body.Demographic || 'shounen').trim();
    const year = Number(body.year || body.Year) || new Date().getFullYear();
    const featured = !!(body.featured ?? body.Featured);
    const sourceType = (body.sourceType || body.SourceType || 'original').trim();
    const isDraft = !!(body.isDraft ?? body.IsDraft);
    const isHidden = !!(body.isHidden ?? body.IsHidden);
    const scanlationGroup = (body.scanlationGroup || body.ScanlationGroup || '').trim();
    const tags = Array.isArray(body.tags) ? body.tags : [];
    const now = new Date().toISOString();

    await sql`
      INSERT INTO "Mangas" (
        "Id", "Title", "AlternativeTitle", "Author", "Artist", "Cover", "Description",
        "Genres", "Status", "Country", "Demographic", "Year", "Featured", "SourceType",
        "IsDraft", "IsHidden", "ScanlationGroup", "Tags", "Views", "UpdatedAt"
      ) VALUES (
        ${id}, ${title}, ${alternativeTitle}, ${author}, ${artist}, ${cover}, ${description},
        ${genres}, ${status}, ${country}, ${demographic}, ${year}, ${featured}, ${sourceType},
        ${isDraft}, ${isHidden}, ${scanlationGroup}, ${tags}, 0, ${now}
      );
    `;

    const logId = uuidv4();
    await sql`
      INSERT INTO "SystemLogs" ("Id", "Level", "Source", "Message", "CreatedAt")
      VALUES (${logId}, 'info', 'manga', ${`Tạo truyện mới: ${title} (${id})`}, ${now});
    `;

    return NextResponse.json(
      { id, title, status, updatedAt: now },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi tạo truyện.' }, { status: 500 });
  }
}
