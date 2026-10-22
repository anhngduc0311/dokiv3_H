import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { getMangaDetail, rememberManga } from '@/lib/catalog-service';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ message: 'Vui lòng đăng nhập để đánh giá.' }, { status: 401 });
  }

  const body = await req.json();
  const score = parseInt(body.Score || body.score || '10', 10);
  if (score < 1 || score > 10) {
    return NextResponse.json({ message: 'Điểm đánh giá từ 1–10.' }, { status: 400 });
  }

  const detail = await getMangaDetail(id);
  if (detail) {
    await rememberManga(detail);
  }

  await sql`
    INSERT INTO "Ratings" ("UserId", "MangaId", "Score")
    VALUES (${user.id}, ${id}, ${score})
    ON CONFLICT ("UserId", "MangaId") DO UPDATE SET "Score" = EXCLUDED."Score";
  `;

  return new NextResponse(null, { status: 204 });
}
