import { NextResponse } from 'next/server';
import { getTags } from '@/lib/catalog-service';

export async function GET() {
  const data = await getTags();
  return NextResponse.json(data);
}
