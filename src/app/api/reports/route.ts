import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    await ensureDbInitialized();
    const user = await getUserFromRequest(req);
    const body = await req.json();

    const reason = (body.Reason || body.reason || '').trim();
    if (!reason) {
      return NextResponse.json({ message: 'Vui lòng nhập lý do báo cáo.' }, { status: 400 });
    }

    const type = (body.Type || body.type || 'broken_image').trim().toLowerCase();
    const mangaId = body.MangaId || body.mangaId || null;
    const chapterId = body.ChapterId || body.chapterId || null;
    const commentId = body.CommentId || body.commentId || null;

    const reportId = uuidv4();
    await sql`
      INSERT INTO "Reports" ("Id", "UserId", "MangaId", "ChapterId", "CommentId", "Type", "Reason", "Status", "CreatedAt")
      VALUES (${reportId}, ${user ? user.id : null}, ${mangaId}, ${chapterId}, ${commentId}, ${type}, ${reason}, 'pending', CURRENT_TIMESTAMP);
    `;

    return NextResponse.json({ message: 'Báo cáo của bạn đã được gửi tới ban quản trị. Cảm ơn bạn!' });
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi gửi báo cáo.' }, { status: 500 });
  }
}
