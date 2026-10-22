import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, requireAdmin } from '@/lib/auth';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);
  if (!user || !requireAdmin(user)) {
    return NextResponse.json({ message: 'Không có quyền thực hiện.' }, { status: 403 });
  }

  await sql`DELETE FROM "Comments" WHERE "Id" = ${id};`;
  return new NextResponse(null, { status: 204 });
}
