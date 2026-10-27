import { MangaCard, ChapterCard, CatalogPage, ReaderData } from './catalog-service';
import { cacheGet, cacheSet } from './redis';

const MIMI_BASE = 'https://mimihentai.moe/api';
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://mimihentai.moe/'
};

async function mimiFetch<T>(endpoint: string, options?: RequestInit, required = false): Promise<T | null> {
  const url = endpoint.startsWith('http') ? endpoint : `${MIMI_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      signal: options?.signal || AbortSignal.timeout(10000),
      headers: {
        ...DEFAULT_HEADERS,
        ...(options?.headers || {})
      },
      next: { revalidate: 60 }
    });
    if (!res.ok) {
      if (res.status === 404) return null;
      if (required) throw new Error(`Catalog upstream returned ${res.status}`);
      console.warn(`[MimiFetch] ${url} returned ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (err: any) {
    console.error(`[MimiFetch Error] ${url}:`, err.message || err);
    // An upstream outage must produce a server error, never a false SEO 404.
    if (required) throw new Error('Nguồn truyện tạm thời không khả dụng. Vui lòng thử lại.');
    return null;
  }
}

export function mapMimiManga(m: any): MangaCard {
  if (!m) return null as any;

  const authors = Array.isArray(m.authors) && m.authors.length > 0
    ? m.authors.map((a: any) => a.name).filter(Boolean).join(', ')
    : (m.uploader?.display_name || 'Chưa rõ');

  const genres = Array.isArray(m.genres) && m.genres.length > 0
    ? m.genres.map((g: any) => g.name).filter(Boolean)
    : [];

  const alternativeTitle = Array.isArray(m.alt_names) && m.alt_names.length > 0
    ? m.alt_names.join('; ')
    : '';

  const idStr = String(m.id);
  const chapterCount = Number(m.chapter_count || 0);
  const chapters: ChapterCard[] = [];
  if (chapterCount > 0) {
    if (chapterCount === 1) {
      chapters.push({
        id: `${idStr}_chap_1`,
        mangaId: idStr,
        title: 'Oneshot',
        number: 1,
        language: 'vi',
        publishedAt: m.last_updated ? new Date(m.last_updated).toISOString() : new Date().toISOString(),
        group: 'MimiHentai',
        contentType: 'comic'
      });
    } else {
      chapters.push({
        id: `${idStr}_chap_${chapterCount}`,
        mangaId: idStr,
        title: `Chap ${chapterCount}`,
        number: chapterCount,
        language: 'vi',
        publishedAt: m.last_updated ? new Date(m.last_updated).toISOString() : new Date().toISOString(),
        group: 'MimiHentai',
        contentType: 'comic'
      });
      chapters.push({
        id: `${idStr}_chap_1`,
        mangaId: idStr,
        title: 'Chap 1',
        number: 1,
        language: 'vi',
        publishedAt: m.last_updated ? new Date(m.last_updated).toISOString() : new Date().toISOString(),
        group: 'MimiHentai',
        contentType: 'comic'
      });
    }
  }

  // Approximate rating from likes/views or 8.5
  let rating = 8.5;
  if (m.total_likes && m.total_likes > 0) {
    rating = Math.min(10, Math.max(7.0, 7.0 + Math.log10(m.total_likes + 1) * 0.75));
  }

  return {
    source: 'mimihentai' as const,
    id: idStr,
    title: m.title || 'Không có tiêu đề',
    alternativeTitle,
    author: authors,
    cover: m.cover_url || '/cover-placeholder.svg',
    description: m.description || '',
    genres,
    status: chapterCount > 1 ? 'ongoing' : 'completed',
    country: 'jp',
    demographic: 'seinen',
    contentRating: 'erotica',
    year: m.last_updated ? new Date(m.last_updated).getFullYear() : 2026,
    rating: Number(rating.toFixed(1)),
    views: Number(m.view || 0),
    follows: Number(m.follows || 0),
    updatedAt: m.last_updated ? new Date(m.last_updated).toISOString() : new Date().toISOString(),
    chapters,
    chaptersCount: chapterCount,
    totalChapters: chapterCount
  };
}

export function mapMimiChapter(c: any, mangaId?: string): ChapterCard {
  return {
    id: String(c.id),
    mangaId: String(c.manga_id || mangaId || ''),
    title: c.title || `Chap ${c.order || 1}`,
    number: Number(c.order || 1),
    language: 'vi',
    publishedAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
    group: 'MimiHentai',
    contentType: 'comic'
  };
}

