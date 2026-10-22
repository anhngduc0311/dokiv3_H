import { sql, ensureDbInitialized } from './db';
import { cacheGet, cacheSet } from './redis';
import { catalogPagination, searchMangaDex, mangaDexGet, mapMangaDexManga, enrichMangaDexCards } from './mangadex-catalog';
import type { CatalogFilters } from './mangadex-catalog';
import { ggTotal, ggWindow, getGgDetail, getGgChapters, getGgReader, getGgTags, searchGgTitles } from './truyengg-catalog';
import { sourceWindow, interleaveSourceItems } from './catalog-pagination';
import { loadMangaDexChapterFeed, readerNavigation, readMangaDexChapter } from './mangadex-reader';
import { uniqueChapterSourceMatch, sameStoryTitle, mergeChapterSources, sourceChapterAliases, chapterSourceParts } from './chapter-source-sync';
import { findChapterSourceLink, saveChapterSourceLink } from './chapter-source-links';
import { saveGgReferences, findGgReference } from './source-references';
import { ggId } from './truyengg-parser';


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
  source?: 'mangadex' | 'truyengg';
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
        ${m.demographic || 'shounen'}, ${m.year || 2026}, false, false,
        ${m.views || 0}, ${new Date(m.updatedAt || Date.now()).toISOString()}
      )
      ON CONFLICT ("Id") DO UPDATE SET
        "Title" = EXCLUDED."Title",
        "Cover" = EXCLUDED."Cover",
        "UpdatedAt" = EXCLUDED."UpdatedAt";
    `;
  } catch (err) {
    // Ignore remember errors to not block reading
  }
}

// Crawled database rows are detail snapshots, not the full source catalog.
function mapLocalManga(r: any): MangaCard {
  return {
    id: r.Id, title: r.Title, alternativeTitle: r.AlternativeTitle || '', author: r.Author || 'Chưa rõ',
    cover: r.Cover || '/cover-placeholder.svg', description: r.Description || '', genres: r.Genres || [],
    status: r.Status || 'ongoing', country: r.Country || 'ja', demographic: r.Demographic || '',
    year: r.Year || undefined, views: Number(r.Views || 0), rating: 0, follows: 0,
    updatedAt: r.UpdatedAt ? new Date(r.UpdatedAt).toISOString() : '',
    chaptersCount: Number(r.chapters_count || 0), totalChapters: Number(r.chapters_count || 0),
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
    const aliases: Record<string, string> = { jp: 'ja', cn: 'zh', manhwa: 'ko', manhua: 'zh' };
    const countries = (filters.country || '').split(',').map(c => aliases[c] || c);
    const items = rows.map(mapLocalManga).filter(m => {
      const text = (m.title + ' ' + m.alternativeTitle).toLocaleLowerCase('vi');
      return (!filters.q || text.includes(filters.q.toLocaleLowerCase('vi')))
        && (!filters.author || m.author.toLocaleLowerCase('vi').includes(filters.author.toLocaleLowerCase('vi')))
        && (!filters.status || m.status === filters.status)
        && (!filters.country || countries.includes(aliases[m.country] || m.country))
        && (!filters.demographic || m.demographic === filters.demographic)
        && (!filters.year || m.year === filters.year)
        && (!filters.genre || m.genres.some(g => g.toLowerCase() === genreName.toLowerCase()))
        && (filters.language !== 'en' || m.chapters.some(c => c.language === 'en'));
    });
    if (filters.sort === 'title') items.sort((a, b) => a.title.localeCompare(b.title, 'vi'));
    if (filters.sort === 'chapters') items.sort((a, b) => (b.totalChapters || 0) - (a.totalChapters || 0));
    return items;
  } catch {
    // The external catalog remains available if the optional local database is offline.
    return [];
  }
}

export async function searchCatalog(params: CatalogFilters): Promise<CatalogPage> {
  const pagination = catalogPagination(params.page, params.pageSize);
  const filters: CatalogFilters = {
    ...params, q: params.q?.trim() || '', author: params.author?.trim() || '',
    language: params.language === 'en' ? 'en' : 'vi',
    page: pagination.page, pageSize: pagination.pageSize
  };
  const cacheKey = 'catalog:browse:multi:v1:' + JSON.stringify(filters);
  const cached = await cacheGet<CatalogPage>(cacheKey);
  if (cached) return cached;
  let remoteGenre = filters.genre;
  let genreName = '';
  if (filters.genre) {
    const tags = await getTags();
    genreName = tags.find(t => t.id === filters.genre)?.name || filters.genre;
    const remoteTags = await getMangaDexTags().catch(() => []);
    remoteGenre = remoteTags.find(t => t.id === filters.genre || t.name.toLowerCase() === genreName.toLowerCase())?.id;
  }
  const local = filters.source ? [] : await localCatalog(filters, genreName);
  const localPage = local.slice(pagination.offset, pagination.offset + pagination.pageSize);
  const remoteOffset = Math.max(0, pagination.offset - local.length);
  const needed = pagination.pageSize - localPage.length;
  const remote = await federatedCatalog(filters, remoteGenre, genreName, remoteOffset, needed);
  const result: CatalogPage = {
    items: [...localPage, ...remote.items.slice(0, needed)], total: local.length + remote.total,
    page: pagination.page, pageSize: pagination.pageSize
  };
  await cacheSet(cacheKey, result, 120);
  return result;
}

async function federatedCatalog(filters: CatalogFilters, remoteGenre: string | undefined, genreName: string, offset: number, size: number) {
  const { page: _page, pageSize: _size, source, ...criteria } = filters;
  const mdFilters = { ...criteria, genre: remoteGenre };
  const ggFilters = { ...criteria, genreName };
  const mdEnabled = source !== 'truyengg' && (!filters.genre || !!remoteGenre);
  const ggEnabled = source !== 'mangadex';
  const countResults = await Promise.allSettled([
    (async () => {
      if (!mdEnabled) return 0;
      const key = 'catalog:md:count:v1:' + JSON.stringify(mdFilters);
      const cached = await cacheGet<number>(key); if (cached !== null) return cached;
      const result = await searchMangaDex(mdFilters, 0, 0);
      await cacheSet(key, result.total, 300); return result.total;
    })(),
    ggEnabled ? ggTotal(ggFilters) : Promise.resolve(0)
  ]);
  if (countResults.every(r => r.status === 'rejected')) throw (countResults[0] as PromiseRejectedResult).reason;
  if (source === 'truyengg' && countResults[1].status === 'rejected') throw countResults[1].reason;
  if (source === 'mangadex' && countResults[0].status === 'rejected') throw countResults[0].reason;
  const counts = countResults.map(r => r.status === 'fulfilled' ? r.value : 0) as [number, number];
  const window = sourceWindow(counts, offset, size);
  const [md, gg] = await Promise.all([
    window.limits[0] ? searchMangaDex(mdFilters, window.offsets[0], window.limits[0]).then(r => r.items) : Promise.resolve([]),
    window.limits[1] ? ggWindow(ggFilters, window.offsets[1], window.limits[1]) : Promise.resolve([])
  ]);
  return { items: interleaveSourceItems([md, gg], window.order), total: window.total };
}

export async function getHomeCatalog(page = 1, pageSize = 30): Promise<CatalogPage> {
  return searchCatalog({ page, pageSize, language: 'vi', sort: 'latest' });
}

export async function getFeaturedCatalog(limit = 20, page = 1): Promise<CatalogPage> {
  return searchCatalog({ page, pageSize: limit, country: 'ko,zh', language: 'vi', sort: 'hot' });
}

// 4. MANGA DETAIL
export async function getMangaDetail(id: string): Promise<MangaCard | null> {
  const cacheKey = 'manga:detail:source:v3:' + id;
  const cached = await cacheGet<MangaCard>(cacheKey);
  if (cached) return cached;
  let local: any;
  try {
    await ensureDbInitialized();
    const rows = await sql`
      SELECT m.*, (SELECT count(*)::int FROM "Chapters" c WHERE c."MangaId" = m."Id") as chapters_count
      FROM "Mangas" m WHERE m."Id" = ${id} LIMIT 1;
    `;
    local = rows[0];
    if (local?.IsHidden || local?.IsDraft) return null;
    if (local && local.SourceType !== 'crawl') {
      const manga = mapLocalManga(local);
      await cacheSet(cacheKey, manga, 180);
      return manga;
    }
  } catch {
    // Source stories can still be read while the local database is unavailable.
  }
  const gg = await getGgDetail(id);
  if (gg) {
    await rememberManga(gg.manga);
    await cacheSet(cacheKey, gg.manga, 300);
    return gg.manga;
  }
  try {
    const data = await mangaDexGet('/manga/' + encodeURIComponent(id) + '?includes[]=cover_art&includes[]=author&includes[]=artist');
    const manga = mapMangaDexManga(data.data);
    await enrichMangaDexCards([manga]);
    await rememberManga(manga);
    await cacheSet(cacheKey, manga, 300);
    return manga;
  } catch {
    return local ? mapLocalManga(local) : null;
  }
}

async function mangaDexChapterFeed(id: string, language: string): Promise<ChapterCard[]> {
  const key = 'catalog:md:chapter-feed:v2:' + id + ':' + language;
  const cached = await cacheGet<ChapterCard[]>(key);
  if (cached) return cached;
  const items = await loadMangaDexChapterFeed(id, language, mangaDexGet);
  await cacheSet(key, items, 300);
  return items;
}

const chapterSyncRequests = new Map<string, Promise<ChapterCard[]>>();
async function matchingGgSource(manga: MangaCard) {
  const linked = await findChapterSourceLink(manga.id);
  if (linked) return getGgDetail(linked);
  const missKey = 'chapter-source:miss:v2:' + manga.id + ':' + manga.title;
  if (await cacheGet(missKey)) return null;
  const queries = [...new Set([manga.title, ...manga.alternativeTitle.split(/[;/|\n]/)].map(t => t.trim()).filter(t => t.length >= 4))].slice(0, 4);
  const candidates = new Map<string, MangaCard>();
  for (const query of queries) {
    for (const candidate of await searchGgTitles(query)) {
      if (sameStoryTitle(manga, candidate)) candidates.set(candidate.id, candidate);
    }
    if (candidates.size) break;
  }
  // Ambiguous editions and name collisions require a deliberate match instead of a guess.
  if (candidates.size > 3) { await cacheSet(missKey, true, 300); return null; }
  const details = await Promise.all([...candidates.keys()].map(id => getGgDetail(id)));
  const candidate = uniqueChapterSourceMatch(manga, details.flatMap(detail => detail ? [detail.manga] : []));
  const match = candidate ? details.find(detail => detail?.manga.id === candidate.id) : null;
  if (!match) { await cacheSet(missKey, true, 300); return null; }
  await saveChapterSourceLink(manga.id, match.manga.id, manga.title);
  return match;
}

async function canonicalChapterFeed(id: string, language: string): Promise<ChapterCard[]> {
  if (language !== 'vi') return mangaDexChapterFeed(id, language);
  const cached = await cacheGet<ChapterCard[]>('catalog:merged-chapters:v2:' + id);
  if (cached) return cached;
  const pending = chapterSyncRequests.get(id); if (pending) return pending;
  const request = (async () => {
    const primary = readerNavigation(await mangaDexChapterFeed(id, language));
    try {
      const manga = await getMangaDetail(id);
      if (!manga) return primary;
      const source = await matchingGgSource(manga);
      if (!source) return primary;
      const parts = chapterSourceParts(id, source.manga.id);
      await saveGgReferences(parts.filter(part => part.path).map(part => ({
        id: part.sourceId, kind: 'manga' as const, path: part.path!, mangaId: part.sourceId
      })));
      const loaded = await Promise.allSettled(parts.map(async part => ({
        part, detail: part.sourceId === source.manga.id ? source : await getGgDetail(part.sourceId)
      })));
      const aliases: ChapterCard[] = [];
      for (const result of loaded) {
        if (result.status !== 'fulfilled' || !result.value.detail) continue;
        const { part, detail } = result.value;
        const mapped = sourceChapterAliases(id, detail.chapters, ggId, part.offset, part.label);
        const aliasIds = new Map(detail.chapters.map((chapter, i) => [chapter.id, mapped[i].id]));
        await saveGgReferences(detail.refs.filter(ref => ref.kind === 'chapter' && aliasIds.has(ref.id)).map(ref => ({
          ...ref, id: aliasIds.get(ref.id)!, mangaId: id
        })));
        aliases.push(...mapped);
      }
      const merged = mergeChapterSources(primary, aliases);
      await cacheSet('catalog:merged-chapters:v2:' + id, merged, 300);
      return merged;
    } catch {
      // A supplemental source outage must not hide readable MangaDex chapters.
      return primary;
    }
  })();
  chapterSyncRequests.set(id, request);
  try { return await request; } finally { chapterSyncRequests.delete(id); }
}

// 5. MANGA CHAPTERS
export async function getMangaChapters(
  mangaId: string,
  page: number = 1,
  ascending: boolean = false,
  language: string = 'vi'
): Promise<{ items: ChapterCard[]; total: number; page: number; pageSize: number }> {
  const gg = language === 'vi' ? await getGgChapters(mangaId, ascending) : null;
  if (gg) return gg;
  await ensureDbInitialized();

  // Try DB chapters
  const rows = await sql`
    SELECT "Id", "MangaId", "Number", "Title", "Language", "PublishedAt", "ContentType", array_length("Pages", 1) as pages_count
    FROM "Chapters"
    WHERE "MangaId" = ${mangaId} AND "Language" = ${language}
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

  const chapters = readerNavigation(await canonicalChapterFeed(mangaId, language));
  const items = ascending ? chapters : [...chapters].reverse();
  return { items, total: items.length, page: 1, pageSize: Math.max(1, items.length) };
}

