import { Manga, Page } from '../types';
import { getStoredToken } from './utils';
import {
  clientGetHome,
  clientGetFeatured,
  clientSearch,
  clientGetDetail,
  clientGetChapters,
  clientGetReader,
  clientGetTags
} from './mimi-client';

async function clientFallback<T>(path: string): Promise<T | null> {
  if (typeof window === 'undefined') return null;

  try {
    const [pathname, qs] = path.split('?');
    const params = new URLSearchParams(qs || '');

    // 1. Home
    if (pathname === '/catalog/home') {
      const page = Number(params.get('page')) || 1;
      const pageSize = Number(params.get('pageSize')) || 30;
      return (await clientGetHome(page, pageSize)) as unknown as T;
    }

    // 2. Featured
    if (pathname === '/catalog/featured') {
      const limit = Number(params.get('limit')) || 20;
      const page = Number(params.get('page')) || 1;
      return (await clientGetFeatured(limit, page)) as unknown as T;
    }

    // 3. Search
    if (pathname === '/catalog/search') {
      const p: Record<string, string | number> = {};
      params.forEach((val, key) => { p[key] = val; });
      return (await clientSearch(p)) as unknown as T;
    }

    // 4. Author: /catalog/author?name=... OR /catalog/author/:name
    const authorMatch = pathname.match(/^\/catalog\/author\/(.+)$/);
    if (pathname === '/catalog/author' || authorMatch) {
      const author = authorMatch
        ? decodeURIComponent(authorMatch[1])
        : params.get('name') || '';
      const page = Number(params.get('page')) || 1;
      const pageSize = Number(params.get('pageSize')) || 24;
      const sort = params.get('sort') || '';
      return (await clientSearch({ author, page, pageSize, sort })) as unknown as T;
    }

    // 5. Tags
    if (pathname === '/catalog/tags') {
      return (await clientGetTags()) as unknown as T;
    }

    // 6. Chapters list: /catalog/:id/chapters
    const chaptersMatch = pathname.match(/^\/catalog\/([^/]+)\/chapters$/);
    if (chaptersMatch) {
      const mangaId = chaptersMatch[1];
      const ascending = params.get('ascending') === 'true';
      return (await clientGetChapters(mangaId, ascending)) as unknown as T;
    }

    // 7. Manga detail: /catalog/:id
    const detailMatch = pathname.match(/^\/catalog\/([^/]+)$/);
    if (detailMatch) {
      const mangaId = detailMatch[1];
      return (await clientGetDetail(mangaId)) as unknown as T;
    }

    // 8. Reader: /chapters/:id
    const readerMatch = pathname.match(/^\/chapters\/([^/]+)$/);
    if (readerMatch) {
      const chapterId = readerMatch[1];
      return (await clientGetReader(chapterId)) as unknown as T;
    }
  } catch (err) {
    console.warn('[ClientFallback Error]', path, err);
  }

  return null;
}

export class ApiClient {
  private cache = new Map<string, { data: unknown; expiry: number }>();
  private pending = new Map<string, Promise<unknown>>();
  private preloadedImages = new Set<string>();

  hasCached(path: string): boolean {
    const hit = this.cache.get(path);
    return !!hit && hit.expiry > Date.now();
  }

  getCached<T>(path: string): T | undefined {
    const hit = this.cache.get(path);
    if (hit && hit.expiry > Date.now()) {
      return hit.data as T;
    }
    return undefined;
  }

  preloadImages(urls: string[]): void {
    if (typeof window === 'undefined') return;
    for (const u of urls) {
      if (!u || u === '/cover-placeholder.svg' || this.preloadedImages.has(u)) continue;
      this.preloadedImages.add(u);
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.src = u;
    }
  }

  prefetch(path: string): void {
    if (this.hasCached(path)) return;
    void this.request<Page<Manga>>(path, 'GET', undefined, true)
      .then(res => {
        if (res && res.items && Array.isArray(res.items)) {
          const topCovers = res.items.slice(0, 6).map(m => m.cover).filter(Boolean);
          this.preloadImages(topCovers);
        }
      })
      .catch(() => {});
  }

  prefetchDetail(id: string, language = 'vi'): void {
    if (!id) return;
    const detailPath = '/catalog/' + id;
    if (!this.hasCached(detailPath)) {
      void this.request<Manga>(detailPath, 'GET', undefined, true)
        .then(m => {
          if (m && m.cover) this.preloadImages([m.cover]);
        })
        .catch(() => {});
    }
    const chapPath = `/catalog/${id}/chapters?page=1&language=${language}&ascending=false`;
    if (!this.hasCached(chapPath)) {
      void this.request(chapPath, 'GET', undefined, true).catch(() => {});
    }
    const commPath = `/catalog/${id}/community`;
    if (!this.hasCached(commPath)) {
      void this.request(commPath, 'GET', undefined, true).catch(() => {});
    }
  }

