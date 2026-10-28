import { Manga, Chapter, Page, Reader } from '../types';

const MIMI_API_BASE = 'https://mimihentai.moe/api';

export function mapRawManga(m: any): Manga {
  const authors = Array.isArray(m?.authors) && m.authors.length > 0
    ? m.authors.map((a: any) => a.name).filter(Boolean).join(', ')
    : (m?.uploader?.display_name || 'Chưa rõ');

  const genres = Array.isArray(m?.genres) && m.genres.length > 0
    ? m.genres.map((g: any) => g.name).filter(Boolean)
    : [];

  const alternativeTitle = Array.isArray(m?.alt_names) && m.alt_names.length > 0
    ? m.alt_names.join('; ')
    : '';

  const idStr = String(m?.id || '');
  const chapterCount = Number(m?.chapter_count || 0);
  const chapters: Chapter[] = [];
  if (chapterCount > 0) {
    if (chapterCount === 1) {
      chapters.push({
        id: `${idStr}_chap_1`,
        mangaId: idStr,
        title: 'Oneshot',
        number: 1,
        language: 'vi',
        publishedAt: m?.last_updated ? new Date(m.last_updated).toISOString() : new Date().toISOString(),
        group: 'MimiHentai'
      });
    } else {
      chapters.push({
        id: `${idStr}_chap_${chapterCount}`,
        mangaId: idStr,
        title: `Chap ${chapterCount}`,
        number: chapterCount,
        language: 'vi',
        publishedAt: m?.last_updated ? new Date(m.last_updated).toISOString() : new Date().toISOString(),
        group: 'MimiHentai'
      });
      chapters.push({
        id: `${idStr}_chap_1`,
        mangaId: idStr,
        title: 'Chap 1',
        number: 1,
        language: 'vi',
        publishedAt: m?.last_updated ? new Date(m.last_updated).toISOString() : new Date().toISOString(),
        group: 'MimiHentai'
      });
    }
  }

  let rating = 8.5;
  if (m?.total_likes && m.total_likes > 0) {
    rating = Math.min(10, Math.max(7.0, 7.0 + Math.log10(m.total_likes + 1) * 0.75));
  }

  return {
    source: 'mimihentai',
    id: idStr,
    title: m?.title || 'Không có tiêu đề',
    alternativeTitle,
    author: authors,
    cover: m?.cover_url || '/cover-placeholder.svg',
    description: m?.description || '',
    genres,
    status: chapterCount > 1 ? 'ongoing' : 'completed',
    country: 'jp',
    demographic: 'seinen',
    contentRating: 'erotica',
    year: m?.last_updated ? new Date(m.last_updated).getFullYear() : 2026,
    rating: Number(rating.toFixed(1)),
    views: Number(m?.view || 0),
    follows: Number(m?.follows || 0),
    updatedAt: m?.last_updated ? new Date(m.last_updated).toISOString() : new Date().toISOString(),
    chapters,
    totalChapters: chapterCount
  };
}

export function mapRawChapter(c: any, mangaId?: string): Chapter {
  return {
    id: String(c.id),
    mangaId: String(c.manga_id || mangaId || ''),
    title: c.title || `Chap ${c.order || 1}`,
    number: Number(c.order || 1),
    language: 'vi',
    publishedAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
    group: 'MimiHentai'
  };
}