// 6. CHAPTER READER
export async function getChapterReader(chapterId: string): Promise<ReaderData | null> {
  const ref = await findGgReference(chapterId, 'chapter');
  const linkedSource = ref ? await findChapterSourceLink(ref.mangaId).catch(() => null) : null;
  if (ref && linkedSource) {
    const nativeRef = await findGgReference(ggId('truyengg:chap:' + ref.path), 'chapter');
    const parts = chapterSourceParts(ref.mangaId, linkedSource);
    const part = parts.find(item => item.sourceId === (nativeRef?.mangaId || linkedSource));
    if (!part) return null;
    const [reader, manga, navigation] = await Promise.all([
      getGgReader(chapterId, part.sourceId), getMangaDetail(ref.mangaId), canonicalChapterFeed(ref.mangaId, 'vi')
    ]);
    if (!reader || !manga) return null;
    const chapter = navigation.find(item => item.id === chapterId)
      || sourceChapterAliases(ref.mangaId, [reader.chapter], ggId, part.offset, part.label)[0];
    return { ...reader, chapter, manga, navigation: readerNavigation(navigation, chapter) };
  }
  const gg = await getGgReader(chapterId);
  if (gg) return gg;
  await ensureDbInitialized();

  // Try DB chapter
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
      id: c.MangaId,
      title: c.manga_title,
      alternativeTitle: '',
      author: c.manga_author || 'Chưa rõ',
      cover: c.manga_cover || '/cover-placeholder.svg',
      description: '',
      genres: [],
      status: 'ongoing',
      country: 'jp',
      demographic: 'shounen',
      updatedAt: new Date().toISOString(),
      chapters: []
    };

    const pages: string[] = c.Pages || [];

    // Get sibling chapters for navigation
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

  return readMangaDexChapter(chapterId, {
    get: mangaDexGet,
    manga: getMangaDetail,
    chapters: canonicalChapterFeed
  });
}

