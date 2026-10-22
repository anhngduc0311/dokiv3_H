import { NextResponse } from 'next/server';
import { searchCatalog } from '@/lib/catalog-service';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const source = searchParams.get('source') || '';
  const q = searchParams.get('q') || '';
  const author = searchParams.get('author') || '';
  const genre = searchParams.get('genre') || '';
  const status = searchParams.get('status') || '';
  const country = searchParams.get('country') || '';
  const demographic = searchParams.get('demographic') || '';
  const language = searchParams.get('language') || '';
  const sort = searchParams.get('sort') || '';
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
  const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : 24;

  const data = await searchCatalog({
    source,
    q,
    author,
    genre,
    status,
    country,
    demographic,
    language,
    sort,
    year,
    page,
    pageSize
  });

  return NextResponse.json(data);
}
