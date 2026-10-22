import { Manga, Page } from '../types';
import { getStoredToken } from './utils';

export class ApiClient {
  private cache = new Map<string, { data: unknown; expiry: number }>();
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
    const isGet = method === 'GET';
    const shouldCache = isGet && (useCache || path.startsWith('/chapters/') || path.startsWith('/catalog/'));
    if (shouldCache) {
      const hit = this.cache.get(path);
      if (hit && hit.expiry > Date.now()) {
        return hit.data as T;
      }
    }
    const token = getStoredToken();
    const maxRetries = isGet ? 2 : 0;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(r => setTimeout(r, attempt * 800));
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
        if (shouldCache) {
          const isSearch = path.startsWith('/catalog/search') || path.startsWith('/catalog/author');
          const isEmpty =
            result &&
            typeof result === 'object' &&
            'items' in (result as any) &&
            Array.isArray((result as any).items) &&
            (result as any).items.length === 0;
          if (!isSearch || !isEmpty) {
            this.cache.set(path, { data: result, expiry: Date.now() + 15 * 60 * 1000 });
          }
        }
        return result;
      } catch (err) {
        lastError = err;
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
