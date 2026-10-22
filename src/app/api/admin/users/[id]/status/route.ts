import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, isFullAdmin } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    if (!user || !isFullAdmin(user)) {
      return NextResponse.json({ message: 'Không có quyền khóa/mở khóa tài khoản.' }, { status: 403 });
    }

    const { id } = await params;
    const existing = await sql`
      SELECT "Id", "Email", "IsBanned" FROM "Users" WHERE "Id" = ${id} LIMIT 1;
    `;

    if (!existing || existing.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy người dùng.' }, { status: 404 });
    }

    const newBanned = !existing[0].IsBanned;
    await sql`
      UPDATE "Users" SET "IsBanned" = ${newBanned} WHERE "Id" = ${id};
    `;

    const logId = uuidv4();
    await sql`
      INSERT INTO "SystemLogs" ("Id", "Level", "Source", "Message", "CreatedAt")
      VALUES (
        ${logId},
        ${newBanned ? 'warning' : 'info'},
        'user',
        ${`${newBanned ? 'Khóa' : 'Mở khóa'} tài khoản: ${existing[0].Email}`},
        CURRENT_TIMESTAMP
      );
    `;

    return NextResponse.json({ isBanned: newBanned });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi cập nhật trạng thái tài khoản.' }, { status: 500 });
  }
}
