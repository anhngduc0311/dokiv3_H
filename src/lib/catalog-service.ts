import { sql, ensureDbInitialized } from './db';
import { cacheGet, cacheSet } from './redis';
import {
  getMimiCatalog,
  getMimiDetail,
  getMimiChapters,
  getMimiReader,
  getMimiGenres,
  MimiCatalogFilters
} from './mimi-catalog';

export interface ChapterCard {
  id: string;
  mangaId: string;
  title: string;
  number: number;
  language: string;
  publishedAt: string;
  group?: string;
  pagesCount?: number;
  contentType?: 'comic' | 'novel';
}

export interface MangaCard {
  source?: 'mimihentai' | 'mangadex' | 'truyengg';
  id: string;
  slug?: string;
  title: string;
  alternativeTitle: string;
  author: string;
  cover: string;
  description: string;
  genres: string[];
  status: string;
  country: string;
  demographic: string;
  contentRating?: string;
  year?: number;
  rating?: number;
  views?: number;
  follows?: number;
  updatedAt: string;
  chapters: ChapterCard[];
  totalChapters?: number;
  chaptersCount?: number;
}

export interface CatalogPage {
  items: MangaCard[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ReaderData {
  chapter: ChapterCard;
  manga: MangaCard;
  pages: string[];
  dataSaverPages: string[];
  externalUrl?: string | null;
  navigation: ChapterCard[];
}

export type CatalogFilters = MimiCatalogFilters;

export async function rememberManga(m: MangaCard): Promise<void> {
  if (!m || !m.id) return;
  await ensureDbInitialized();

  try {
    await sql`
      INSERT INTO "Mangas" (
        "Id", "Title", "AlternativeTitle", "Author", "Cover", "Description",
        "Genres", "Status", "Country", "Demographic", "Year", "Featured",
        "IsDemo", "Views", "UpdatedAt"
      )
      VALUES (
        ${m.id}, ${m.title}, ${m.alternativeTitle || ''}, ${m.author || ''},
        ${m.cover || '/cover-placeholder.svg'}, ${m.description || ''},
        ${m.genres || []}, ${m.status || 'ongoing'}, ${m.country || 'jp'},
        ${m.demographic || 'seinen'}, ${m.year || 2026}, false, false,
        ${m.views || 0}, ${new Date(m.updatedAt || Date.now()).toISOString()}
      )
      ON CONFLICT ("Id") DO UPDATE SET
        "Title" = EXCLUDED."Title",
        "Cover" = EXCLUDED."Cover",
        "UpdatedAt" = EXCLUDED."UpdatedAt";
    `;
  } catch {
    // Ignore remember errors to not block reading
  }
}

function mapLocalManga(r: any): MangaCard {
  return {
    source: 'mimihentai',
    id: r.Id,
    title: r.Title,
    alternativeTitle: r.AlternativeTitle || '',
    author: r.Author || 'Chưa rõ',
    cover: r.Cover || '/cover-placeholder.svg',
    description: r.Description || '',
    genres: r.Genres || [],
    status: r.Status || 'ongoing',
    country: r.Country || 'jp',
    demographic: r.Demographic || 'seinen',
    year: r.Year || undefined,
    views: Number(r.Views || 0),
    rating: 9.0,
    follows: 0,
    updatedAt: r.UpdatedAt ? new Date(r.UpdatedAt).toISOString() : '',
    chaptersCount: Number(r.chapters_count || 0),
    totalChapters: Number(r.chapters_count || 0),
    chapters: r.recent_chapters || []
  };
}

async function localCatalog(filters: CatalogFilters, genreName = ''): Promise<MangaCard[]> {
  try {
    await ensureDbInitialized();
    const rows = await sql`
      SELECT m.*,
        (SELECT count(*)::int FROM "Chapters" c WHERE c."MangaId" = m."Id") as chapters_count,
        (SELECT coalesce(json_agg(ch), '[]'::json) FROM (
          SELECT c."Id" as id, c."MangaId" as "mangaId", c."Title" as title,
                 c."Number" as number, c."Language" as language, c."PublishedAt" as "publishedAt"
          FROM "Chapters" c WHERE c."MangaId" = m."Id" AND c."PublishedAt" <= CURRENT_TIMESTAMP
          ORDER BY c."Number" DESC LIMIT 3
        ) ch) as recent_chapters
      FROM "Mangas" m
      WHERE m."IsHidden" = false AND m."IsDraft" = false AND m."SourceType" <> 'crawl'
      ORDER BY m."UpdatedAt" DESC, m."Id" ASC;
    `;
    const items = rows.map(mapLocalManga).filter(m => {
      const text = (m.title + ' ' + m.alternativeTitle).toLocaleLowerCase('vi');
      return (!filters.q || text.includes(filters.q.toLocaleLowerCase('vi')))
        && (!filters.author || m.author.toLocaleLowerCase('vi').includes(filters.author.toLocaleLowerCase('vi')))
        && (!filters.status || m.status === filters.status)
        && (!filters.genre || m.genres.some(g => g.toLowerCase() === genreName.toLowerCase()));
    });
    return items;
  } catch {
    return [];
  }
}

// 1. SEARCH & BROWSE CATALOG
export async function searchCatalog(params: CatalogFilters): Promise<CatalogPage> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.max(1, params.pageSize || 24);

  const filters: CatalogFilters = {
    ...params,
    q: params.q?.trim() || '',
    author: params.author?.trim() || '',
    page,
    pageSize
  };

  const cacheKey = 'catalog:browse:mimi:v1:' + JSON.stringify(filters);
  const cached = await cacheGet<CatalogPage>(cacheKey);
  if (cached) return cached;

  const genreName = filters.genre || '';

  // Get local custom/admin manga if any
  const local = await localCatalog(filters, genreName);
  const offset = (page - 1) * pageSize;
  const localPage = local.slice(offset, offset + pageSize);
  const needed = pageSize - localPage.length;

  // Remote MimiHentai catalog
  const remote = await getMimiCatalog(filters);

  const result: CatalogPage = {
    items: [...localPage, ...remote.items.slice(0, needed > 0 ? needed : remote.items.length)],
    total: local.length + remote.total,
    page,
    pageSize
  };

  await cacheSet(cacheKey, result, 120);
  return result;
}

// 2. HOMEPAGE CATALOG
export async function getHomeCatalog(page = 1, pageSize = 30): Promise<CatalogPage> {
  return searchCatalog({ page, pageSize, sort: 'latest' });
}

// 3. FEATURED CATALOG
export async function getFeaturedCatalog(limit = 20, page = 1): Promise<CatalogPage> {
  return searchCatalog({ page, pageSize: limit, sort: 'views' });
}

// 4. MANGA DETAIL
export async function getMangaDetail(id: string): Promise<MangaCard | null> {
  if (!id) return null;
  const cacheKey = 'manga:detail:mimi:v1:' + id;
  const cached = await cacheGet<MangaCard>(cacheKey);
  if (cached) return cached;

  // Check local database first for admin/custom manga
  try {
    await ensureDbInitialized();
    const rows = await sql`
      SELECT m.*, (SELECT count(*)::int FROM "Chapters" c WHERE c."MangaId" = m."Id") as chapters_count
      FROM "Mangas" m WHERE m."Id" = ${id} LIMIT 1;
    `;
    const local = rows[0];
    if (local?.IsHidden || local?.IsDraft) return null;
    if (local && local.SourceType !== 'crawl') {
      const manga = mapLocalManga(local);
      await cacheSet(cacheKey, manga, 180);
      return manga;
    }
  } catch {}

  // Fetch from MimiHentai
  const manga = await getMimiDetail(id);
  if (manga) {
    await rememberManga(manga);
    await cacheSet(cacheKey, manga, 300);
    return manga;
  }

  return null;
}

// 5. MANGA CHAPTERS
export async function getMangaChapters(
  mangaId: string,
  _page: number = 1,
  ascending: boolean = false,
  _language: string = 'vi'
): Promise<{ items: ChapterCard[]; total: number; page: number; pageSize: number }> {
  await ensureDbInitialized();

  // Try DB chapters for locally created mangas
  try {
    const rows = await sql`
      SELECT "Id", "MangaId", "Number", "Title", "Language", "PublishedAt", "ContentType", array_length("Pages", 1) as pages_count
      FROM "Chapters"
      WHERE "MangaId" = ${mangaId}
      ORDER BY "Number" DESC
    `;

    if (rows && rows.length > 0) {
      let sorted = rows;
      if (ascending) {
        sorted = [...rows].reverse();
      }
      const items: ChapterCard[] = sorted.map((r: any) => ({
        id: r.Id,
        mangaId: r.MangaId,
        number: Number(r.Number),
        title: r.Title || `Chương ${r.Number}`,
        language: r.Language || 'vi',
        publishedAt: r.PublishedAt ? new Date(r.PublishedAt).toISOString() : new Date().toISOString(),
        group: 'DokiTeam',
        pagesCount: Number(r.pages_count || 0),
        contentType: r.ContentType || 'comic'
      }));

      return {
        items,
        total: items.length,
        page: 1,
        pageSize: 1000
      };
    }
  } catch {}

  // Fetch from MimiHentai
  return getMimiChapters(mangaId, ascending);
}

// 6. CHAPTER READER
export async function getChapterReader(chapterId: string): Promise<ReaderData | null> {
  await ensureDbInitialized();

  // Try DB chapter
  try {
    const chapRows = await sql`
      SELECT c.*, m."Title" as manga_title, m."Cover" as manga_cover, m."Author" as manga_author
      FROM "Chapters" c
      JOIN "Mangas" m ON m."Id" = c."MangaId"
      WHERE c."Id" = ${chapterId}
      LIMIT 1;
    `;

    if (chapRows && chapRows.length > 0) {
      const c = chapRows[0];
      const chapter: ChapterCard = {
        id: c.Id,
        mangaId: c.MangaId,
        number: Number(c.Number),
        title: c.Title || `Chương ${c.Number}`,
        language: c.Language || 'vi',
        publishedAt: c.PublishedAt ? new Date(c.PublishedAt).toISOString() : new Date().toISOString(),
        contentType: c.ContentType || 'comic'
      };

      const manga: MangaCard = {
        source: 'mimihentai',
        id: c.MangaId,
        title: c.manga_title,
        alternativeTitle: '',
        author: c.manga_author || 'Chưa rõ',
        cover: c.manga_cover || '/cover-placeholder.svg',
        description: '',
        genres: [],
        status: 'ongoing',
        country: 'jp',
        demographic: 'seinen',
        updatedAt: new Date().toISOString(),
        chapters: []
      };

      const pages: string[] = c.Pages || [];

      const siblings = await sql`
        SELECT "Id", "Number", "Title" FROM "Chapters"
        WHERE "MangaId" = ${c.MangaId}
        ORDER BY "Number" ASC;
      `;

      const nav: ChapterCard[] = siblings.map((s: any) => ({
        id: s.Id,
        mangaId: c.MangaId,
        number: Number(s.Number),
        title: s.Title,
        language: 'vi',
        publishedAt: new Date().toISOString()
      }));

      return {
        chapter,
        manga,
        pages,
        dataSaverPages: pages,
        externalUrl: null,
        navigation: nav
      };
    }
  } catch {}

  // Fetch from MimiHentai
  return getMimiReader(chapterId);
}

// 7. TAGS / GENRES
export async function getTags(): Promise<{ id: string; name: string }[]> {
  const cacheKey = 'catalog:tags:mimi:v1';
  const cached = await cacheGet<{ id: string; name: string }[]>(cacheKey);
  if (cached) return cached;

  const [remote, local] = await Promise.allSettled([
    getMimiGenres(),
    (async () => {
      await ensureDbInitialized();
      const rows = await sql`SELECT "Id", "Name" FROM "TaxonomyItems" WHERE "Type" = 'genre' ORDER BY "Name" ASC`;
      return rows.map((r: any) => ({ id: r.Id, name: r.Name as string }));
    })()
  ]);

  const tags = new Map<string, { id: string; name: string }>();

  if (remote.status === 'fulfilled') {
    for (const tag of remote.value) {
      if (!tags.has(tag.name.toLowerCase())) tags.set(tag.name.toLowerCase(), tag);
    }
  }

  if (local.status === 'fulfilled') {
    for (const tag of local.value) {
      if (!tags.has(tag.name.toLowerCase())) tags.set(tag.name.toLowerCase(), tag);
    }
  }

  const result = [...tags.values()];
  await cacheSet(cacheKey, result, 3600);
  return result;
}

// 8. AUTHORS
export async function getAuthorManga(name: string, page: number = 1, pageSize: number = 24): Promise<CatalogPage> {
  return searchCatalog({ author: name, page, pageSize });
}
