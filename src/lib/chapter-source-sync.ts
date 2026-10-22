import type { MangaCard, ChapterCard } from './catalog-service';

export function normalizeStoryTitle(title: string): string {
  return title.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').replace(/[×✕✖]/g, 'x')
    .toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}
function titleKeys(manga: Pick<MangaCard, 'title' | 'alternativeTitle'>): Set<string> {
  return new Set([manga.title, ...manga.alternativeTitle.split(/[;/|\n]/)]
    .map(normalizeStoryTitle).filter(key => key.length >= 4));
}
export function sameStoryTitle(a: Pick<MangaCard, 'title' | 'alternativeTitle'>, b: Pick<MangaCard, 'title' | 'alternativeTitle'>): boolean {
  const keys = titleKeys(a); return [...titleKeys(b)].some(key => keys.has(key));
}
function knownAuthors(author: string): string[] {
  return author.split(/[/;|()]/).map(name => name.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean).sort().join(' '))
    .filter(name => name && !['cap dang nhat', 'chua ro', 'unknown', 'updating', 'chua gia ro tac'].includes(name));
}
export function canLinkChapterSource(manga: MangaCard, candidate: MangaCard): boolean {
  if (!sameStoryTitle(manga, candidate)) return false;
  const aliases: Record<string, string> = { jp: 'ja', cn: 'zh', 'zh-hk': 'zh' };
  const a = aliases[manga.country] || manga.country; const b = aliases[candidate.country] || candidate.country;
  if (a && b && a !== b) return false;
  const authors = knownAuthors(manga.author); const candidateAuthors = knownAuthors(candidate.author);
  if (authors.length && candidateAuthors.length && !authors.some(author => candidateAuthors.includes(author))) return false;
  return true;
}
export function mergeChapterSources(primary: ChapterCard[], supplemental: ChapterCard[]): ChapterCard[] {
  const selected = new Map<string, ChapterCard>();
  const key = (chapter: ChapterCard) => chapter.number > 0 ? String(chapter.number) : chapter.title.trim().toLowerCase();
  // Preserve source IDs for existing MangaDex chapters. Supplemental chapters only fill gaps.
  for (const chapter of supplemental) if (!selected.has(key(chapter))) selected.set(key(chapter), chapter);
  for (const chapter of primary) selected.set(key(chapter), chapter);
  return [...selected.values()].sort((a, b) => a.number - b.number || a.publishedAt.localeCompare(b.publishedAt));
}
export function sourceChapterAliases(canonicalId: string, chapters: ChapterCard[], identify: (key: string) => string, offset = 0, label = ''): ChapterCard[] {
  return chapters.map(chapter => ({ ...chapter,
    id: identify('truyengg:alias:' + canonicalId + ':' + chapter.id), mangaId: canonicalId,
    number: chapter.number + offset,
    title: offset ? 'Chương ' + (chapter.number + offset) + (label ? ' · ' + label + ' - ' + chapter.title : '') : chapter.title
  }));
}

export interface ChapterSourcePart { sourceId: string; offset: number; label?: string; path?: string }
export function chapterSourceParts(canonicalId: string, matchedSourceId: string): ChapterSourcePart[] {
  // Verified source editions: TruyenGG resets numbering after 110 chapters and again after 69.
  // Keep these explicit; never infer that an arbitrary sequel belongs to the same MangaDex entry.
  if (canonicalId === '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0' && matchedSourceId === 'ef65c99b-a3c2-4cf1-3f86-629eafdb2648') {
    return [
      { sourceId: matchedSourceId, offset: 0 },
      { sourceId: '4fcbafa7-2904-9abb-e354-5e551398d436', offset: 110, label: 'SS2', path: '/truyen-tranh/toi-thang-cap-mot-minh-ss2-10087' },
      { sourceId: 'a6cd5fbb-3666-5028-8e69-8e3cc1b3f0d5', offset: 179, label: 'SS3', path: '/truyen-tranh/solo-leveling-ss3-13597' }
    ];
  }
  return [{ sourceId: matchedSourceId, offset: 0 }];
}

export function uniqueChapterSourceMatch(manga: MangaCard, candidates: MangaCard[]): MangaCard | null {
  const matches = [...new Map(candidates.filter(candidate => canLinkChapterSource(manga, candidate)).map(candidate => [candidate.id, candidate])).values()];
  return matches.length === 1 ? matches[0] : null;
}
