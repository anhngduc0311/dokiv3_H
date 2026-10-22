import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { hashPassword, createSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: Request) {
  try {
    await ensureDbInitialized();
    const body = await req.json();
    const email = (body.Email || body.email || '').trim().toLowerCase();
    const name = (body.Name || body.name || '').trim();
    const password = body.Password || body.password || '';

    if (!email || !email.includes('@') || name.length < 2 || password.length < 6) {
      return NextResponse.json(
        { message: 'Vui lòng nhập tên (tối thiểu 2 ký tự), email hợp lệ và mật khẩu từ 6 ký tự.' },
        { status: 400 }
      );
    }

    const existing = await sql`SELECT "Id" FROM "Users" WHERE "Email" = ${email} LIMIT 1;`;
    if (existing && existing.length > 0) {
      return NextResponse.json({ message: 'Email này đã được đăng ký.' }, { status: 409 });
    }

    const hash = await hashPassword(password);
    const userId = uuidv4();

    await sql`
      INSERT INTO "Users" ("Id", "Email", "Name", "PasswordHash", "Role", "Coins", "CreatedAt")
      VALUES (${userId}, ${email}, ${name}, ${hash}, 'reader', 0, CURRENT_TIMESTAMP);
    `;

    // Welcome notification
    try {
      await sql`
        INSERT INTO "Notifications" ("Id", "UserId", "ActorName", "MangaTitle", "Type", "Message", "CreatedAt")
        VALUES (
          ${uuidv4()}, ${userId}, 'DokiHentai', 'Hệ thống DokiHentai', 'welcome',
          ${'Chào mừng ' + name + ' đã đến với DokiHentai! Chúc bạn có những phút giây đọc truyện thật vui vẻ 🎉'},
          CURRENT_TIMESTAMP
        );
      `;
    } catch {}

    const session = createSession({
      id: userId,
      email,
      name,
      role: 'reader',
      coins: 0,
      passwordHash: hash
    });

    return NextResponse.json(session);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi đăng ký tài khoản.' }, { status: 500 });
  }
}
