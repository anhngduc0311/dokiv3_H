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
  return pageMetadata({
    title: q ? `Tìm truyện hentai: ${q}` : 'Tìm kiếm truyện hentai, manga 18+ nâng cao',
    text: q
      ? `Kết quả tìm kiếm truyện hentai cho từ khóa "${q}" tại DokiHentai.`
      : 'Tìm kiếm truyện hentai, manga 18+, manhwa 18+, doujinshi vietsub theo thể loại, tác giả, trạng thái tại DokiHentai.',
    path: '/tim-truyen-nang-cao',
    noindex: Object.keys(query).length > 0,
    adult: true,
    keywords: [
      q ? `${q} hentai` : '',
      'tìm truyện hentai',
      'manga 18+',
      'doujinshi vietsub',
      'dokihentai'
    ].filter(Boolean)
  });
}
export default async function SearchPage({ searchParams }: Props) {
  const query = await searchParams;
  const catalog = await searchCatalog({ q: single(query.q), author: single(query.author), genre: single(query.genre),
    status: single(query.status), source: single(query.source), sort: single(query.sort) || 'latest',
    page: pageNumber(query.page), pageSize: 24 });
  return <>
    <JsonLd data={[collectionSchema('Tìm truyện nâng cao', '/tim-truyen-nang-cao', catalog.items)]} />
    <SearchClient key={JSON.stringify(query)} initialCatalog={{ ...catalog, items: catalog.items.map(clientManga) }} />
  </>;
}