// 7. TAGS
async function getMangaDexTags(): Promise<{ id: string; name: string }[]> {
  const key = 'catalog:tags:mangadex:v1';
  const cached = await cacheGet<{ id: string; name: string }[]>(key);
  if (cached) return cached;
  const data = await mangaDexGet('/manga/tag');
  const tags = (data.data || []).map((t: any) => ({
    id: t.id, name: t.attributes?.name?.vi || t.attributes?.name?.en || ''
  })).filter((t: { name: string }) => t.name);
  await cacheSet(key, tags, 3600);
  return tags;
}

export async function getTags(): Promise<{ id: string; name: string }[]> {
  const [remote, local, gg] = await Promise.allSettled([
    getMangaDexTags(),
    (async () => {
      await ensureDbInitialized();
      const rows = await sql`SELECT "Id", "Name" FROM "TaxonomyItems" WHERE "Type" = 'genre' ORDER BY "Name" ASC`;
      return rows.map((r: any) => ({ id: r.Id, name: r.Name as string }));
    })(),
    getGgTags()
  ]);
  const tags = new Map<string, { id: string; name: string }>();
  for (const result of [remote, gg, local]) {
    if (result.status !== 'fulfilled') continue;
    for (const tag of result.value) if (!tags.has(tag.name.toLowerCase())) tags.set(tag.name.toLowerCase(), tag);
  }
  return [...tags.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

// 8. AUTHORS
export async function getAuthorManga(name: string, page: number = 1, pageSize: number = 24): Promise<CatalogPage> {
  return searchCatalog({ author: name, page, pageSize });
}
