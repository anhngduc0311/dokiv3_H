import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';
import { getMangaChapters } from '@/lib/catalog-service';
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

    const { id: mangaId } = await params;

    if (new URL(req.url).searchParams.get('catalog') === 'public') {
      const { items } = await getMangaChapters(mangaId);
      return NextResponse.json(items.map(chapter => ({
        ...chapter,
        contentType: chapter.contentType ?? 'comic',
        pagesCount: chapter.pagesCount ?? 0,
        isLocked: false,
        coinPrice: 0,
        hasContent: false,
        readOnly: true,
      })));
    }

    const localRows = await sql`
      SELECT "Id", "MangaId", "Number", "Title", "Language", "ContentType",
             "IsLocked", "CoinPrice", "UnlockAt", "ScheduledPublishAt", "PublishedAt",
             "Pages", "Content"
      FROM "Chapters"
      WHERE "MangaId" = ${mangaId}
      ORDER BY "Number" DESC;
    `;

    const chaptersMap = new Map<string, any>();
    const numbersSet = new Set<number>();

    for (const c of localRows) {
      const num = Number(c.Number);
      numbersSet.add(num);
      chaptersMap.set(c.Id, {
        id: c.Id,
        mangaId: c.MangaId,
        number: num,
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
      });
    }

    // Attempt to merge external chapters if few local chapters exist
    try {
      const extRes = await getMangaChapters(mangaId, 1, false);
      const extChapters = extRes?.items || [];

      if (extChapters.length > 0) {
        for (const ext of extChapters) {
          const num = Number(ext.number);
          if (!chaptersMap.has(ext.id) && !numbersSet.has(num)) {
            numbersSet.add(num);
            chaptersMap.set(ext.id, {
              id: ext.id,
              mangaId,
              number: num,
              title: ext.title || `Chương ${num}`,
              language: ext.language || 'vi',
              contentType: ext.contentType ?? 'comic',
              isLocked: false,
              coinPrice: 0,
              unlockAt: null,
              scheduledPublishAt: null,
              publishedAt: ext.publishedAt,
              pagesCount: ext.pagesCount ?? 0,
              hasContent: false,
              readOnly: true
            });
          }
        }
      }
    } catch {
      // ignore external fetch failures
    }

    const chapters = Array.from(chaptersMap.values()).sort((a, b) => b.number - a.number);
    return NextResponse.json(chapters);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi tải danh sách chương.' }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { id: mangaId } = await params;
    const mangaRows = await sql`
      SELECT "Id", "Title" FROM "Mangas" WHERE "Id" = ${mangaId} LIMIT 1;
    `;

    if (!mangaRows || mangaRows.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy truyện tương ứng.' }, { status: 404 });
    }

    const manga = mangaRows[0];
    const body = await req.json();

    const chapterId = uuidv4();
    const number = Number(body.number || body.Number) || 1;
    const title = (body.title || body.Title || `Chương ${number}`).trim();
    const language = (body.language || body.Language || 'vi').trim();
    const pages = Array.isArray(body.pages) ? body.pages : [];
    const content = body.content || null;
    const contentType = (body.contentType || body.ContentType || 'comic').trim();
    const isLocked = !!(body.isLocked ?? body.IsLocked);
    const coinPrice = Number(body.coinPrice || body.CoinPrice) || 0;
    const unlockAt = body.unlockAt ? new Date(body.unlockAt).toISOString() : null;
    const scheduledPublishAt = body.scheduledPublishAt
      ? new Date(body.scheduledPublishAt).toISOString()
      : null;
    const publishedAt = scheduledPublishAt || new Date().toISOString();
    const now = new Date().toISOString();

    await sql`
      INSERT INTO "Chapters" (
        "Id", "MangaId", "Number", "Title", "Language", "Pages", "Content",
        "ContentType", "IsLocked", "CoinPrice", "UnlockAt", "ScheduledPublishAt", "PublishedAt"
      ) VALUES (
        ${chapterId}, ${mangaId}, ${number}, ${title}, ${language}, ${pages}, ${content},
        ${contentType}, ${isLocked}, ${coinPrice}, ${unlockAt}, ${scheduledPublishAt}, ${publishedAt}
      );
    `;

    await sql`
      UPDATE "Mangas" SET "UpdatedAt" = ${now} WHERE "Id" = ${mangaId};
    `;

    const logId = uuidv4();
    await sql`
      INSERT INTO "SystemLogs" ("Id", "Level", "Source", "Message", "CreatedAt")
      VALUES (${logId}, 'info', 'chapter', ${`Thêm chương mới [${title}] cho truyện [${manga.Title}]`}, ${now});
    `;

    return NextResponse.json(
      { id: chapterId, mangaId, number, title },
      { status: 201 }
    );
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi thêm chương mới.' }, { status: 500 });
  }
}
