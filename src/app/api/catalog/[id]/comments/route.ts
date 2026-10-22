import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import { getMangaDetail, rememberManga } from '@/lib/catalog-service';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ message: 'Vui lòng đăng nhập để bình luận.' }, { status: 401 });
  }

  const body = await req.json();
  const content = (body.Body || body.body || '').trim();
  const parentId = body.ParentId || body.parentId || null;

  if (content.length < 1 || content.length > 2000) {
    return NextResponse.json({ message: 'Bình luận từ 1–2.000 ký tự.' }, { status: 400 });
  }

  // Check cooldown for non-admin
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  if (!isAdmin) {
    const last = await sql`
      SELECT "CreatedAt" FROM "Comments" WHERE "UserId" = ${user.id} ORDER BY "CreatedAt" DESC LIMIT 1;
    `;
    if (last && last.length > 0) {
      const diff = (Date.now() - new Date(last[0].CreatedAt).getTime()) / 1000;
      if (diff < 10) {
        return NextResponse.json(
          { message: `Vui lòng đợi ${Math.ceil(10 - diff)} giây trước khi bình luận tiếp.` },
          { status: 429 }
        );
      }
    }
  }

  // Check banned keywords
  const banned = await sql`SELECT "Keyword" FROM "BannedKeywords"`;
  const lower = content.toLowerCase();
  const isFlagged = banned.some((b: any) => lower.includes(b.Keyword.toLowerCase()));

  const detail = await getMangaDetail(id);
  if (detail) {
    await rememberManga(detail);
  }

  const commentId = uuidv4();
  await sql`
    INSERT INTO "Comments" ("Id", "MangaId", "UserId", "ParentId", "Body", "IsFlagged", "CreatedAt")
    VALUES (${commentId}, ${id}, ${user.id}, ${parentId}, ${content}, ${isFlagged}, CURRENT_TIMESTAMP);
  `;

  // Notification for reply
  if (parentId) {
    const parentRow = await sql`
      SELECT "UserId", "Body" FROM "Comments" WHERE "Id" = ${parentId} LIMIT 1;
    `;
    if (parentRow && parentRow.length > 0 && parentRow[0].UserId !== user.id) {
      const mangaTitle = detail?.title || 'truyện';
      const preview = content.length > 80 ? content.slice(0, 77) + '...' : content;
      await sql`
        INSERT INTO "Notifications" (
          "Id", "UserId", "ActorId", "ActorName", "MangaId", "MangaTitle", "CommentId", "Type", "Message", "CreatedAt"
        )
        VALUES (
          ${uuidv4()}, ${parentRow[0].UserId}, ${user.id}, ${user.name}, ${id},
          ${mangaTitle}, ${commentId}, 'comment_reply',
          ${`${user.name} đã trả lời bình luận của bạn: "${preview}"`},
          CURRENT_TIMESTAMP
        );
      `;
    }
  }

  return NextResponse.json(
    { message: isFlagged ? 'Bình luận đã gửi và đang chờ duyệt từ ngữ.' : 'Đã gửi bình luận.' },
    { status: 201 }
  );
}
