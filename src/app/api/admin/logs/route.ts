import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: Request) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10)));
    const level = searchParams.get('level') || 'all';
    const source = searchParams.get('source') || 'all';

    const offset = (page - 1) * pageSize;

    const whereConditions: string[] = [];
    const params: any[] = [];

    if (level && level !== 'all') {
      whereConditions.push(`"Level" = $${params.length + 1}`);
      params.push(level);
    }

    if (source && source !== 'all') {
      whereConditions.push(`"Source" = $${params.length + 1}`);
      params.push(source);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countQuery = `SELECT count(*)::int as total FROM "SystemLogs" ${whereClause};`;
    const countRes = (await (sql as any).query(countQuery, params)) as any[];
    const total = countRes[0]?.total || 0;

    const itemsQuery = `
      SELECT "Id" as id, "Level" as level, "Source" as source, "Message" as message, "CreatedAt" as "createdAt"
      FROM "SystemLogs"
      ${whereClause}
      ORDER BY "CreatedAt" DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2};
    `;
    const items = (await (sql as any).query(itemsQuery, [...params, pageSize, offset])) as any[];

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi tải nhật ký log.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const body = await req.json();
    const level = (body.level || body.Level || 'info').trim();
    const source = (body.source || body.Source || 'system').trim();
    const message = (body.message || body.Message || '').trim();

    if (!message) {
      return NextResponse.json({ message: 'Nội dung log không được để trống.' }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    await sql`
      INSERT INTO "SystemLogs" ("Id", "Level", "Source", "Message", "CreatedAt")
      VALUES (${id}, ${level}, ${source}, ${message}, ${now});
    `;

    return NextResponse.json({ id, level, source, message, createdAt: now });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi lưu log.' }, { status: 500 });
  }
}
