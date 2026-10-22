import { createHash } from 'node:crypto';
import { cacheGet, cacheSet } from './redis';
import { saveGgReferences, findGgReference } from './source-references';
import { GG_ORIGIN, ggId, parseGgGrid, parseGgSearch, parseGgDetail, parseGgReaderPages, ggGenres } from './truyengg-parser';
import type { CatalogFilters } from './mangadex-catalog';
import type { MangaCard, ReaderData, ChapterCard } from './catalog-service';
import type { GgGrid, GgReference } from './truyengg-parser';

const pending = new Map<string, Promise<string>>();
const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36', Referer: GG_ORIGIN + '/' };
async function ggHtml(path: string, search?: string): Promise<string> {
  const key = 'truyengg:html:next:v1:' + createHash('sha256').update(path + ':' + (search || '')).digest('hex');
  const cached = await cacheGet<string>(key); if (cached) return cached;
  const inFlight = pending.get(key); if (inFlight) return inFlight;
  const request = (async () => {
    const res = await fetch(GG_ORIGIN + path, {
      method: search === undefined ? 'GET' : 'POST',
      headers: search === undefined ? headers : { ...headers, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: search === undefined ? undefined : new URLSearchParams({ search }),
      signal: AbortSignal.timeout(10000), next: { revalidate: 300 }
    });
    if (!res.ok) throw new Error('Nguồn TruyenGG tạm thời không phản hồi.');
    const html = await res.text();
    if (!html || /<title>[^<]*(?:Attention Required|Just a moment)/i.test(html)) throw new Error('TruyenGG chưa trả về nội dung truyện.');
    await cacheSet(key, html, 300); return html;
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}

export async function getGgTags(): Promise<{ id: string; name: string }[]> {
  const tags = ggGenres(await ggHtml('/tim-kiem-nang-cao.html'));
  if (!tags.length) throw new Error('Không đọc được thể loại TruyenGG.');
  return tags;
}

export interface GgFilters extends CatalogFilters { genreName?: string }
function supports(filters: GgFilters) {
  return filters.language !== 'en' && !filters.author && !filters.year
    && !['hiatus', 'cancelled'].includes(filters.status || '')
    && !['title', 'rating', 'chapters'].includes(filters.sort || '');
}
async function queryFor(filters: GgFilters) {
  const query = new URLSearchParams({ sort: filters.sort === 'new' ? '0' : filters.sort === 'hot' ? '4' : '2', status: '-1' });
  if (filters.status) query.set('status', filters.status === 'completed' ? '2' : '0');
  const countries: Record<string, string> = { ja: '4', jp: '4', ko: '3', zh: '1', cn: '1', 'zh-hk': '1', vi: '2', en: '5' };
  if (filters.country) {
    const country = countries[filters.country]; if (!country) return null;
    query.set('country', country);
  }
  if (filters.genre || filters.demographic) {
    const tags = await getGgTags(); const wanted = [filters.genreName, filters.demographic].filter(Boolean);
    const ids = wanted.map(name => tags.find(t => t.name.toLowerCase() === name!.toLowerCase())?.id.replace('gg-', ''));
    if (filters.genre?.startsWith('gg-')) ids.push(filters.genre.slice(3));
    if (!ids.length || ids.some(id => !id)) return null;
    query.set('category', [...new Set(ids)].join(','));
  }
  return query;
}
async function gridPage(filters: GgFilters, page: number): Promise<GgGrid> {
  const query = await queryFor(filters);
  if (!query) return { items: [], refs: [], lastPage: 1 };
  const base = filters.sort === 'hot' && !filters.genre && !filters.demographic ? '/truyen-yeu-thich' : '/tim-kiem-nang-cao';
  const path = base + '/trang-' + page + '.html?' + query;
  const parsed = parseGgGrid(await ggHtml(path), page, filters.country || 'ja');
  await saveGgReferences(parsed.refs); return parsed;
}
async function suggestions(filters: GgFilters): Promise<MangaCard[]> {
  const parsed = parseGgSearch(await ggHtml('/frontend/search/search', filters.q!.trim()));
  await saveGgReferences(parsed.refs);
  if (!filters.genre && !filters.demographic && !filters.country && !filters.status) return parsed.items;
  // The suggestion endpoint has no filters. Inspect details only when the caller requests them.
  const detailed: MangaCard[] = [];
  for (let offset = 0; offset < parsed.items.length; offset += 3) {
    const results = await Promise.allSettled(parsed.items.slice(offset, offset + 3).map(m => getGgDetail(m.id)));
    for (const result of results) {
      if (result.status !== 'fulfilled' || !result.value) continue;
      const m = result.value.manga;
      if (filters.country && !filters.country.split(',').includes(m.country)) continue;
      if (filters.status && m.status !== filters.status) continue;
      if (filters.demographic && m.demographic !== filters.demographic) continue;
      if (filters.genreName && !m.genres.some(g => g.toLowerCase() === filters.genreName!.toLowerCase())) continue;
      detailed.push(m);
    }
  }
  return detailed;
}
function splitCountries(filters: GgFilters): GgFilters[] {
  return filters.country?.includes(',') ? [...new Set(filters.country.split(','))].map(country => ({ ...filters, country })) : [filters];
}
export async function ggTotal(filters: GgFilters): Promise<number> {
  if (!supports(filters)) return 0;
  if (filters.q) return (await suggestions(filters)).length;
  const parts = splitCountries(filters);
  if (parts.length > 1) return (await Promise.all(parts.map(ggTotal))).reduce((a, b) => a + b, 0);
  const key = 'truyengg:count:v2:' + JSON.stringify(filters);
  const cached = await cacheGet<number>(key); if (cached !== null) return cached;
  const first = await gridPage(filters, 1);
  if (!first.items.length) return 0;
  const last = first.lastPage === 1 ? first : await gridPage(filters, first.lastPage);
  const total = (first.lastPage - 1) * first.items.length + last.items.length;
  await cacheSet(key, total, 300); return total;
}
export async function ggWindow(filters: GgFilters, offset: number, limit: number): Promise<MangaCard[]> {
  if (!limit || !supports(filters)) return [];
  if (filters.q) return (await suggestions(filters)).slice(offset, offset + limit);
  const parts = splitCountries(filters);
  if (parts.length > 1) {
    const counts = await Promise.all(parts.map(ggTotal)); const output: MangaCard[] = [];
    for (let i = 0; i < parts.length && output.length < limit; i++) {
      if (offset >= counts[i]) { offset -= counts[i]; continue; }
      output.push(...await ggWindow(parts[i], offset, Math.min(limit - output.length, counts[i] - offset))); offset = 0;
    }
    return output;
  }
  const first = await gridPage(filters, 1); const size = first.items.length;
  if (!size) return [];
  const start = Math.floor(offset / size) + 1; const end = Math.min(first.lastPage, Math.floor((offset + limit - 1) / size) + 1);
  const pages = await Promise.all(Array.from({ length: Math.max(0, end - start + 1) }, (_, i) => gridPage(filters, start + i)));
  return pages.flatMap(p => p.items).slice(offset % size, offset % size + limit);
}

export async function getGgDetail(id: string): Promise<{ manga: MangaCard; chapters: ChapterCard[]; refs: GgReference[] } | null> {
  const ref = await findGgReference(id, 'manga'); if (!ref) return null;
  const detail = parseGgDetail(await ggHtml(ref.path), ref.path);
  await saveGgReferences(detail.refs); return detail;
}
export async function getGgChapters(id: string, ascending = false) {
  const detail = await getGgDetail(id); if (!detail) return null;
  const items = ascending ? [...detail.chapters].reverse() : detail.chapters;
  return { items, total: items.length, page: 1, pageSize: Math.max(1, items.length) };
}
export async function getGgReader(id: string, sourceMangaId?: string): Promise<ReaderData | null> {
  const ref = await findGgReference(id, 'chapter'); if (!ref) return null;
  const [detail, html] = await Promise.all([getGgDetail(sourceMangaId || ref.mangaId), ggHtml(ref.path)]);
  if (!detail) throw new Error('Không tìm thấy truyện TruyenGG.');
  const pages = parseGgReaderPages(html);
  if (!pages.length) throw new Error('TruyenGG chưa cung cấp ảnh cho chương này.');
  const chapter = detail.chapters.find(c => c.id === (sourceMangaId ? ggId('truyengg:chap:' + ref.path) : id));
  if (!chapter) throw new Error('Chương không còn trong danh sách TruyenGG.');
  return { chapter, manga: detail.manga, pages, dataSaverPages: pages, externalUrl: null, navigation: [...detail.chapters].reverse() };
}

// Title suggestions do not invent chapters. Callers verify the full detail before linking catalogs.
export async function searchGgTitles(query: string): Promise<MangaCard[]> {
  return suggestions({ q: query, language: 'vi' });
}
