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
    const body = await req.json();

    const existing = await sql`
      SELECT "Id", "Status", "Notes" FROM "Reports" WHERE "Id" = ${id} LIMIT 1;
    `;

    if (!existing || existing.length === 0) {
      return NextResponse.json({ message: 'Không tìm thấy báo cáo.' }, { status: 404 });
    }

    const status = (body.status || 'resolved').trim();
    const notes = body.notes !== undefined ? body.notes.trim() : existing[0].Notes;
    const isResolvedOrDismissed = status === 'resolved' || status === 'dismissed';
    const resolvedAt = isResolvedOrDismissed ? new Date().toISOString() : null;

    await sql`
      UPDATE "Reports"
      SET "Status" = ${status},
          "Notes" = ${notes},
          "ResolvedAt" = ${resolvedAt}
      WHERE "Id" = ${id};
    `;

    return NextResponse.json({
      id,
      status,
      notes,
      resolvedAt
    });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi cập nhật báo cáo.' }, { status: 500 });
  }
}
