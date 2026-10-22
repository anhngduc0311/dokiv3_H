import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { createSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '269100522556-hlqf9sooeon60u7jaqnfr3lp8b06s6vl.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || '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';

export async function POST(req: Request) {
  try {
    await ensureDbInitialized();
    const body = await req.json();
    const credential = body.Credential || body.credential;
    const code = body.Code || body.code;
    const redirectUri = body.RedirectUri || body.redirectUri || '';

    let email = '';
    let name = '';

    // 1. GSI ID Token
    if (credential) {
      try {
        const verifyRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential.trim())}`
        );
        if (verifyRes.ok) {
          const info = await verifyRes.json();
          if (info.aud === GOOGLE_CLIENT_ID || info.email) {
            email = info.email;
            name = info.name || '';
          }
        }
      } catch {}
    } else if (code) {
      // 2. Auth Code Exchange
      try {
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code: code.trim(),
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        });

        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          const accessToken = tokenData.access_token;
          if (accessToken) {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });
            if (userRes.ok) {
              const userInfo = await userRes.json();
              email = userInfo.email;
              name = userInfo.name || '';
            }
          }
        }
      } catch {}
    }

    if (!email) {
      return NextResponse.json({ message: 'Không thể xác thực thông tin đăng nhập Google.' }, { status: 400 });
    }

    email = email.trim().toLowerCase();
    const existing = await sql`SELECT * FROM "Users" WHERE "Email" = ${email} LIMIT 1;`;

    let user: any;
    if (existing && existing.length > 0) {
      user = existing[0];
      if (user.IsBanned) {
        return NextResponse.json({ message: 'Tài khoản của bạn đã bị tạm khóa.' }, { status: 403 });
      }
    } else {
      const displayName = name.trim() || email.split('@')[0];
      const userId = uuidv4();
      await sql`
        INSERT INTO "Users" ("Id", "Email", "Name", "PasswordHash", "Role", "Coins", "CreatedAt")
        VALUES (${userId}, ${email}, ${displayName}, '', 'reader', 0, CURRENT_TIMESTAMP);
      `;
      user = {
        Id: userId,
        Email: email,
        Name: displayName,
        Role: 'reader',
        Coins: 0,
        PasswordHash: '',
        IsBanned: false
      };

      try {
        await sql`
          INSERT INTO "Notifications" ("Id", "UserId", "ActorName", "MangaTitle", "Type", "Message", "CreatedAt")
          VALUES (
            ${uuidv4()}, ${userId}, 'DokiHentai', 'Hệ thống DokiHentai', 'welcome',
            ${'Chào mừng ' + displayName + ' đã đến với DokiHentai! Chúc bạn có những phút giây đọc truyện thật vui vẻ 🎉'},
            CURRENT_TIMESTAMP
          );
        `;
      } catch {}
    }

    const session = createSession({
      id: user.Id,
      email: user.Email,
      name: user.Name,
      role: user.Role,
      coins: Number(user.Coins || 0),
      isBanned: user.IsBanned,
      passwordHash: user.PasswordHash
    });

    return NextResponse.json(session);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Lỗi xác thực Google.' }, { status: 500 });
  }
}
