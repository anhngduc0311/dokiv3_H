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
    const role = searchParams.get('role') || 'all';
    const status = searchParams.get('status') || 'all';

    const offset = (page - 1) * pageSize;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (q) {
      whereConditions.push(`("Name" ILIKE $${params.length + 1} OR "Email" ILIKE $${params.length + 1})`);
      params.push(`%${q}%`);
    }

    if (role && role !== 'all') {
      whereConditions.push(`"Role" = $${params.length + 1}`);
      params.push(role);
    }

    if (status === 'banned') {
      whereConditions.push(`"IsBanned" = true`);
    } else if (status === 'active') {
      whereConditions.push(`"IsBanned" = false`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `SELECT count(*)::int as total FROM "Users" ${whereClause};`;
    const countRes = (await (sql as any).query(countQuery, params)) as any[];
    const total = countRes[0]?.total || 0;

    const itemsQuery = `
      SELECT "Id", "Email", "Name", "Role", "Coins", "IsBanned", "CreatedAt"
      FROM "Users"
      ${whereClause}
      ORDER BY "CreatedAt" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    const rawItems = (await (sql as any).query(itemsQuery, [...params, pageSize, offset])) as any[];

    const items = rawItems.map((u: any) => ({
      id: u.Id,
      email: u.Email,
      name: u.Name,
      role: u.Role,
      coins: Number(u.Coins || 0),
      isBanned: !!u.IsBanned,
      createdAt: u.CreatedAt
    }));

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi tải danh sách người dùng.' }, { status: 500 });
  }
}
