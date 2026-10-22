import { NextResponse } from 'next/server';
import { getMangaChapters } from '@/lib/catalog-service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const ascending = searchParams.get('ascending') === 'true';
  const language = searchParams.get('language') === 'en' ? 'en' : 'vi';

  const data = await getMangaChapters(id, page, ascending, language);
  if (!data || !data.items || data.items.length === 0) {
    return NextResponse.json({ items: [], total: 0, page, pageSize: 1000 }, { status: 404 });
  }
  return NextResponse.json(data);
}
