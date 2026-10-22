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
      SELECT "Id", "IsHidden" FROM "Mangas" WHERE "Id" = ${id} LIMIT 1;
    `;

    if (!existing || existing.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy truyện.' }, { status: 404 });
    }

    const newHidden = !existing[0].IsHidden;
    await sql`
      UPDATE "Mangas"
      SET "IsHidden" = ${newHidden},
          "UpdatedAt" = CURRENT_TIMESTAMP
      WHERE "Id" = ${id};
    `;

    return NextResponse.json({ isHidden: newHidden });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi cập nhật hiển thị.' }, { status: 500 });
  }
}
