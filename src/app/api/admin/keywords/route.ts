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

    const rows = await sql`
      SELECT "Id" as id, "Keyword" as keyword, "Action" as action, "CreatedAt" as "createdAt"
      FROM "BannedKeywords"
      ORDER BY "Keyword" ASC;
    `;

    return NextResponse.json(rows);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi tải từ khóa cấm.' }, { status: 500 });
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
    const keyword = (body.keyword || body.Keyword || '').trim().toLowerCase();
    if (!keyword) {
      return NextResponse.json({ message: 'Từ khóa không được để trống.' }, { status: 400 });
    }

    const action = (body.action || body.Action || 'block').trim();

    const existing = await sql`
      SELECT "Id" FROM "BannedKeywords" WHERE "Keyword" = ${keyword} LIMIT 1;
    `;
    if (existing && existing.length > 0) {
      return NextResponse.json({ message: 'Từ khóa này đã tồn tại trong danh sách cấm.' }, { status: 409 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();
    await sql`
      INSERT INTO "BannedKeywords" ("Id", "Keyword", "Action", "CreatedAt")
      VALUES (${id}, ${keyword}, ${action}, ${now});
    `;

    return NextResponse.json({ id, keyword, action, createdAt: now }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi thêm từ khóa cấm.' }, { status: 500 });
  }
}
