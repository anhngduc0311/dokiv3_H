import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import type { MangaCard, ChapterCard } from './catalog-service';

export const GG_ORIGIN = 'https://truyenggvn.com';
export interface GgReference { id: string; kind: 'manga' | 'chapter'; path: string; mangaId: string }
export interface GgGrid { items: MangaCard[]; refs: GgReference[]; lastPage: number }

// Match the GUID byte ordering of the existing ASP.NET adapter so old links remain valid.
export function ggId(key: string): string {
  const hash = createHash('md5').update(key).digest();
  hash.subarray(0, 4).reverse(); hash.subarray(4, 6).reverse(); hash.subarray(6, 8).reverse();
  const hex = hash.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

export function ggPath(value: string, kind: 'manga' | 'chapter'): string | null {
  try {
    const url = new URL(value, GG_ORIGIN);
    if (url.origin !== GG_ORIGIN || url.username || url.password || url.search || url.hash) return null;
    const path = url.pathname.replace(/\/$/, '');
    if (!/^\/truyen-tranh\/[a-z0-9.-]+$/i.test(path)) return null;
    if (kind === 'chapter' ? !/-chap-[\d.-]+\.html$/.test(path) : /-chap-[\d.-]+\.html$/.test(path)) return null;
    return path;
  } catch { return null; }
}

export function ggImage(value: string): string {
  if (!value) return '';
  try {
    const url = new URL(value, GG_ORIGIN);
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    return url.href;
  } catch { return ''; }
}
export function ggProxy(value: string): string {
  const url = ggImage(value);
  return url ? '/api/catalog/image-proxy?url=' + encodeURIComponent(url) : '/cover-placeholder.svg';
}
export function ggTime(text: string, now = Date.now()): string {
  const relative = text.toLowerCase().match(/(\d+)\s*(giây|phút|giờ|ngày|tháng|năm)/);
  if (relative) {
    const units: Record<string, number> = { 'giây': 1000, 'phút': 60000, 'giờ': 3600000, 'ngày': 86400000, 'tháng': 2592000000, 'năm': 31536000000 };
    return new Date(now - Number(relative[1]) * units[relative[2]]).toISOString();
  }
  const date = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (date) return new Date(Date.UTC(+date[3], +date[2] - 1, +date[1])).toISOString();
  return new Date(now).toISOString();
}
function number(text: string): number { return Number(text.replace(/[^\d.]/g, '')) || 0; }
function chapterNumber(text: string): number { return Number(text.match(/(?:chương|chapter|chap|ch|c)\s*([\d.]+)/i)?.[1] || text.match(/[\d.]+/)?.[0]) || 0; }
function blankCard(path: string, title: string): MangaCard {
  const slug = path.slice('/truyen-tranh/'.length);
  return { id: ggId('truyengg:manga:' + slug), slug, title, alternativeTitle: '', author: 'Đang cập nhật',
    cover: '/cover-placeholder.svg', description: '', genres: [], status: 'ongoing', country: 'ja', demographic: '',
    contentRating: 'safe', rating: 0, follows: 0, views: 0, updatedAt: new Date().toISOString(), chapters: [], source: 'truyengg' };
}
function setTaxonomy(card: MangaCard, defaultCountry = 'ja') {
  const tags = card.genres.map(g => g.toLowerCase());
  card.country = tags.includes('manhwa') ? 'ko' : tags.includes('manhua') ? 'zh' : defaultCountry;
  card.demographic = tags.find(t => ['shounen', 'shoujo', 'seinen', 'josei'].includes(t)) || '';
  if (tags.some(t => ['adult', 'mature', '18+', 'hentai'].includes(t))) card.contentRating = 'erotica';
}
function chapterLink(path: string, title: string, mangaId: string, publishedAt: string): ChapterCard {
  return { id: ggId('truyengg:chap:' + path), mangaId, title, number: chapterNumber(title), language: 'vi', publishedAt, group: 'TruyenGG' };
}

export function parseGgGrid(html: string, currentPage = 1, defaultCountry = 'ja'): GgGrid {
  const $ = load(html); const items: MangaCard[] = []; const refs: GgReference[] = [];
  $('.list_grid > li').each((_, li) => {
    const block = $(li); const link = block.find('.book_name a').first();
    const path = ggPath(link.attr('href') || '', 'manga');
    const title = link.text().trim(); if (!path || !title) return;
    const card = blankCard(path, title);
    card.alternativeTitle = block.find('.title-more-other').text().replace(/^Tên khác:\s*/i, '').trim();
    card.cover = ggProxy(block.find('.book_avatar img').attr('src') || '');
    card.description = block.find('.excerpt').text().trim();
    card.genres = block.find('.list-tags .blue').map((_, el) => $(el).text().trim()).get();
    card.updatedAt = ggTime(block.find('.time-ago').text());
    card.follows = number(block.find('.text_detail .fa-bookmark').parent().text());
    card.views = number(block.find('.text_detail .fa-eye').parent().text());
    card.status = /Hoàn thành/i.test(block.find('.more-info .info').first().text()) ? 'completed' : 'ongoing';
    setTaxonomy(card, defaultCountry);
    const chap = block.find('.last_chapter a').first(); const chapPath = ggPath(chap.attr('href') || '', 'chapter');
    if (chapPath) {
      card.chapters = [chapterLink(chapPath, chap.text().trim(), card.id, card.updatedAt)];
      refs.push({ id: card.chapters[0].id, kind: 'chapter', path: chapPath, mangaId: card.id });
      card.totalChapters = card.chaptersCount = card.chapters[0].number;
    }
    refs.push({ id: card.id, kind: 'manga', path, mangaId: card.id }); items.push(card);
  });
  const pages = $('.page_redirect a[href]').map((_, a) => Number($(a).attr('href')?.match(/trang-(\d+)\.html/)?.[1] || 0)).get();
  return { items, refs, lastPage: Math.max(currentPage, ...pages) };
}

export function parseGgSearch(html: string): GgGrid {
  const $ = load(html); const items: MangaCard[] = []; const refs: GgReference[] = [];
  $('li').each((_, li) => {
    const block = $(li); const path = ggPath(block.find('a').first().attr('href') || '', 'manga');
    const title = block.find('.name').text().trim(); if (!path || !title) return;
    const card = blankCard(path, title);
    card.alternativeTitle = block.find('.name_other').text().trim();
    card.cover = ggProxy(block.find('img').attr('src') || '');
    // Search suggestions contain chapter labels but no chapter URL; never invent a readable chapter ID.
    refs.push({ id: card.id, kind: 'manga', path, mangaId: card.id }); items.push(card);
  });
  return { items, refs, lastPage: 1 };
}

export function parseGgDetail(html: string, path: string): { manga: MangaCard; chapters: ChapterCard[]; refs: GgReference[] } {
  const $ = load(html); const title = $('h1[itemprop="name"]').first().text().trim();
  if (!title) throw new Error('Không đọc được thông tin TruyenGG.');
  const manga = blankCard(path, title); const refs: GgReference[] = [{ id: manga.id, kind: 'manga', path, mangaId: manga.id }];
  manga.alternativeTitle = $('.book-othername').first().text().trim();
  manga.cover = ggProxy($('.book_info .book_avatar img').first().attr('src') || '');
  manga.description = $('.story-detail-info').first().text().trim();
  manga.genres = $('.book-genres a').map((_, a) => $(a).text().trim()).get();
  $('.book-counts li').each((_, li) => {
    const label = $(li).find('.book-counts__label').text(); const value = $(li).find('.book-counts__value').text().trim();
    if (label.includes('Tác giả')) manga.author = value;
    if (label.includes('Tình trạng')) manga.status = /Hoàn thành/i.test(value) ? 'completed' : 'ongoing';
    if (label.includes('Theo dõi')) manga.follows = number(value);
    if (label.includes('Lượt xem')) manga.views = number(value);
  });
  // Credits in the description often contain both the original-script and Romanized names.
  const credits = manga.description.split(/\r?\n/).map(line => line.trim())
    .filter(line => /^(?:Tác giả(?: nguyên tác)?|Họa sĩ|Biên kịch(?: \/ chuyển thể)?):/i.test(line))
    .map(line => line.replace(/^[^:]+:\s*/, ''));
  if (credits.length) manga.author = [manga.author, ...credits].join(' / ');
  manga.rating = Number($('[itemprop="ratingValue"]').first().attr('content') || $('[itemprop="ratingValue"]').first().text()) || 0;
  const chapters: ChapterCard[] = []; const seen = new Set<string>();
  $('.works-chapter-item').each((_, el) => {
    const link = $(el).find('.name-chap a').first(); const chapPath = ggPath(link.attr('href') || '', 'chapter');
    if (!chapPath || seen.has(chapPath)) return; seen.add(chapPath);
    const chapter = chapterLink(chapPath, link.text().trim(), manga.id, ggTime($(el).find('.time-chap').text()));
    chapters.push(chapter); refs.push({ id: chapter.id, kind: 'chapter', path: chapPath, mangaId: manga.id });
  });
  chapters.sort((a, b) => b.number - a.number || b.publishedAt.localeCompare(a.publishedAt));
  manga.chapters = chapters.slice(0, 3); manga.totalChapters = manga.chaptersCount = chapters.length;
  if (chapters[0]) manga.updatedAt = chapters[0].publishedAt;
  setTaxonomy(manga, '');
  if (!manga.country) {
    const classification = manga.description.match(/^Thể loại:\s*(.+)$/im)?.[1] || '';
    if (/\bmanhwa\b/i.test(classification)) manga.country = 'ko';
    else if (/\bmanhua\b/i.test(classification)) manga.country = 'zh';
    else if (/\bmanga\b/i.test(classification)) manga.country = 'ja';
  }
  return { manga, chapters, refs };
}

export function parseGgReaderPages(html: string): string[] {
  const $ = load(html); const pages: string[] = [];
  $('.page-chapter img').each((_, img) => {
    const el = $(img); const raw = ggImage(el.attr('data-original') || el.attr('data-cdn') || el.attr('data-src') || el.attr('src') || '');
    if (!raw) return; const url = new URL(raw);
    if ((url.hostname === 'hinhhinh.com' || url.hostname.endsWith('.hinhhinh.com')) && url.pathname === '/19852/1/0.jpg') return;
    pages.push(ggProxy(raw));
  });
  return [...new Set(pages)];
}

export function ggGenres(html: string): { id: string; name: string }[] {
  const $ = load(html); const tags = new Map<string, { id: string; name: string }>();
  $('.genre-item').each((_, el) => {
    const id = $(el).find('[data-id]').attr('data-id'); const name = $(el).text().trim();
    if (id && name) tags.set(id, { id: 'gg-' + id, name });
  });
  return [...tags.values()];
}
