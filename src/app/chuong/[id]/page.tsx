import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import ReaderClient from './reader-client';
import { loadReader, clientReader } from '@/lib/seo-data';
import { breadcrumbs, chapterPath, isAdult, mangaPath, pageMetadata, readerSchema } from '@/lib/seo';
import { JsonLd } from '@/components/seo/json-ld';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const data = await loadReader((await params).id);
  if (!data) notFound();
  return pageMetadata({ title: `${data.manga.title} - ${data.chapter.title}`, text: `Đọc ${data.chapter.title} của ${data.manga.title} bằng tiếng Việt. Xem danh sách chương và tiếp tục đọc tại DokiHentai.`, path: chapterPath(data.chapter.id), image: data.manga.cover, adult: isAdult(data.manga) });
}
export default async function ReaderPage({ params }: Props) {
  const { id } = await params;
  const data = await loadReader(id);
  if (!data) notFound();
  // Synthetic catalog IDs and old manga IDs resolve to one canonical chapter URL.
  if (data.chapter.id !== id) permanentRedirect(chapterPath(data.chapter.id));
  const current = data.navigation.findIndex(c => c.id === data.chapter.id);
  const previous = current > 0 ? data.navigation[current - 1] : undefined;
  const next = current >= 0 ? data.navigation[current + 1] : undefined;
  return <>
    <JsonLd data={[readerSchema(data), breadcrumbs([{ name: 'Trang chủ', path: '/' }, { name: data.manga.title, path: mangaPath(data.manga.id) }, { name: data.chapter.title, path: chapterPath(id) }])]} />
    <h1 className="sr-only">{data.manga.title} - {data.chapter.title}</h1>
    <ReaderClient key={id} initialData={clientReader(data)} />
    <nav className="reader-seo-navigation" aria-label="Điều hướng chương">
      <Link href="/">Trang chủ</Link>
      <Link href={mangaPath(data.manga.id)}>Danh sách chương: {data.manga.title}</Link>
      {previous && <Link href={chapterPath(previous.id)} rel="prev">Chương trước: {previous.title}</Link>}
      {next && <Link href={chapterPath(next.id)} rel="next">Chương sau: {next.title}</Link>}
    </nav>
  </>;
}
