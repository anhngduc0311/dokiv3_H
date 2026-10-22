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
    const status = searchParams.get('status') || 'all';
    const type = searchParams.get('type') || 'all';

    const offset = (page - 1) * pageSize;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (status && status !== 'all') {
      whereConditions.push(`r."Status" = $${params.length + 1}`);
      params.push(status);
    }

    if (type && type !== 'all') {
      whereConditions.push(`r."Type" = $${params.length + 1}`);
      params.push(type);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT count(*)::int as total
      FROM "Reports" r
      ${whereClause};
    `;
    const countRes = (await (sql as any).query(countQuery, params)) as any[];
    const total = countRes[0]?.total || 0;

    const itemsQuery = `
      SELECT r."Id", r."Type", r."Reason", r."Status", r."Notes", r."CreatedAt", r."ResolvedAt",
             r."UserId", coalesce(u."Name", 'Khách ẩn danh') as "userName",
             r."MangaId", m."Title" as "mangaTitle",
             r."ChapterId", c."Title" as "chapterTitle"
      FROM "Reports" r
      LEFT JOIN "Users" u ON u."Id" = r."UserId"
      LEFT JOIN "Mangas" m ON m."Id" = r."MangaId"
      LEFT JOIN "Chapters" c ON c."Id" = r."ChapterId"
      ${whereClause}
      ORDER BY r."CreatedAt" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    const rawItems = (await (sql as any).query(itemsQuery, [...params, pageSize, offset])) as any[];

    const items = rawItems.map((r: any) => ({
      id: r.Id,
      type: r.Type,
      reason: r.Reason,
      status: r.Status,
      notes: r.Notes,
      createdAt: r.CreatedAt,
      resolvedAt: r.ResolvedAt,
      userId: r.UserId,
      userName: r.userName,
      mangaId: r.MangaId,
      mangaTitle: r.mangaTitle,
      chapterId: r.ChapterId,
      chapterTitle: r.chapterTitle
    }));

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi tải danh sách báo cáo.' }, { status: 500 });
  }
}
