import { Manga, BannerImage } from '../types';

export function hasRomanceGenre(_manga?: Pick<Manga, 'genres'>): boolean {
  return true;
}

// Publish each usable image immediately; a slow CDN must not hold up the hero.
export async function loadSpotlightImages(
  candidates: Manga[],
  probe: (url: string) => Promise<BannerImage | null>,
  publish: (selected: Manga[], images: Record<string, BannerImage>) => void,
  isCurrent: () => boolean
): Promise<void> {
  const images: Record<string, BannerImage> = {};
  let cursor = 0;
  const worker = async () => {
    while (cursor < candidates.length && Object.keys(images).length < 10 && isCurrent()) {
      const manga = candidates[cursor++];
      if (!manga) break;
      const urls = [...new Set([originalBannerCover(manga.cover), manga.cover])].filter(
        url => url && !url.includes('cover-placeholder')
      );
      for (const url of urls) {
        const image = await probe(url);
        if (!isCurrent()) return;
        if (image && bannerImageScore(image) > 0) {
          images[manga.id] = image;
          publish(rankSpotlightCandidates(candidates, Date.now(), images).slice(0, 10), images);
          break;
        }
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, candidates.length) }, worker));
}

export function bannerImageScore(image: BannerImage): number {
  if (image.width < 300 || image.height < 200) return 0;
  const resolution = Math.min(1, image.width / 1200) * 20;
  const composition = Math.min(1, image.width / image.height / (16 / 9)) * 15;
  return resolution + composition + 10;
}

export function rankSpotlightCandidates(
  items: Manga[],
  now = Date.now(),
  images?: Record<string, BannerImage>
): Manga[] {
  const unique = new Map<string, Manga>();
  const score = (m: Manga) => {
    const chapters = Array.isArray(m?.chapters) ? m.chapters : [];
    const updated = chapters.length > 0
      ? Math.max(...chapters.map(c => Date.parse(c.publishedAt) || 0))
      : (Date.parse(m?.updatedAt) || 0);
    const days = Math.max(0, (now - updated) / 86400000);
    return (
      Math.max(0, Math.min(10, m.rating || 0)) * 4 +
      Math.min(25, Math.log10(1 + Math.max(0, m.follows || m.views || 0)) * 5) +
      15 / (1 + days / 7) +
      (images ? bannerImageScore(images[m.id]) : 0)
    );
  };
  for (const m of items) {
    if (!m) continue;
    if (!m.cover || m.cover.includes('cover-placeholder')) continue;
    if (images && (!images[m.id] || bannerImageScore(images[m.id]) === 0)) continue;
    const key = (m.title || m.id).normalize('NFKC').toLocaleLowerCase('vi').trim();
    const existing = unique.get(key);
    if (!existing || score(m) > score(existing)) unique.set(key, m);
  }
  return [...unique.values()].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}

export function originalBannerCover(url: string): string {
  return url || '';
}
