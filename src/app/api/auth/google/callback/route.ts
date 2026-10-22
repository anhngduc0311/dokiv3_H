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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const redirectUri = `${proto}://${host}/api/auth/google/callback`;

  if (error || !code) {
    return NextResponse.redirect(`${proto}://${host}/dang-nhap?error=${encodeURIComponent(error || 'Đăng nhập Google thất bại')}`);
  }

  try {
    await ensureDbInitialized();
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${proto}://${host}/dang-nhap?error=${encodeURIComponent('Không thể xác thực mã từ Google')}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    let email = '';
    let name = '';

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

    if (!email) {
      return NextResponse.redirect(`${proto}://${host}/dang-nhap?error=${encodeURIComponent('Không lấy được email từ Google')}`);
    }

    email = email.trim().toLowerCase();
    const rows = await sql`SELECT * FROM "Users" WHERE "Email" = ${email} LIMIT 1;`;

    let user: any;
    if (rows && rows.length > 0) {
      user = rows[0];
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
        PasswordHash: ''
      };
    }

    const session = createSession({
      id: user.Id,
      email: user.Email,
      name: user.Name,
      role: user.Role,
      coins: Number(user.Coins || 0),
      passwordHash: user.PasswordHash
    });

    const targetUrl = state ? decodeURIComponent(state) : '/';
    return NextResponse.redirect(
      `${proto}://${host}/dang-nhap?token=${encodeURIComponent(session.token)}&returnUrl=${encodeURIComponent(targetUrl)}`
    );
  } catch (err: any) {
    return NextResponse.redirect(`${proto}://${host}/dang-nhap?error=${encodeURIComponent(err.message || 'Lỗi xử lý')}`);
  }
}
