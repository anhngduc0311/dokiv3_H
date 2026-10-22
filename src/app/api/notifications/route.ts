import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(req: Request) {
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ message: 'Chưa đăng nhập.' }, { status: 401 });
  }

  const unreadCountRow = await sql`
    SELECT count(*)::int as count FROM "Notifications" WHERE "UserId" = ${user.id} AND "IsRead" = false;
  `;

  const rows = await sql`
    SELECT "Id", "ActorId", "ActorName", "MangaId", "MangaTitle", "CommentId", "Type", "Message", "IsRead", "CreatedAt"
    FROM "Notifications"
    WHERE "UserId" = ${user.id}
    ORDER BY "CreatedAt" DESC
    LIMIT 30;
  `;

  const items = rows.map((r: any) => ({
    id: r.Id,
    actorId: r.ActorId,
    actorName: r.ActorName,
    mangaId: r.MangaId,
    mangaTitle: r.MangaTitle,
    commentId: r.CommentId,
    type: r.Type,
    message: r.Message,
    isRead: r.IsRead,
    createdAt: r.CreatedAt ? new Date(r.CreatedAt).toISOString() : new Date().toISOString()
  }));

  return NextResponse.json({
    items,
    unreadCount: unreadCountRow[0]?.count || 0
  });
}
