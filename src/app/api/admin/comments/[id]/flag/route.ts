import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !requireAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền truy cập.' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await sql`
      SELECT "Id", "IsFlagged" FROM "Comments" WHERE "Id" = ${id} LIMIT 1;
    `;

    if (!existing || existing.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy bình luận.' }, { status: 404 });
    }

    const newFlagged = !existing[0].IsFlagged;
    await sql`
      UPDATE "Comments" SET "IsFlagged" = ${newFlagged} WHERE "Id" = ${id};
    `;

    return NextResponse.json({ isFlagged: newFlagged });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi cập nhật cờ bình luận.' }, { status: 500 });
  }
}
