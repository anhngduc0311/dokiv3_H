import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';

export async function DELETE(
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
    await sql`DELETE FROM "Reports" WHERE "CommentId" = ${id};`;
    await sql`DELETE FROM "Comments" WHERE "Id" = ${id};`;
    return new Response(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi xóa bình luận.' }, { status: 500 });
  }
}
