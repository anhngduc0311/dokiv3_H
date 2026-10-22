import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ message: 'Chưa đăng nhập.' }, { status: 401 });
  }

  // Get mangaId from chapter
  const chap = await sql`SELECT "MangaId" FROM "Chapters" WHERE "Id" = ${id} LIMIT 1;`;
  if (!chap || chap.length === 0) {
    return NextResponse.json({ message: 'Chương không tồn tại.' }, { status: 404 });
  }

  const mangaId = chap[0].MangaId;
  await sql`
    INSERT INTO "Histories" ("UserId", "MangaId", "ChapterId", "ReadAt")
    VALUES (${user.id}, ${mangaId}, ${id}, CURRENT_TIMESTAMP)
    ON CONFLICT ("UserId", "MangaId") DO UPDATE SET
      "ChapterId" = EXCLUDED."ChapterId",
      "ReadAt" = EXCLUDED."ReadAt";
  `;

  return new NextResponse(null, { status: 204 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ message: 'Chưa đăng nhập.' }, { status: 401 });
  }

  await sql`
    DELETE FROM "Histories" WHERE "UserId" = ${user.id} AND "MangaId" = ${id};
  `;

  return new NextResponse(null, { status: 204 });
}
