import { NextResponse } from 'next/server';
import { getMangaDetail } from '@/lib/catalog-service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const manga = await getMangaDetail(id);

  if (!manga) {
    return NextResponse.json({ message: 'Không tìm thấy truyện.' }, { status: 404 });
  }

  return NextResponse.json(manga);
}
