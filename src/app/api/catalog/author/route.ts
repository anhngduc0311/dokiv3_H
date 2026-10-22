import { NextResponse } from 'next/server';
import { getAuthorManga } from '@/lib/catalog-service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get('name') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '24', 10);

  if (!name.trim()) {
    return NextResponse.json({ items: [], total: 0, page: 1, pageSize });
  }

  const data = await getAuthorManga(name.trim(), page, pageSize);
  return NextResponse.json(data);
}
