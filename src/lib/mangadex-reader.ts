import type { MangaCard, ChapterCard, ReaderData } from './catalog-service';

export class ReaderSourceError extends Error {}
type SourceGet = (path: string) => Promise<any>;
export function mapReaderChapter(item: any): ChapterCard {
  const attr = item.attributes || {};
  const relations = item.relationships || [];
  const number = Number.parseFloat(attr.chapter || '0') || 0;
  return {
    id: item.id, mangaId: relations.find((r: any) => r.type === 'manga')?.id || '',
    title: (attr.chapter != null ? 'Chương ' + attr.chapter : 'Oneshot') + (attr.title ? ' · ' + attr.title : ''),
    number, language: attr.translatedLanguage || 'vi',
    publishedAt: attr.publishAt || attr.readableAt || attr.createdAt || '',
    group: relations.find((r: any) => r.type === 'scanlation_group')?.attributes?.name || '',
    pagesCount: Number(attr.pages || 0)
  };
}
function chapterKey(chapter: ChapterCard) {
  return chapter.number > 0 ? String(chapter.number) : chapter.title.trim().toLocaleLowerCase('vi');
}
export function readerNavigation(items: ChapterCard[], current?: ChapterCard): ChapterCard[] {
  const selected = new Map<string, ChapterCard>();
  const preference = (chapter: ChapterCard) => [
    chapter.id === current?.id ? 1 : 0,
    current?.group && chapter.group === current.group ? 1 : 0,
    (chapter.pagesCount || 0) > 0 ? 1 : 0,
    Date.parse(chapter.publishedAt) || 0
  ];
  for (const chapter of current ? [...items, current] : items) {
    if (!chapter.id) continue;
    const key = chapterKey(chapter); const previous = selected.get(key);
    if (!previous) { selected.set(key, chapter); continue; }
    const a = preference(chapter); const b = preference(previous);
    const difference = a.map((value, i) => value - b[i]).find(value => value !== 0) || 0;
    if (difference > 0) selected.set(key, chapter);
  }
  return [...selected.values()].sort((a, b) => a.number - b.number || a.publishedAt.localeCompare(b.publishedAt));
}
export async function loadMangaDexChapterFeed(mangaId: string, language: string, get: SourceGet): Promise<ChapterCard[]> {
  const chapters: ChapterCard[] = []; let offset = 0;
  while (offset < 10000) {
    const query = new URLSearchParams({ limit: '500', offset: String(offset), 'translatedLanguage[]': language,
      'order[chapter]': 'asc', 'order[publishAt]': 'asc', 'includes[]': 'scanlation_group',
      includeFuturePublishAt: '0', includeEmptyPages: '0' });
    const result = await get('/manga/' + encodeURIComponent(mangaId) + '/feed?' + query);
    const batch = result.data || [];
    chapters.push(...batch.map(mapReaderChapter)); offset += batch.length;
    if (!batch.length || offset >= Number(result.total || 0)) break;
  }
  return chapters;
}
function embeddedManga(item: any): MangaCard | null {
  if (!item?.id || !item.attributes) return null;
  const attr = item.attributes;
  const title = attr.title?.vi || attr.altTitles?.find((t: any) => t.vi)?.vi || attr.title?.en || Object.values(attr.title || {})[0];
  if (!title) return null;
  return { id: item.id, title: String(title), alternativeTitle: '', author: '', cover: '/cover-placeholder.svg',
    description: '', genres: [], status: attr.status || 'ongoing', country: attr.originalLanguage || 'ja',
    demographic: attr.publicationDemographic || '', updatedAt: attr.updatedAt || '', chapters: [], source: 'mangadex' };
}
interface ReaderDependencies {
  get: SourceGet;
  manga: (id: string) => Promise<MangaCard | null>;
  chapters: (id: string, language: string) => Promise<ChapterCard[]>;
}
export async function readMangaDexChapter(id: string, dependencies: ReaderDependencies): Promise<ReaderData | null> {
  const metadata = await dependencies.get('/chapter/' + encodeURIComponent(id) + '?includes[]=manga&includes[]=scanlation_group');
  const item = metadata.data;
  if (!item || item.attributes?.isUnavailable) return null;
  const chapter = mapReaderChapter(item);
  if (!chapter.mangaId) throw new ReaderSourceError('Chương này chưa có thông tin truyện.');
  const external = item.attributes?.externalUrl;
  if (external && !String(external).startsWith('https://')) throw new ReaderSourceError('Địa chỉ nguồn chương không hợp lệ.');
  const [detail, feed, atHome] = await Promise.all([
    dependencies.manga(chapter.mangaId).catch(() => null),
    dependencies.chapters(chapter.mangaId, chapter.language).catch(() => []),
    external ? Promise.resolve(null) : dependencies.get('/at-home/server/' + encodeURIComponent(id))
  ]);
  const manga = detail || embeddedManga(item.relationships?.find((r: any) => r.type === 'manga'));
  if (!manga) throw new ReaderSourceError('Chưa tải được tên truyện. Vui lòng thử lại.');
  const navigation = readerNavigation(feed, chapter);
  if (external) return { chapter, manga, pages: [], dataSaverPages: [], externalUrl: external, navigation };
  let base: URL;
  try { base = new URL(atHome?.baseUrl); } catch { throw new ReaderSourceError('Chưa kết nối được máy chủ ảnh.'); }
  if (base.protocol !== 'https:') throw new ReaderSourceError('Địa chỉ máy chủ ảnh không hợp lệ.');
  const hash = atHome?.chapter?.hash;
  if (!hash) throw new ReaderSourceError('Chưa tải được nội dung chương.');
  const imageUrls = (files: unknown, folder: string): string[] => Array.isArray(files)
    ? files.filter((name): name is string => typeof name === 'string' && !!name)
      .map(name => base.href.replace(/\/$/, '') + '/' + folder + '/' + encodeURIComponent(hash) + '/' + encodeURIComponent(name)) : [];
  const full = imageUrls(atHome.chapter.data, 'data');
  const saver = imageUrls(atHome.chapter.dataSaver, 'data-saver');
  const pages = full.length ? full : saver;
  if (!pages.length) throw new ReaderSourceError('Chương này chưa có ảnh để đọc. Vui lòng thử lại sau.');
  return { chapter, manga, pages, dataSaverPages: saver.length ? saver : pages, externalUrl: null, navigation };
}
