import { NextResponse } from 'next/server';
import { getMangaDetail } from '@/lib/catalog-service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let manga;
  try {
    manga = await getMangaDetail(id);
  } catch (error) {
    console.error('[Catalog API] Detail unavailable:', error instanceof Error ? error.message : 'Unknown data error');
    return NextResponse.json({ message: 'Nguồn truyện tạm thời không khả dụng. Vui lòng thử lại.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' },
    });
  }

  if (!manga) {
    return NextResponse.json({ message: 'Không tìm thấy truyện.' }, { status: 404 });
  }

  return NextResponse.json(manga);
}
