import { NextResponse } from 'next/server';
import { sql, ensureDbInitialized } from '@/lib/db';
import { getUserFromRequest, verifyPassword, hashPassword, createSession } from '@/lib/auth';

export async function POST(req: Request) {
  await ensureDbInitialized();
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ message: 'Chưa đăng nhập.' }, { status: 401 });
  }

  const body = await req.json();
  const currentPassword = body.CurrentPassword || body.currentPassword || '';
  const newPassword = body.NewPassword || body.newPassword || '';
  const confirmPassword = body.ConfirmPassword || body.confirmPassword || '';

  if (newPassword.length < 6 || newPassword.length > 128) {
    return NextResponse.json({ message: 'Mật khẩu mới phải có từ 6–128 ký tự.' }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ message: 'Mật khẩu xác nhận chưa trùng khớp.' }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ message: 'Mật khẩu mới phải khác mật khẩu hiện tại.' }, { status: 400 });
  }

  const rows = await sql`
    SELECT "PasswordHash", "PasswordVersion" FROM "Users" WHERE "Id" = ${user.id} LIMIT 1;
  `;
  if (!rows || rows.length === 0) {
    return NextResponse.json({ message: 'Không tìm thấy tài khoản.' }, { status: 404 });
  }

  const currentHash = rows[0].PasswordHash;
  if (!currentHash) {
    return NextResponse.json(
      { message: 'Tài khoản đăng nhập bằng Google. Hãy đổi mật khẩu trong tài khoản Google.' },
      { status: 400 }
    );
  }

  const match = await verifyPassword(currentPassword, currentHash);
  if (!match) {
    return NextResponse.json({ message: 'Mật khẩu hiện tại không đúng.' }, { status: 400 });
  }

  const newHash = await hashPassword(newPassword);
  const newVersion = Number(rows[0].PasswordVersion || 0) + 1;

  await sql`
    UPDATE "Users"
    SET "PasswordHash" = ${newHash}, "PasswordVersion" = ${newVersion}
    WHERE "Id" = ${user.id};
  `;

  const session = createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    coins: user.coins,
    passwordHash: newHash,
    passwordVersion: newVersion
  });

  return NextResponse.json(session);
}
