import SearchClient from './search-client';
import { searchCatalog } from '@/lib/catalog-service';
import { clientManga } from '@/lib/seo-data';
import { collectionSchema, pageMetadata, pageNumber, single, type SearchParams } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';

export const dynamic = 'force-dynamic';
type Props = { searchParams: Promise<SearchParams> };
export async function generateMetadata({ searchParams }: Props) {
  const query = await searchParams;
  const q = single(query.q);
  return pageMetadata({ title: q ? `Tìm truyện: ${q}` : 'Tìm truyện nâng cao', path: '/tim-truyen-nang-cao', noindex: Object.keys(query).length > 0 });
}
export default async function SearchPage({ searchParams }: Props) {
  const query = await searchParams;
  const catalog = await searchCatalog({ q: single(query.q), author: single(query.author), genre: single(query.genre),
    status: single(query.status), country: single(query.country), demographic: single(query.demographic),
    source: single(query.source), language: single(query.language) || 'vi', sort: single(query.sort) || 'latest',
    year: single(query.year) ? Number(single(query.year)) : undefined, page: pageNumber(query.page), pageSize: 24 });
  return <>
    <JsonLd data={[collectionSchema('Tìm truyện nâng cao', '/tim-truyen-nang-cao', catalog.items)]} />
    <SearchClient key={JSON.stringify(query)} initialCatalog={{ ...catalog, items: catalog.items.map(clientManga) }} />
  </>;
}
