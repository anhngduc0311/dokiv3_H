import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: Request) {
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ message: 'Chưa đăng nhập.' }, { status: 401 });
  }

  const followsRows = await sql`
    SELECT f."MangaId", m."Title", m."Cover", m."Author", f."CreatedAt"
    FROM "Follows" f
    JOIN "Mangas" m ON m."Id" = f."MangaId"
    WHERE f."UserId" = ${user.id}
    ORDER BY f."CreatedAt" DESC;
  `;

  const historyRows = await sql`
    SELECT h."MangaId", m."Title", m."Cover", h."ChapterId", c."Title" as "chapterTitle", h."ReadAt"
    FROM "Histories" h
    JOIN "Mangas" m ON m."Id" = h."MangaId"
    JOIN "Chapters" c ON c."Id" = h."ChapterId"
    WHERE h."UserId" = ${user.id}
    ORDER BY h."ReadAt" DESC
    LIMIT 200;
  `;

  return NextResponse.json({
    follows: followsRows.map((r: any) => ({
      mangaId: r.MangaId,
      title: r.Title,
      cover: r.Cover,
      author: r.Author,
      createdAt: r.CreatedAt
    })),
    history: historyRows.map((r: any) => ({
      mangaId: r.MangaId,
      title: r.Title,
      cover: r.Cover,
      chapterId: r.ChapterId,
      chapterTitle: r.chapterTitle,
      readAt: r.ReadAt
    }))
  });
}