export interface MimiCatalogFilters {
  source?: string;
  q?: string;
  author?: string;
  genre?: string;
  status?: string;
  country?: string;
  demographic?: string;
  language?: string;
  sort?: string;
  year?: number;
  page?: number;
  pageSize?: number;
}

export async function getMimiCatalog(filters: MimiCatalogFilters): Promise<CatalogPage> {
  const page = Math.max(1, filters.page || 1);
  const pageSize = Math.max(1, Math.min(50, filters.pageSize || 24));
  const q = filters.q?.trim() || '';
  const author = filters.author?.trim() || '';
  const genre = filters.genre?.trim() || '';
  const sort = filters.sort?.trim() || '';

  const cacheKey = `mimi:catalog:${JSON.stringify({ q, author, genre, sort, page, pageSize })}`;
  const cached = await cacheGet<CatalogPage>(cacheKey);
  if (cached) return cached;

  let endpoint = '';

  // Determine sort parameter for MimiHentai
  let mimiSort = '';
  if (sort === 'views' || sort === 'hot' || sort === 'popular') {
    mimiSort = 'views';
  } else if (sort === 'follows') {
    mimiSort = 'follows';
  } else if (sort === 'likes' || sort === 'rating') {
    mimiSort = 'likes';
  } else if (sort === 'title') {
    mimiSort = 'title';
  }

  // 1. Keyword search
  if (q) {
    endpoint = `/manga/search?q=${encodeURIComponent(q)}&page=${page}&page_size=${pageSize}`;
  } else if (genre) {
    // 2. Genre filter (find genre id if name was passed)
    let genreId = genre;
    if (isNaN(Number(genre))) {
      const genresList = await getMimiGenres();
      const match = genresList.find(g => g.name.toLowerCase() === genre.toLowerCase());
      if (match) genreId = match.id;
    }
    const sortParam = mimiSort ? `&sort=${mimiSort}` : '';
    endpoint = `/manga/advanced-search?genre=${encodeURIComponent(genreId)}&page=${page}&page_size=${pageSize}${sortParam}`;
  } else if (author) {
    // 3. Author search
    endpoint = `/manga/search?q=${encodeURIComponent(author)}&page=${page}&page_size=${pageSize}`;
  } else {
    // 4. Default browse list
    const sortParam = mimiSort ? `&sort=${mimiSort}` : '';
    endpoint = `/manga?page=${page}&page_size=${pageSize}${sortParam}`;
  }

  const res = await mimiFetch<{
    items: any[];
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  }>(endpoint);

  if (!res || !Array.isArray(res.items)) {
    return { items: [], total: 0, page, pageSize };
  }

  const items = res.items.map(mapMimiManga).filter(Boolean);
  const result: CatalogPage = {
    items,
    total: res.total_items ?? items.length,
    page: res.page || page,
    pageSize: res.page_size || pageSize
  };

  if (items.length > 0) {
    await cacheSet(cacheKey, result, 120);
  }
  return result;
}

export async function getMimiDetail(id: string): Promise<MangaCard | null> {
  if (!id) return null;
  const cacheKey = `mimi:detail:${id}`;
  const cached = await cacheGet<MangaCard>(cacheKey);
  if (cached) return cached;

  const [rawManga, rawChapters] = await Promise.all([
    mimiFetch<any>(`/manga/${encodeURIComponent(id)}`, undefined, true),
    mimiFetch<any[]>(`/manga/${encodeURIComponent(id)}/chapters`)
  ]);

  if (!rawManga) return null;

  const manga = mapMimiManga(rawManga);

  if (Array.isArray(rawChapters) && rawChapters.length > 0) {
    manga.chapters = rawChapters.map(c => mapMimiChapter(c, id));
    manga.chaptersCount = rawChapters.length;
    manga.totalChapters = rawChapters.length;
  }

  await cacheSet(cacheKey, manga, 300);
  return manga;
}

export async function getMimiChapters(
  mangaId: string,
  ascending: boolean = false
): Promise<{ items: ChapterCard[]; total: number; page: number; pageSize: number }> {
  if (!mangaId) return { items: [], total: 0, page: 1, pageSize: 1000 };

  const cacheKey = `mimi:chapters:${mangaId}:${ascending ? 'asc' : 'desc'}`;
  const cached = await cacheGet<{ items: ChapterCard[]; total: number; page: number; pageSize: number }>(cacheKey);
  if (cached) return cached;

  const rawChapters = await mimiFetch<any[]>(`/manga/${encodeURIComponent(mangaId)}/chapters`);
  if (!Array.isArray(rawChapters) || rawChapters.length === 0) {
    return { items: [], total: 0, page: 1, pageSize: 1000 };
  }

  const mapped = rawChapters.map(c => mapMimiChapter(c, mangaId));

  // Sort by chapter number
  mapped.sort((a, b) => ascending ? a.number - b.number : b.number - a.number);

  const result = {
    items: mapped,
    total: mapped.length,
    page: 1,
    pageSize: Math.max(1, mapped.length)
  };

  await cacheSet(cacheKey, result, 300);
  return result;
}