async function clientFetch<T>(endpoint: string): Promise<T | null> {
  const url = endpoint.startsWith('http') ? endpoint : `${MIMI_API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (e) {
    console.warn('[MimiClientFetch Error]', url, e);
    return null;
  }
}

export async function clientGetHome(page = 1, pageSize = 30): Promise<Page<Manga>> {
  const res = await clientFetch<any>(`/manga?page=${page}&page_size=${pageSize}`);
  if (!res || !Array.isArray(res.items)) {
    return { items: [], total: 0, page, pageSize };
  }
  const items = res.items.map(mapRawManga);
  return {
    items,
    total: Number(res.total_items) || items.length,
    page: Number(res.page) || page,
    pageSize: Number(res.page_size) || pageSize
  };
}

export async function clientGetFeatured(limit = 20, page = 1): Promise<Page<Manga>> {
  const res = await clientFetch<any>(`/manga?sort=views&page=${page}&page_size=${limit}`);
  if (!res || !Array.isArray(res.items)) {
    return { items: [], total: 0, page, pageSize: limit };
  }
  const items = res.items.map(mapRawManga);
  return {
    items,
    total: Number(res.total_items) || items.length,
    page: Number(res.page) || page,
    pageSize: Number(res.page_size) || limit
  };
}

export async function clientSearch(params: Record<string, string | number | undefined>): Promise<Page<Manga>> {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 24);
  const q = String(params.q || '').trim();
  const author = String(params.author || '').trim();
  const genre = String(params.genre || '').trim();
  const sort = String(params.sort || '').trim();

  let mimiSort = '';
  if (sort === 'views' || sort === 'hot' || sort === 'popular') mimiSort = 'views';
  else if (sort === 'follows') mimiSort = 'follows';
  else if (sort === 'likes' || sort === 'rating') mimiSort = 'likes';
  else if (sort === 'title') mimiSort = 'title';

  let endpoint = '';
  if (q) {
    endpoint = `/manga/search?q=${encodeURIComponent(q)}&page=${page}&page_size=${pageSize}`;
  } else if (genre) {
    let genreId = genre;
    if (isNaN(Number(genre))) {
      const allTags = await clientGetTags();
      const match = allTags.find(t => t.name.toLowerCase() === genre.toLowerCase());
      if (match) genreId = match.id;
    }
    const sortParam = mimiSort ? `&sort=${mimiSort}` : '';
    endpoint = `/manga/advanced-search?genre=${encodeURIComponent(genreId)}&page=${page}&page_size=${pageSize}${sortParam}`;
  } else if (author) {
    endpoint = `/manga/search?q=${encodeURIComponent(author)}&page=${page}&page_size=${pageSize}`;
  } else {
    const sortParam = mimiSort ? `&sort=${mimiSort}` : '';
    endpoint = `/manga?page=${page}&page_size=${pageSize}${sortParam}`;
  }

  const res = await clientFetch<any>(endpoint);
  if (!res || !Array.isArray(res.items)) {
    return { items: [], total: 0, page, pageSize };
  }
  const items = res.items.map(mapRawManga);
  return {
    items,
    total: Number(res.total_items) || items.length,
    page: Number(res.page) || page,
    pageSize: Number(res.page_size) || pageSize
  };
}

export async function clientGetDetail(id: string): Promise<Manga | null> {
  if (!id) return null;
  const [rawManga, rawChapters] = await Promise.all([
    clientFetch<any>(`/manga/${encodeURIComponent(id)}`),
    clientFetch<any[]>(`/manga/${encodeURIComponent(id)}/chapters`)
  ]);

  if (!rawManga) return null;
  const manga = mapRawManga(rawManga);

  if (Array.isArray(rawChapters) && rawChapters.length > 0) {
    manga.chapters = rawChapters.map(c => mapRawChapter(c, id));
    manga.totalChapters = rawChapters.length;
  }
  return manga;
}

export async function clientGetChapters(id: string, ascending = false): Promise<Page<Chapter>> {
  if (!id) return { items: [], total: 0, page: 1, pageSize: 1000 };
  const rawChapters = await clientFetch<any[]>(`/manga/${encodeURIComponent(id)}/chapters`);
  if (!Array.isArray(rawChapters) || rawChapters.length === 0) {
    return { items: [], total: 0, page: 1, pageSize: 1000 };
  }
  const mapped = rawChapters.map(c => mapRawChapter(c, id));
  mapped.sort((a, b) => ascending ? a.number - b.number : b.number - a.number);
  return {
    items: mapped,
    total: mapped.length,
    page: 1,
    pageSize: Math.max(1, mapped.length)
  };
}

export async function clientGetReader(chapterId: string): Promise<Reader | null> {
  if (!chapterId) return null;

  let resolvedChapterId = chapterId;

  // 1. Handle synthetic IDs like "70655_chap_1"
  if (chapterId.includes('_chap_')) {
    const parts = chapterId.split('_chap_');
    const mangaId = parts[0];
    const targetOrder = Number(parts[1]) || 1;
    const rawChapters = await clientFetch<any[]>(`/manga/${encodeURIComponent(mangaId)}/chapters`);
    if (Array.isArray(rawChapters) && rawChapters.length > 0) {
      const match = rawChapters.find(c => Number(c.order) === targetOrder) || rawChapters[0];
      if (match?.id) resolvedChapterId = String(match.id);
    }
  }

  // 2. Fetch chapter data from MimiHentai
  let data = await clientFetch<any>(`/chapters/${encodeURIComponent(resolvedChapterId)}`);

  // 3. Fallback: If chapter not found, maybe chapterId was actually a manga ID
  if ((!data || !data.info) && !chapterId.includes('_chap_')) {
    const rawChapters = await clientFetch<any[]>(`/manga/${encodeURIComponent(resolvedChapterId)}/chapters`);
    if (Array.isArray(rawChapters) && rawChapters.length > 0) {
      const firstChap = rawChapters[0];
      if (firstChap?.id) {
        resolvedChapterId = String(firstChap.id);
        data = await clientFetch<any>(`/chapters/${encodeURIComponent(resolvedChapterId)}`);
      }
    }
  }

  if (!data || !data.info) return null;

  const mangaId = String(data.info.manga_id);
  const chapter = mapRawChapter(data.info, mangaId);

  const [manga, chList] = await Promise.all([
    clientGetDetail(mangaId),
    clientGetChapters(mangaId, true)
  ]);

  const pages = Array.isArray(data.pages)
    ? data.pages.map((p: any) => p.image_url).filter(Boolean)
    : [];

  const fallbackManga: Manga = manga || {
    source: 'mimihentai',
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
    contentRating: 'erotica',
    year: 2026,
    rating: 8.5,
    follows: 0,
    views: 0,
    updatedAt: new Date().toISOString(),
    chapters: chList.items,
    totalChapters: chList.total
  };

  return {
    chapter,
    manga: fallbackManga,
    pages,
    dataSaverPages: pages,
    externalUrl: null,
    navigation: chList.items
  };
}

export async function clientGetTags(): Promise<{ id: string; name: string }[]> {
  const raw = await clientFetch<any[]>('/genres');
  if (Array.isArray(raw) && raw.length > 0) {
    const sorted = [...raw].sort((a, b) => (Number(b.manga_count) || 0) - (Number(a.manga_count) || 0));
    return sorted.map(g => ({
      id: String(g.id),
      name: g.name
    })).filter(g => g.name);
  }
  try {
    const res = await fetch('/api/catalog/tags');
    if (res.ok) {
      const dbTags = await res.json();
      if (Array.isArray(dbTags) && dbTags.length > 0) return dbTags;
    }
  } catch {}
  return [];
}
