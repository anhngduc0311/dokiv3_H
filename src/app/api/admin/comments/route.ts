import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';

export async function GET(req: Request) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '20', 10)));
    const q = (searchParams.get('q') || '').trim();
    const flaggedOnly = searchParams.get('flaggedOnly') === 'true';

    const offset = (page - 1) * pageSize;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (flaggedOnly) {
      whereConditions.push(`c."IsFlagged" = true`);
    }

    if (q) {
      whereConditions.push(`(c."Body" ILIKE $${params.length + 1} OR u."Name" ILIKE $${params.length + 1})`);
      params.push(`%${q}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT count(*)::int as total
      FROM "Comments" c
      LEFT JOIN "Users" u ON u."Id" = c."UserId"
      ${whereClause};
    `;
    const countRes = (await (sql as any).query(countQuery, params)) as any[];
    const total = countRes[0]?.total || 0;

    const itemsQuery = `
      SELECT c."Id", c."MangaId", m."Title" as "mangaTitle",
             c."UserId", u."Name" as "userName", u."Email" as "userEmail",
             c."Body", c."IsFlagged", c."CreatedAt"
      FROM "Comments" c
      LEFT JOIN "Users" u ON u."Id" = c."UserId"
      LEFT JOIN "Mangas" m ON m."Id" = c."MangaId"
      ${whereClause}
      ORDER BY c."CreatedAt" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    const rawItems = (await (sql as any).query(itemsQuery, [...params, pageSize, offset])) as any[];

    const items = rawItems.map((c: any) => ({
      id: c.Id,
      mangaId: c.MangaId,
      mangaTitle: c.mangaTitle || 'Truyện',
      userId: c.UserId,
      userName: c.userName || 'Người dùng',
      userEmail: c.userEmail || '',
      body: c.Body,
      isFlagged: !!c.IsFlagged,
      createdAt: c.CreatedAt
    }));

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi tải bình luận.' }, { status: 500 });
  }
}
