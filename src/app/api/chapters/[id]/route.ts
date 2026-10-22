import { NextResponse } from 'next/server';
import { getChapterReader } from '@/lib/catalog-service';
import { ReaderSourceError } from '@/lib/mangadex-reader';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const data = await getChapterReader(id);
    if (!data) return NextResponse.json({ message: 'Không tìm thấy chương truyện.' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({
      message: error instanceof ReaderSourceError ? error.message : 'Chưa tải được chương. Vui lòng thử lại.'
    }, { status: 502 });
  }
}
