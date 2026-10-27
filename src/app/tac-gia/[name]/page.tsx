import AuthorClient from './author-client';
import { searchCatalog } from '@/lib/catalog-service';
import { clientManga } from '@/lib/seo-data';
import { breadcrumbs, collectionSchema, pageMetadata, pageNumber, type SearchParams } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ name: string }>; searchParams: Promise<SearchParams> };
export async function generateMetadata({ params, searchParams }: Props) {
  const { name } = await params;
  const query = await searchParams;
  const page = pageNumber(query.page);
  return pageMetadata({ title: `Truyện của tác giả ${name}${page > 1 ? ` - Trang ${page}` : ''}`, text: `Danh sách truyện tranh của tác giả ${name}. Khám phá tác phẩm và các chương tại DokiHentai.`, path: `/tac-gia/${encodeURIComponent(name)}${page > 1 ? `?page=${page}` : ''}`, noindex: !!query.sort && query.sort !== 'latest' });
}
export default async function AuthorPage({ params, searchParams }: Props) {
  const { name } = await params;
  const query = await searchParams;
  const page = pageNumber(query.page);
  const sort = typeof query.sort === 'string' ? query.sort : 'latest';
  const catalog = await searchCatalog({ author: name, page, pageSize: 24, sort });
  const path = `/tac-gia/${encodeURIComponent(name)}`;
  return <>
    <JsonLd data={[collectionSchema(`Truyện của ${name}`, `${path}${page > 1 ? `?page=${page}` : ''}`, catalog.items), breadcrumbs([{ name: 'Trang chủ', path: '/' }, { name: 'Tác giả', path: '/tac-gia' }, { name, path }])]} />
    <AuthorClient key={`${name}-${page}-${sort}`} initialCatalog={{ ...catalog, items: catalog.items.map(clientManga) }} />
  </>;
}
