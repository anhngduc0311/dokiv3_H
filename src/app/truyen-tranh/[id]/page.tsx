import { notFound } from 'next/navigation';
import MangaClient from './manga-client';
import { loadManga, loadChapters, clientManga } from '@/lib/seo-data';
import { breadcrumbs, mangaMetadata, mangaPath, mangaSchema, pageMetadata } from '@/lib/seo';
import { serverDataResult } from '@/lib/server-data-result';
import { JsonLd } from '@/components/seo/json-ld';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const result = await serverDataResult(() => loadManga(id));
  if (result.failed) return pageMetadata({ title: 'Đang tải truyện', path: mangaPath(id), noindex: true });
  const manga = result.data;
  if (!manga) notFound();
  return mangaMetadata(manga);
}
export default async function MangaPage({ params }: Props) {
  const { id } = await params;
  const [result, chapterResult] = await Promise.all([
    serverDataResult(() => loadManga(id)),
    serverDataResult(() => loadChapters(id)),
  ]);
  if (result.failed) return <MangaClient key={id} initialManga={null} />;
  const manga = result.data;
  if (!manga) notFound();
  const chapters = chapterResult.failed ? { items: manga.chapters, total: manga.totalChapters || manga.chapters.length } : chapterResult.data;
  return <>
    <JsonLd data={[mangaSchema(manga), breadcrumbs([{ name: 'Trang chủ', path: '/' }, { name: manga.title, path: mangaPath(id) }])]} />
    <MangaClient key={id} initialManga={clientManga({ ...manga, chapters: chapters.items, totalChapters: chapters.total })} initialChaptersLoaded={!chapterResult.failed} />
  </>;
}
