import { notFound } from 'next/navigation';
import MangaClient from './manga-client';
import { loadManga, loadChapters, clientManga } from '@/lib/seo-data';
import { breadcrumbs, mangaMetadata, mangaPath, mangaSchema } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const manga = await loadManga((await params).id);
  if (!manga) notFound();
  return mangaMetadata(manga);
}
export default async function MangaPage({ params }: Props) {
  const { id } = await params;
  const manga = await loadManga(id);
  if (!manga) notFound();
  const chapters = await loadChapters(id);
  return <>
    <JsonLd data={[mangaSchema(manga), breadcrumbs([{ name: 'Trang chủ', path: '/' }, { name: manga.title, path: mangaPath(id) }])]} />
    <MangaClient key={id} initialManga={clientManga({ ...manga, chapters: chapters.items, totalChapters: chapters.total })} />
  </>;
}
