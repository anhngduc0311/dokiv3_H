import { NextResponse } from 'next/server';

export async function GET() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    '269100522556-hlqf9sooeon60u7jaqnfr3lp8b06s6vl.apps.googleusercontent.com';

  return NextResponse.json({ clientId });
}
