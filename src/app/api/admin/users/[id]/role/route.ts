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
      return NextResponse.json({ message: 'Không có quyền thay đổi vai trò.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const targetRole = (body.role || '').trim().toLowerCase();

    const allowedRoles = ['superadmin', 'admin', 'editor', 'translator', 'reader'];
    if (!allowedRoles.includes(targetRole)) {
      return NextResponse.json({ message: 'Vai trò không hợp lệ.' }, { status: 400 });
    }

    const existing = await sql`
      SELECT "Id", "Email", "Role" FROM "Users" WHERE "Id" = ${id} LIMIT 1;
    `;

    if (!existing || existing.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy người dùng.' }, { status: 404 });
    }

    await sql`
      UPDATE "Users" SET "Role" = ${targetRole} WHERE "Id" = ${id};
    `;

    const logId = uuidv4();
    await sql`
      INSERT INTO "SystemLogs" ("Id", "Level", "Source", "Message", "CreatedAt")
      VALUES (${logId}, 'warning', 'rbac', ${`Thay đổi vai trò người dùng ${existing[0].Email} thành ${targetRole}`}, CURRENT_TIMESTAMP);
    `;

    return NextResponse.json({ role: targetRole });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi cập nhật vai trò.' }, { status: 500 });
  }
}
