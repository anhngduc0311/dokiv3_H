import { NextResponse } from 'next/server';

export async function GET() {
  const url = 'https://mimihentai.moe/api/manga';
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://mimihentai.moe/'
  };

  try {
    const res = await fetch(url, {
      headers,
      cache: 'no-store'
    });

    const status = res.status;
    const resHeaders = Object.fromEntries(res.headers.entries());
    const text = await res.text();

    return NextResponse.json({
      status,
      headers: resHeaders,
      bodyPreview: text.slice(0, 1000)
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      stack: err.stack
    }, { status: 500 });
  }
}
