import type { Metadata } from 'next';
import type { MangaCard, ReaderData } from './catalog-service';

// Never derive canonical URLs from untrusted request/forwarded-host headers.
export const SITE_URL = 'https://dokihentai.com';
export const SITE_NAME = 'DokiHentai';
export const SITE_DESCRIPTION = 'Đọc truyện tranh tiếng Việt tại DokiHentai. Khám phá truyện, tìm theo tác giả và theo dõi các chương mới cập nhật.';
export type SearchParams = Record<string, string | string[] | undefined>;
export const single = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] || '' : value || '';
export function pageNumber(value: string | string[] | undefined) {
  const n = Number(single(value));
  return Number.isSafeInteger(n) && n > 0 ? n : 1;
}
export const absoluteUrl = (path: string) => new URL(path, SITE_URL).href;
export const mangaPath = (id: string) => `/truyen-tranh/${encodeURIComponent(id)}`;
export const chapterPath = (id: string) => `/chuong/${encodeURIComponent(id)}`;

export function plainText(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}
export function description(value: string, fallback = SITE_DESCRIPTION) {
  const text = plainText(value) || fallback;
  return text.length > 170 ? `${text.slice(0, 167).trimEnd()}…` : text;
}
export function isoDate(value?: string | Date | null) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
export function pageMetadata({ title, text = SITE_DESCRIPTION, path, image = '/brand-mark.png', noindex = false, adult = false }: {
  title: string; text?: string; path: string; image?: string; noindex?: boolean; adult?: boolean;
}): Metadata {
  const fullTitle = `${plainText(title)} | ${SITE_NAME}`;
  const summary = description(text);
  const url = absoluteUrl(path);
  const cover = absoluteUrl(image);
  return {
    title: { absolute: fullTitle }, description: summary,
    alternates: { canonical: url },
    robots: { index: !noindex, follow: true, 'max-image-preview': 'large' },
    openGraph: { title: fullTitle, description: summary, url, siteName: SITE_NAME, locale: 'vi_VN', type: 'website', images: [{ url: cover, alt: plainText(title) }] },
    twitter: { card: 'summary_large_image', title: fullTitle, description: summary, images: [cover] },
    other: adult ? { rating: 'adult' } : undefined,
  };
}
export const isAdult = (m: MangaCard) => ['erotica', 'pornographic', 'explicit'].includes(m.contentRating || '') || m.source === 'mimihentai';
export function mangaMetadata(m: MangaCard) {
  return pageMetadata({ title: `${m.title} - Đọc truyện tranh`, text: m.description || `Đọc ${m.title}${m.author ? ` của ${m.author}` : ''}. Xem thông tin và danh sách chương tại DokiHentai.`, path: mangaPath(m.id), image: m.cover, adult: isAdult(m) });
}
export function breadcrumbs(items: { name: string; path: string }[]) {
  return { '@type': 'BreadcrumbList', itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: plainText(item.name), item: absoluteUrl(item.path) })) };
}
export function mangaSchema(m: MangaCard) {
  return {
    '@type': 'ComicSeries', '@id': `${absoluteUrl(mangaPath(m.id))}#series`,
    name: plainText(m.title), alternateName: m.alternativeTitle || undefined,
    url: absoluteUrl(mangaPath(m.id)), image: absoluteUrl(m.cover),
    description: description(m.description), inLanguage: 'vi', genre: m.genres,
    author: m.author && m.author !== 'Chưa rõ' ? m.author.split(',').map(name => ({ '@type': 'Person', name: name.trim(), url: absoluteUrl(`/tac-gia/${encodeURIComponent(name.trim())}`) })) : undefined,
    dateModified: isoDate(m.updatedAt), contentRating: isAdult(m) ? '18+' : undefined,
    // Source ratings are estimates, not verified user votes: omit aggregateRating.
  };
}
export function readerSchema(data: ReaderData) {
  return { '@type': 'Chapter', '@id': `${absoluteUrl(chapterPath(data.chapter.id))}#chapter`,
    name: `${data.manga.title} - ${data.chapter.title}`, url: absoluteUrl(chapterPath(data.chapter.id)),
    position: data.chapter.number, inLanguage: data.chapter.language,
    datePublished: isoDate(data.chapter.publishedAt), image: absoluteUrl(data.manga.cover),
    isPartOf: { '@type': 'ComicSeries', '@id': `${absoluteUrl(mangaPath(data.manga.id))}#series`, name: data.manga.title, url: absoluteUrl(mangaPath(data.manga.id)) },
  };
}
export function collectionSchema(title: string, path: string, items: MangaCard[]) {
  return { '@type': 'CollectionPage', name: title, url: absoluteUrl(path), inLanguage: 'vi',
    mainEntity: { '@type': 'ItemList', itemListElement: items.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: m.title, url: absoluteUrl(mangaPath(m.id)) })) } };
}
export const serializeJsonLd = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
