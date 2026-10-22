import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { sql, ensureDbInitialized } from './db';

const JWT_SECRET =
  process.env.JWT_KEY ||
  'd0k1truy3n_s3cur1ty_jwt_k3y_pr0duct10n_sup3r_s3cr3t_2026_x9';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  coins: number;
  isBanned: boolean;
  canChangePassword: boolean;
}

export interface JwtPayload {
  nameid: string;
  unique_name: string;
  role: string;
  pwd_ver: string;
  iss: string;
  aud: string;
  exp: number;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!hash) return Promise.resolve(false);
  return bcrypt.compare(plain, hash);
}

export function createToken(user: { id: string; name: string; role: string; passwordVersion?: number }): string {
  const version = String(user.passwordVersion ?? 0);
  return jwt.sign(
    {
      nameid: user.id,
      unique_name: user.name,
      role: user.role,
      pwd_ver: version
    },
    JWT_SECRET,
    {
      issuer: 'truyendex-local',
      audience: 'truyendex-web',
      expiresIn: '7d'
    }
  );
}

export function createSession(user: {
  id: string;
  email: string;
  name: string;
  role: string;
  coins?: number;
  isBanned?: boolean;
  passwordHash?: string;
  passwordVersion?: number;
}) {
  const token = createToken({
    id: user.id,
    name: user.name,
    role: user.role,
    passwordVersion: user.passwordVersion
  });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      coins: Number(user.coins || 0),
      isBanned: !!user.isBanned,
      canChangePassword: !stringIsEmpty(user.passwordHash)
    }
  };
}

function stringIsEmpty(val?: string | null): boolean {
  return !val || val.trim().length === 0;
}

export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  await ensureDbInitialized();

  const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'truyendex-local',
      audience: 'truyendex-web'
    }) as any;

    const userId = decoded.nameid || decoded.sub;
    if (!userId) return null;

    const rows = await sql`
      SELECT "Id", "Email", "Name", "Role", "Coins", "IsBanned", "PasswordHash", "PasswordVersion"
      FROM "Users"
      WHERE "Id" = ${userId}
      LIMIT 1;
    `;

    if (!rows || rows.length === 0) return null;
    const u = rows[0];

    if (u.IsBanned) return null;

    const tokenVersion = String(decoded.pwd_ver ?? '0');
    const dbVersion = String(u.PasswordVersion ?? 0);
    if (tokenVersion !== dbVersion) return null;

    return {
      id: u.Id,
      email: u.Email,
      name: u.Name,
      role: u.Role,
      coins: Number(u.Coins || 0),
      isBanned: u.IsBanned,
      canChangePassword: !stringIsEmpty(u.PasswordHash)
    };
  } catch (err) {
    return null;
  }
}

export function requireAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  return (
    user.role === 'admin' ||
    user.role === 'superadmin' ||
    user.role === 'editor' ||
    user.role === 'translator'
  );
}

export function isFullAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'superadmin';
}
