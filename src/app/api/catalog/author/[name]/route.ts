import { NextResponse } from 'next/server';
import { getAuthorManga } from '@/lib/catalog-service';

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '24', 10);

  const decodedName = decodeURIComponent(name || '');
  const data = await getAuthorManga(decodedName, page, pageSize);
  if (!data || !data.items || data.items.length === 0) {
    return NextResponse.json({ items: [], total: 0, page, pageSize }, { status: 404 });
  }
  return NextResponse.json(data);
}
