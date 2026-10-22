import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);
  if (!user || !requireAdmin(user)) {
    return NextResponse.json({ message: 'Không có quyền thực hiện.' }, { status: 403 });
  }

  const row = await sql`SELECT "IsFlagged" FROM "Comments" WHERE "Id" = ${id} LIMIT 1;`;
  if (!row || row.length === 0) {
    return NextResponse.json({ message: 'Không tìm thấy bình luận.' }, { status: 404 });
  }

  const nextFlag = !row[0].IsFlagged;
  await sql`UPDATE "Comments" SET "IsFlagged" = ${nextFlag} WHERE "Id" = ${id};`;

  return NextResponse.json({ isFlagged: nextFlag });
}
