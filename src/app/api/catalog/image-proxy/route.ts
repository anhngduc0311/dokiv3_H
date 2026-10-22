import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl || !targetUrl.startsWith('http')) {
    return NextResponse.json({ message: 'Địa chỉ ảnh không hợp lệ.' }, { status: 400 });
  }

  try {
    const uri = new URL(targetUrl);
    let referrer = `${uri.protocol}//${uri.host}/`;

    if (uri.host.includes('moe-cdn.net') || uri.host.includes('mimihentai.moe')) {
      referrer = 'https://mimihentai.moe/';
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        Referer: referrer
      }
    });

    if (!res.ok) {
      return new NextResponse(null, { status: res.status });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ message: 'Lỗi tải ảnh proxy.' }, { status: 502 });
  }
}
