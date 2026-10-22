import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { getMangaDetail, rememberManga } from '@/lib/catalog-service';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ message: 'Chưa đăng nhập.' }, { status: 401 });
  }

  const body = await req.json();
  const followed = !!body.Followed || !!body.followed;

  const detail = await getMangaDetail(id);
  if (detail) {
    await rememberManga(detail);
  }

  if (followed) {
    await sql`
      INSERT INTO "Follows" ("UserId", "MangaId", "CreatedAt")
      VALUES (${user.id}, ${id}, CURRENT_TIMESTAMP)
      ON CONFLICT ("UserId", "MangaId") DO NOTHING;
    `;
  } else {
    await sql`
      DELETE FROM "Follows" WHERE "UserId" = ${user.id} AND "MangaId" = ${id};
    `;
  }

  return NextResponse.json({ followed });
}
