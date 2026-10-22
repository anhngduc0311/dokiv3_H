import { NextResponse } from 'next/server';
import { getFeaturedCatalog } from '@/lib/catalog-service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const page = parseInt(searchParams.get('page') || '1', 10);

  const data = await getFeaturedCatalog(limit, page);
  return NextResponse.json(data);
}
