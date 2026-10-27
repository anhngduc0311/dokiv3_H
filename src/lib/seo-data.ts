import { cache } from 'react';
import { getMangaDetail, getMangaChapters, getChapterReader, type MangaCard, type ReaderData } from './catalog-service';
import type { Manga, Reader } from '@/types';

// Share one result between metadata and page rendering during a server request.
export const loadManga = cache(getMangaDetail);
export const loadChapters = cache((id: string) => getMangaChapters(id, 1, false, 'vi'));
export const loadReader = cache(getChapterReader);
export function clientManga(m: MangaCard): Manga {
  return { ...m, rating: m.rating ?? 0, follows: m.follows ?? 0, year: m.year ?? null,
    contentRating: m.contentRating || '', chapters: m.chapters.map(c => ({ ...c, group: c.group || '' })) };
}
export function clientReader(data: ReaderData): Reader {
  return { ...data, manga: clientManga(data.manga), chapter: { ...data.chapter, group: data.chapter.group || '' },
    navigation: data.navigation.map(c => ({ ...c, group: c.group || '' })), externalUrl: data.externalUrl || null };
}
