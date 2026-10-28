import HomeClient from './home-client';
import { getHomeCatalog } from '@/lib/catalog-service';
import { clientManga } from '@/lib/seo-data';
import { collectionSchema, pageMetadata, pageNumber, type SearchParams } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';

export const dynamic = 'force-dynamic';
type Props = { searchParams: Promise<SearchParams> };
export async function generateMetadata({ searchParams }: Props) {
  const page = pageNumber((await searchParams).page);
  return pageMetadata({
    title: page > 1 ? `Đọc truyện hentai, manga 18+ vietsub - Trang ${page}` : 'Đọc truyện hentai, manga 18+, doujinshi vietsub online',
    text: 'DokiHentai - Web đọc truyện hentai, manga 18+, manhwa 18+, doujinshi vietsub online chất lượng cao, cập nhật chương mới nhất hàng ngày miễn phí.',
    path: page > 1 ? `/?page=${page}` : '/',
    adult: true,
  });
}
export default async function HomePage({ searchParams }: Props) {
  const page = pageNumber((await searchParams).page);
  const catalog = await getHomeCatalog(page, 30);
  return <>
    <JsonLd data={[collectionSchema('Truyện mới cập nhật', page > 1 ? `/?page=${page}` : '/', catalog.items)]} />
    <h1 className="sr-only">DokiHentai - Web Đọc Truyện Hentai, Manga 18+, Doujinshi Vietsub Online Miễn Phí</h1>
    <HomeClient key={page} initialCatalog={{ ...catalog, items: catalog.items.map(clientManga) }} />
  </>;
}
