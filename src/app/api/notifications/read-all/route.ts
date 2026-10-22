import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function PUT(req: Request) {
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ message: 'Chưa đăng nhập.' }, { status: 401 });
  }

  await sql`
    UPDATE "Notifications" SET "IsRead" = true WHERE "UserId" = ${user.id} AND "IsRead" = false;
  `;

  return new NextResponse(null, { status: 204 });
}
