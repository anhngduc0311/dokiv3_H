import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { id } = await params;
    const mangaRows = await sql`
      SELECT "Id", "Title", "AlternativeTitle", "Author", "Artist", "Cover",
             "Description", "Genres", "Status", "Country", "Demographic", "Year",
             "Featured", "SourceType", "IsDraft", "IsHidden", "ScanlationGroup",
             "Tags", "Views", "UpdatedAt"
      FROM "Mangas"
      WHERE "Id" = ${id}
      LIMIT 1;
    `;

    if (!mangaRows || mangaRows.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy truyện.' }, { status: 404 });
    }

    const m = mangaRows[0];

    const chapterRows = await sql`
      SELECT "Id", "Number", "Title", "Language", "ContentType", "IsLocked",
             "CoinPrice", "UnlockAt", "ScheduledPublishAt", "PublishedAt",
             "Pages", "Content"
      FROM "Chapters"
      WHERE "MangaId" = ${id}
      ORDER BY "Number" DESC;
    `;

    const chapters = chapterRows.map((c: any) => ({
      id: c.Id,
      number: Number(c.Number),
      title: c.Title,
      language: c.Language,
      contentType: c.ContentType,
      isLocked: !!c.IsLocked,
      coinPrice: Number(c.CoinPrice || 0),
      unlockAt: c.UnlockAt,
      scheduledPublishAt: c.ScheduledPublishAt,
      publishedAt: c.PublishedAt,
      pagesCount: Array.isArray(c.Pages) ? c.Pages.length : 0,
      hasContent: !!(c.Content && c.Content.trim().length > 0)
    }));

    return NextResponse.json({
      id: m.Id,
      title: m.Title,
      alternativeTitle: m.AlternativeTitle,
      author: m.Author,
      artist: m.Artist,
      cover: m.Cover,
      description: m.Description,
      genres: m.Genres || [],
      status: m.Status,
      country: m.Country,
      demographic: m.Demographic,
      year: m.Year,
      featured: !!m.Featured,
      sourceType: m.SourceType,
      isDraft: !!m.IsDraft,
      isHidden: !!m.IsHidden,
      scanlationGroup: m.ScanlationGroup,
      tags: m.Tags || [],
      views: Number(m.Views || 0),
      updatedAt: m.UpdatedAt,
      chapters
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi truy xuất truyện.' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const title = (body.title || body.Title || '').trim();
    if (!title) {
      return NextResponse.json({ message: 'Tên truyện không được để trống.' }, { status: 400 });
    }

    const existing = await sql`
      SELECT "Id", "Title", "AlternativeTitle", "Author", "Artist", "Cover", "Description",
             "Genres", "Status", "Country", "Demographic", "Year", "Featured", "SourceType",
             "IsDraft", "IsHidden", "ScanlationGroup", "Tags"
      FROM "Mangas"
      WHERE "Id" = ${id}
      LIMIT 1;
    `;

    if (!existing || existing.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy truyện.' }, { status: 404 });
    }

    const cur = existing[0];
    const alternativeTitle = body.alternativeTitle !== undefined ? body.alternativeTitle.trim() : cur.AlternativeTitle;
    const author = body.author !== undefined ? body.author.trim() : cur.Author;
    const artist = body.artist !== undefined ? body.artist.trim() : cur.Artist;
    const cover = body.cover !== undefined && body.cover.trim() ? body.cover.trim() : cur.Cover;
    const description = body.description !== undefined ? body.description.trim() : cur.Description;
    const genres = Array.isArray(body.genres) ? body.genres : cur.Genres;
    const status = body.status !== undefined && body.status.trim() ? body.status.trim() : cur.Status;
    const country = body.country !== undefined && body.country.trim() ? body.country.trim() : cur.Country;
    const demographic = body.demographic !== undefined && body.demographic.trim() ? body.demographic.trim() : cur.Demographic;
    const year = body.year !== undefined ? Number(body.year) : cur.Year;
    const featured = body.featured !== undefined ? !!body.featured : cur.Featured;
    const sourceType = body.sourceType !== undefined && body.sourceType.trim() ? body.sourceType.trim() : cur.SourceType;
    const isDraft = body.isDraft !== undefined ? !!body.isDraft : cur.IsDraft;
    const isHidden = body.isHidden !== undefined ? !!body.isHidden : cur.IsHidden;
    const scanlationGroup = body.scanlationGroup !== undefined ? body.scanlationGroup.trim() : cur.ScanlationGroup;
    const tags = Array.isArray(body.tags) ? body.tags : cur.Tags;
    const now = new Date().toISOString();

    await sql`
      UPDATE "Mangas"
      SET "Title" = ${title},
          "AlternativeTitle" = ${alternativeTitle},
          "Author" = ${author},
          "Artist" = ${artist},
          "Cover" = ${cover},
          "Description" = ${description},
          "Genres" = ${genres},
          "Status" = ${status},
          "Country" = ${country},
          "Demographic" = ${demographic},
          "Year" = ${year},
          "Featured" = ${featured},
          "SourceType" = ${sourceType},
          "IsDraft" = ${isDraft},
          "IsHidden" = ${isHidden},
          "ScanlationGroup" = ${scanlationGroup},
          "Tags" = ${tags},
          "UpdatedAt" = ${now}
      WHERE "Id" = ${id};
    `;

    return NextResponse.json({ id, title, status, updatedAt: now });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi cập nhật truyện.' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await sql`
      SELECT "Id", "Title" FROM "Mangas" WHERE "Id" = ${id} LIMIT 1;
    `;

    if (!existing || existing.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy truyện.' }, { status: 404 });
    }

    const title = existing[0].Title;

    // Delete related records
    await sql`DELETE FROM "Chapters" WHERE "MangaId" = ${id};`;
    await sql`DELETE FROM "Follows" WHERE "MangaId" = ${id};`;
    await sql`DELETE FROM "Ratings" WHERE "MangaId" = ${id};`;
    await sql`DELETE FROM "Histories" WHERE "MangaId" = ${id};`;
    await sql`DELETE FROM "Comments" WHERE "MangaId" = ${id};`;
    await sql`DELETE FROM "Reports" WHERE "MangaId" = ${id};`;
    await sql`DELETE FROM "Mangas" WHERE "Id" = ${id};`;

    const logId = uuidv4();
    await sql`
      INSERT INTO "SystemLogs" ("Id", "Level", "Source", "Message", "CreatedAt")
      VALUES (${logId}, 'warning', 'manga', ${`Đã xóa truyện: ${title} (${id})`}, CURRENT_TIMESTAMP);
    `;

    return new Response(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi xóa truyện.' }, { status: 500 });
  }
}
