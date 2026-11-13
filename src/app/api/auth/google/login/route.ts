import { NextResponse } from 'next/server';
import { googleAuthOrigin, safeReturnUrl } from '@/lib/auth-urls';

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '269100522556-hlqf9sooeon60u7jaqnfr3lp8b06s6vl.apps.googleusercontent.com';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const returnUrl = safeReturnUrl(searchParams.get('returnUrl'));

  const redirectUri = `${googleAuthOrigin(req)}/api/auth/google/callback`;

  const state = encodeURIComponent(returnUrl);
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    GOOGLE_CLIENT_ID
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=openid%20email%20profile&state=${state}&prompt=select_account`;

  return NextResponse.redirect(url);
}