  clearCache(prefix?: string) {
    if (!prefix) {
      this.cache.clear();
    } else {
      for (const k of Array.from(this.cache.keys())) {
        if (k.includes(prefix)) this.cache.delete(k);
      }
    }
  }

  async request<T>(path: string, method = 'GET', body?: unknown, useCache = false): Promise<T> {
    // Hover prefetches and mounted components can request the same data together.
    // Share GET work, including retries and the upstream fallback.
    if (method !== 'GET') return this.performRequest<T>(path, method, body, useCache);
    const existing = this.pending.get(path);
    if (existing) return existing as Promise<T>;
    const pending = this.performRequest<T>(path, method, body, useCache)
      .finally(() => { this.pending.delete(path); });
    this.pending.set(path, pending);
    return pending;
  }

  private async performRequest<T>(path: string, method: string, body: unknown, useCache: boolean): Promise<T> {
    const isGet = method === 'GET';
    const shouldCache = isGet && (useCache || path.startsWith('/chapters/') || path.startsWith('/catalog/'));
    if (shouldCache) {
      const hit = this.cache.get(path);
      if (hit && hit.expiry > Date.now()) {
        return hit.data as T;
      }
    }
    const token = getStoredToken();
    const maxRetries = isGet ? 1 : 0;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, attempt * 500));
        }
        const response = await fetch('/api' + path, {
          method,
          headers: {
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: body !== undefined ? JSON.stringify(body) : undefined
        });

        if (!response.ok) {
          // If server fails (e.g. 403 / 502 / 404 from Cloudflare block on Vercel), fallback to direct MimiHentai
          if (isGet && (path.startsWith('/catalog/') || path.startsWith('/chapters/'))) {
            const fallback = await clientFallback<T>(path);
            if (fallback) {
              if (shouldCache) {
                this.cache.set(path, { data: fallback, expiry: Date.now() + 15 * 60 * 1000 });
              }
              return fallback;
            }
          }

          if (isGet && attempt < maxRetries && [500, 502, 503, 504].includes(response.status)) {
            continue;
          }
          let info: any;
          try {
            info = await response.json();
          } catch {}
          throw new Error(
            info?.message ||
              (response.status === 401
                ? 'Vui lòng đăng nhập để tiếp tục.'
                : response.status === 429
                ? 'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.'
                : 'Không tải được dữ liệu. Vui lòng thử lại.')
          );
        }

        const result = response.status === 204 ? (undefined as T) : await response.json();

        // If server returned an empty page because Vercel was blocked by Cloudflare (403 on backend)
        const isCatalogGet = isGet && (path.startsWith('/catalog/') || path.startsWith('/chapters/'));
        const isEmptyItems =
          result &&
          typeof result === 'object' &&
          'items' in (result as any) &&
          Array.isArray((result as any).items) &&
          (result as any).items.length === 0;
        const isEmptyArray = Array.isArray(result) && result.length === 0;

        if (isCatalogGet && (isEmptyItems || isEmptyArray)) {
          const fallback = await clientFallback<T>(path);
          if (fallback) {
            const hasItems =
              typeof fallback === 'object' &&
              'items' in (fallback as any) &&
              Array.isArray((fallback as any).items) &&
              (fallback as any).items.length > 0;
            const hasArray = Array.isArray(fallback) && fallback.length > 0;
            if (hasItems || hasArray) {
              if (shouldCache) {
                this.cache.set(path, { data: fallback, expiry: Date.now() + 15 * 60 * 1000 });
              }
              return fallback;
            }
          }
        }

        if (shouldCache) {
          const isEmpty =
            (result &&
              typeof result === 'object' &&
              'items' in (result as any) &&
              Array.isArray((result as any).items) &&
              (result as any).items.length === 0) ||
            (Array.isArray(result) && result.length === 0);
          if (!isEmpty) {
            this.cache.set(path, { data: result, expiry: Date.now() + 15 * 60 * 1000 });
          }
        }
        return result;
      } catch (err) {
        lastError = err;

        // Try client-side fallback before giving up
        if (isGet && (path.startsWith('/catalog/') || path.startsWith('/chapters/'))) {
          const fallback = await clientFallback<T>(path);
          if (fallback) {
            if (shouldCache) {
              this.cache.set(path, { data: fallback, expiry: Date.now() + 15 * 60 * 1000 });
            }
            return fallback;
          }
        }

        if (isGet && attempt < maxRetries && !(err instanceof Error && err.message.includes('đăng nhập'))) {
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  query(params: Record<string, unknown>): string {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== '' && v !== undefined && v !== null) q.set(k, String(v));
    });
    return q.toString();
  }
}

export const api = new ApiClient();