export async function getMimiReader(chapterId: string): Promise<ReaderData | null> {
  if (!chapterId) return null;
  const cacheKey = `mimi:reader:${chapterId}`;
  const cached = await cacheGet<ReaderData>(cacheKey);
  if (cached) return cached;

  let resolvedChapterId = chapterId;

  // 1. Handle synthetic IDs like "70655_chap_1"
  if (chapterId.includes('_chap_')) {
    const parts = chapterId.split('_chap_');
    const mangaId = parts[0];
    const targetOrder = Number(parts[1]) || 1;
    const rawChapters = await mimiFetch<any[]>(`/manga/${encodeURIComponent(mangaId)}/chapters`);
    if (Array.isArray(rawChapters) && rawChapters.length > 0) {
      const match = rawChapters.find(c => Number(c.order) === targetOrder) || rawChapters[0];
      if (match?.id) resolvedChapterId = String(match.id);
    }
  }

  // 2. Fetch chapter data from MimiHentai
  let data = await mimiFetch<{
    info: any;
    next: any;
    prev: any;
    pages: Array<{ image_url: string }>;
  }>(`/chapters/${encodeURIComponent(resolvedChapterId)}`, undefined, true);

  // 3. Fallback: If chapter not found, maybe chapterId was actually a manga ID
  if ((!data || !data.info) && !chapterId.includes('_chap_')) {
    const rawChapters = await mimiFetch<any[]>(`/manga/${encodeURIComponent(resolvedChapterId)}/chapters`);
    if (Array.isArray(rawChapters) && rawChapters.length > 0) {
      const firstChap = rawChapters[0];
      if (firstChap?.id) {
        resolvedChapterId = String(firstChap.id);
        data = await mimiFetch<any>(`/chapters/${encodeURIComponent(resolvedChapterId)}`, undefined, true);
      }
    }
  }

  if (!data || !data.info) return null;

  const mangaId = String(data.info.manga_id);
  const chapter = mapMimiChapter(data.info, mangaId);

  // Fetch manga and chapter list for navigation in parallel
  const [manga, chList] = await Promise.all([
    getMimiDetail(mangaId),
    getMimiChapters(mangaId, true)
  ]);

  const pages = Array.isArray(data.pages)
    ? data.pages.map(p => p.image_url).filter(Boolean)
    : [];

  const fallbackManga: MangaCard = manga || {
    id: mangaId,
    title: `Truyện #${mangaId}`,
    alternativeTitle: '',
    author: 'Chưa rõ',
    cover: '/cover-placeholder.svg',
    description: '',
    genres: [],
    status: 'ongoing',
    country: 'jp',
    demographic: 'seinen',
    updatedAt: new Date().toISOString(),
    chapters: chList.items
  };

  const result: ReaderData = {
    chapter,
    manga: fallbackManga,
    pages,
    dataSaverPages: pages,
    externalUrl: null,
    navigation: chList.items
  };

  await cacheSet(cacheKey, result, 600);
  return result;
}

export async function getMimiGenres(): Promise<{ id: string; name: string }[]> {
  const cacheKey = 'mimi:genres:v1';
  const cached = await cacheGet<{ id: string; name: string }[]>(cacheKey);
  if (cached) return cached;

  const raw = await mimiFetch<any[]>('/genres');
  if (!Array.isArray(raw)) return [];

  // Sort by manga_count descending to show most popular genres first
  const sorted = [...raw].sort((a, b) => (Number(b.manga_count) || 0) - (Number(a.manga_count) || 0));

  const genres = sorted.map(g => ({
    id: String(g.id),
    name: g.name
  })).filter(g => g.name);

  await cacheSet(cacheKey, genres, 3600);
  return genres;
}

export async function getMimiRandom(): Promise<MangaCard[]> {
  const raw = await mimiFetch<any[]>('/manga/random');
  if (!Array.isArray(raw)) return [];
  return raw.map(mapMimiManga).filter(Boolean);
}
