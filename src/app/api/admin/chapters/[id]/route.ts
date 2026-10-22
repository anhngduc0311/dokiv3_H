import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';
import { getChapterReader } from '@/lib/catalog-service';

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
    const rows = await sql`
      SELECT "Id", "MangaId", "Number", "Title", "Language", "Pages", "Content",
             "ContentType", "IsLocked", "CoinPrice", "UnlockAt", "ScheduledPublishAt", "PublishedAt"
      FROM "Chapters"
      WHERE "Id" = ${id}
      LIMIT 1;
    `;

    if (rows && rows.length > 0) {
      const c = rows[0];
      return NextResponse.json({
        id: c.Id,
        mangaId: c.MangaId,
        number: Number(c.Number),
        title: c.Title,
        language: c.Language,
        pages: c.Pages || [],
        content: c.Content,
        contentType: c.ContentType,
        isLocked: !!c.IsLocked,
        coinPrice: Number(c.CoinPrice || 0),
        unlockAt: c.UnlockAt,
        scheduledPublishAt: c.ScheduledPublishAt,
        publishedAt: c.PublishedAt
      });
    }

    // Try fallback to catalog reader
    try {
      const r = await getChapterReader(id);
      if (r) {
        return NextResponse.json({
          id: r.chapter.id,
          mangaId: r.chapter.mangaId,
          number: Number(r.chapter.number),
          title: r.chapter.title,
          language: r.chapter.language,
          pages: r.pages || [],
          content: null,
          contentType: 'comic',
          isLocked: false,
          coinPrice: 0,
          unlockAt: null,
          scheduledPublishAt: null,
          publishedAt: r.chapter.publishedAt
        });
      }
    } catch {
      // ignore fallback error
    }

    return NextResponse.json({ message: 'Không tìm thấy chương.' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi truy xuất chương.' }, { status: 500 });
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
    const existing = await sql`
      SELECT "Id", "MangaId", "Number", "Title", "Language", "Pages", "Content",
             "ContentType", "IsLocked", "CoinPrice", "UnlockAt", "ScheduledPublishAt"
      FROM "Chapters"
      WHERE "Id" = ${id}
      LIMIT 1;
    `;

    if (!existing || existing.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy chương.' }, { status: 404 });
    }

    const cur = existing[0];
    const body = await req.json();

    const number = body.number !== undefined ? Number(body.number) : Number(cur.Number);
    const title = body.title !== undefined ? body.title.trim() : cur.Title;
    const language = body.language !== undefined ? body.language.trim() : cur.Language;
    const pages = Array.isArray(body.pages) ? body.pages : cur.Pages;
    const content = body.content !== undefined ? body.content : cur.Content;
    const contentType = body.contentType !== undefined ? body.contentType.trim() : cur.ContentType;
    const isLocked = body.isLocked !== undefined ? !!body.isLocked : !!cur.IsLocked;
    const coinPrice = body.coinPrice !== undefined ? Number(body.coinPrice) : Number(cur.CoinPrice || 0);
    const unlockAt = body.unlockAt !== undefined ? (body.unlockAt ? new Date(body.unlockAt).toISOString() : null) : cur.UnlockAt;
    const scheduledPublishAt = body.scheduledPublishAt !== undefined
      ? (body.scheduledPublishAt ? new Date(body.scheduledPublishAt).toISOString() : null)
      : cur.ScheduledPublishAt;

    await sql`
      UPDATE "Chapters"
      SET "Number" = ${number},
          "Title" = ${title},
          "Language" = ${language},
          "Pages" = ${pages},
          "Content" = ${content},
          "ContentType" = ${contentType},
          "IsLocked" = ${isLocked},
          "CoinPrice" = ${coinPrice},
          "UnlockAt" = ${unlockAt},
          "ScheduledPublishAt" = ${scheduledPublishAt}
      WHERE "Id" = ${id};
    `;

    if (cur.MangaId) {
      await sql`
        UPDATE "Mangas" SET "UpdatedAt" = CURRENT_TIMESTAMP WHERE "Id" = ${cur.MangaId};
      `;
    }

    return NextResponse.json({
      id,
      mangaId: cur.MangaId,
      number,
      title,
      language,
      pages,
      content,
      contentType,
      isLocked,
      coinPrice,
      unlockAt,
      scheduledPublishAt
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi cập nhật chương.' }, { status: 500 });
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
    await sql`DELETE FROM "Histories" WHERE "ChapterId" = ${id};`;
    await sql`DELETE FROM "Reports" WHERE "ChapterId" = ${id};`;
    await sql`DELETE FROM "Chapters" WHERE "Id" = ${id};`;

    return new Response(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi xóa chương.' }, { status: 500 });
  }
}
