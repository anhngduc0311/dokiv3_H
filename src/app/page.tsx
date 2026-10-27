import HomeClient from './home-client';
import { getHomeCatalog } from '@/lib/catalog-service';
import { clientManga } from '@/lib/seo-data';
import { collectionSchema, pageMetadata, pageNumber, type SearchParams } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';

export const dynamic = 'force-dynamic';
type Props = { searchParams: Promise<SearchParams> };
export async function generateMetadata({ searchParams }: Props) {
  const page = pageNumber((await searchParams).page);
  return pageMetadata({ title: `Đọc truyện tranh tiếng Việt${page > 1 ? ` - Trang ${page}` : ''}`, path: page > 1 ? `/?page=${page}` : '/' });
}
export default async function HomePage({ searchParams }: Props) {
  const page = pageNumber((await searchParams).page);
  const catalog = await getHomeCatalog(page, 30);
  return <>
    <JsonLd data={[collectionSchema('Truyện mới cập nhật', page > 1 ? `/?page=${page}` : '/', catalog.items)]} />
    <HomeClient key={page} initialCatalog={{ ...catalog, items: catalog.items.map(clientManga) }} />
  </>;
}
