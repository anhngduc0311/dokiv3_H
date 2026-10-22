import { NextResponse } from 'next/server';
import { getHomeCatalog } from '@/lib/catalog-service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '30', 10);

  const data = await getHomeCatalog(page, pageSize);
  return NextResponse.json(data);
}
