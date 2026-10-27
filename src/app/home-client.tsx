'use client';

import React, { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { pageNumber } from '@/lib/seo';
import { useRouter, useSearchParams } from 'next/navigation';
import { Manga, Page, BannerImage } from '../types';
import { api } from '../lib/api';
import { useStore } from '../contexts/store-context';
import { cleanDescription, message, statuses } from '../lib/utils';
import { hasRomanceGenre, loadSpotlightImages, rankSpotlightCandidates } from '../lib/spotlight';
import { Icon } from '../components/ui/icon';
import { MangaCard } from '../components/ui/manga-card';
import { Pagination } from '../components/ui/pagination';
import { Sidebar } from '../components/layout/sidebar';

function HomeContent({ initialCatalog }: { initialCatalog: Page<Manga> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useStore();

  const [page, setPage] = useState<number>(() => {
    return pageNumber(searchParams.get('page') || undefined);
  });

  const [items, setItems] = useState<Manga[]>(initialCatalog.items);
  const [total, setTotal] = useState(initialCatalog.total);
  const [loading, setLoading] = useState(initialCatalog.items.length === 0);
  const [error, setError] = useState('');

  // Spotlight State
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [autoPaused, setAutoPaused] = useState(false);
  const [rankedSpotlights, setRankedSpotlights] = useState<Manga[]>(initialCatalog.items.slice(0, 1));
  const [failedSpotlights, setFailedSpotlights] = useState<string[]>([]);
  const [latestSpotlights, setLatestSpotlights] = useState<Manga[]>(initialCatalog.items);
  const [trendingSpotlights, setTrendingSpotlights] = useState<Manga[]>([]);
  const [pool, setPool] = useState<Manga[]>([]);
  const [spotlightCovers, setSpotlightCovers] = useState<Record<string, string>>({});
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [following, setFollowing] = useState(false);

  // Featured Carousel State
  const [featured, setFeatured] = useState<Manga[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState(false);
  const [offset, setOffset] = useState(0);

  // Trending State
  const [trending, setTrending] = useState<Manga[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState(false);

  const bannerProbesRef = useRef(new Map<string, Promise<BannerImage | null>>());
  const descriptionRequestsRef = useRef(new Set<string>());
  const selectionEpochRef = useRef(0);
  const epochRef = useRef(0);
  const autoSlideTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sync page state from searchParams
  useEffect(() => {
    const p = pageNumber(searchParams.get('page') || undefined);
    setPage(p);
  }, [searchParams]);

  const spotlightPool = useMemo(() => {
    return rankedSpotlights.filter(m => !failedSpotlights.includes(m.id));
  }, [rankedSpotlights, failedSpotlights]);

  const currentSpotlight = useMemo(() => {
    if (!spotlightPool.length) return null;
    return spotlightPool[spotlightIndex % spotlightPool.length];
  }, [spotlightPool, spotlightIndex]);

  const probeBanner = (url: string): Promise<BannerImage | null> => {
    const cached = bannerProbesRef.current.get(url);
    if (cached) return cached;
    const pending = new Promise<BannerImage | null>(resolve => {
      const image = new Image();
      let finished = false;
      const finish = (result: BannerImage | null) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        image.onload = image.onerror = null;
        resolve(result);
      };
      const timer = setTimeout(() => finish(null), 5000);
      image.referrerPolicy = 'no-referrer';
      image.onload = () => finish({ url, width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => finish(null);
      image.src = url;
    });
    bannerProbesRef.current.set(url, pending);
    return pending;
  };

  // Rank and choose spotlight candidates
  useEffect(() => {
    const candidates = rankSpotlightCandidates([
      ...pool,
      ...trendingSpotlights,
      ...latestSpotlights
    ].filter(hasRomanceGenre)).slice(0, 8);

    const epoch = ++selectionEpochRef.current;
    if (!candidates.length) return;

    void (async () => {
      await loadSpotlightImages(
        candidates,
        url => probeBanner(url),
        (selected, images) => {
          if (epoch !== selectionEpochRef.current) return;
          const activeId = currentSpotlight?.id;
          setSpotlightCovers(Object.fromEntries(selected.map(m => [m.id, images[m.id].url])));
          setRankedSpotlights(selected);
          setSpotlightIndex(Math.max(0, selected.findIndex(m => m.id === activeId)));
        },
        () => epoch === selectionEpochRef.current
      );
    })();
  }, [pool, trendingSpotlights, latestSpotlights]);

  // Fetch description for active spotlight
  useEffect(() => {
    if (currentSpotlight && !descriptionRequestsRef.current.has(currentSpotlight.id)) {
      descriptionRequestsRef.current.add(currentSpotlight.id);
      void api
        .request<Manga>('/catalog/' + currentSpotlight.id, 'GET', undefined, true)
        .then(detail => {
          if (detail) {
            setDescriptions(prev => ({
              ...prev,
              [currentSpotlight.id]: detail.description || currentSpotlight.description
            }));
          }
        })
        .catch(() => { });
    }
  }, [currentSpotlight]);

  const spotlightDescription = (m: Manga) => {
    const raw = descriptions[m.id] || m.description;
    const cleaned = cleanDescription(raw);
    return cleaned === 'Chưa có mô tả cho bộ truyện này.'
      ? 'Khám phá câu chuyện mới, theo dõi chương mới nhất và tiếp tục hành trình cùng DokiHentai.'
      : cleaned;
  };

  // Auto-slide timer
  useEffect(() => {
    if (autoSlideTimerRef.current) clearInterval(autoSlideTimerRef.current);
    if (!autoPaused && spotlightPool.length > 1) {
      autoSlideTimerRef.current = setInterval(() => {
        if (!document.hidden) {
          setSpotlightIndex(prev => (prev + 1) % spotlightPool.length);
        }
      }, 2500);
    }
    return () => {
      if (autoSlideTimerRef.current) clearInterval(autoSlideTimerRef.current);
    };
  }, [autoPaused, spotlightPool.length]);

  const toggleAutoSlide = () => {
    setAutoPaused(prev => !prev);
  };

  const selectSpotlight = (index: number) => {
    setSpotlightIndex(index);
  };

  const rejectSpotlight = (id: string) => {
    setFailedSpotlights(prev => [...prev, id]);
    setSpotlightIndex(0);
  };

  const toggleFollow = async (m: Manga) => {
    if (!store.user) {
      router.push('/dang-nhap');
      return;
    }
    setFollowing(true);
    try {
      await store.follow(m);
    } catch (e) {
      store.notify(message(e));
    } finally {
      setFollowing(false);
    }
  };

  const savePosition = (id?: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('home_scroll_y', window.scrollY.toString());
      if (id) sessionStorage.setItem('home_manga_id', id);
    }
  };

  const restorePosition = () => {
    if (typeof window === 'undefined') return;
    const savedY = sessionStorage.getItem('home_scroll_y');
    const savedMangaId = sessionStorage.getItem('home_manga_id');
    if (!savedY && !savedMangaId) return;

    setTimeout(() => {
      let restored = false;
      if (savedMangaId) {
        const targetEl =
          document.getElementById('manga-card-' + savedMangaId) ||
          document.querySelector(`[data-manga-id="${savedMangaId}"]`);
        if (targetEl) {
          const rect = targetEl.getBoundingClientRect();
          const targetY = window.scrollY + rect.top - 80;
          window.scrollTo({ top: Math.max(0, targetY), behavior: 'instant' });
          targetEl.classList.add('last-viewed-highlight');
          setTimeout(() => targetEl.classList.remove('last-viewed-highlight'), 2500);
          restored = true;
        }
      }

      if (!restored && savedY) {
        const y = Number(savedY);
        if (!isNaN(y) && y > 0) {
          window.scrollTo({ top: y, behavior: 'instant' });
        }
      }

      sessionStorage.removeItem('home_scroll_y');
      sessionStorage.removeItem('home_manga_id');
    }, 60);
  };

  const prefetchPage = (p: number) => {
    if (p >= 1) {
      api.prefetch('/catalog/home?page=' + p);
    }
  };

  const prefetchAdjacent = (p: number, t: number) => {
    const max = Math.ceil(t / 30) || 999;
    if (p < max) prefetchPage(p + 1);
    if (p > 1) prefetchPage(p - 1);
    if (p + 1 < max) {
      setTimeout(() => {
        prefetchPage(p + 2);
      }, 400);
    }
  };

  // Load Main Home Catalog
  const loadMain = async (p: number) => {
    const path = '/catalog/home?page=' + p + '&pageSize=30';
    const n = ++epochRef.current;
    setError('');

    const cached = api.getCached<Page<Manga>>(path);
    if (cached && cached.items.length > 0) {
      setItems(cached.items);
      if (p === 1) setLatestSpotlights(cached.items);
      setTotal(cached.total);
      setLoading(false);
      prefetchAdjacent(p, cached.total);
      restorePosition();
      return;
    }

    setLoading(true);
    try {
      const r = await api.request<Page<Manga>>(path, 'GET', undefined, true);
      if (!r.items?.length && p === 1) {
        throw new Error('Chưa tải được danh sách truyện từ nguồn dữ liệu. Vui lòng thử lại.');
      }
      if (n === epochRef.current) {
        setItems(r.items || []);
        if (p === 1) setLatestSpotlights(r.items || []);
        setTotal(r.total || 0);
        prefetchAdjacent(p, r.total || 0);
        restorePosition();
      }
    } catch (e) {
      if (n === epochRef.current) setError(message(e));
    } finally {
      if (n === epochRef.current) setLoading(false);
    }
  };

  // Load Featured / Recommendations
  const loadFeatured = async () => {
    setFeaturedLoading(true);
    setFeaturedError(false);
    try {
      const r = await api.request<Page<Manga>>('/catalog/featured?limit=20', 'GET', undefined, true);
      if (r.items && r.items.length) {
        setPool(r.items);
        setFeatured(r.items.slice(0, 6));
      }
    } catch {
      setFeaturedError(true);
    } finally {
      setFeaturedLoading(false);
    }
  };

  // Load Trending
  const loadTrending = async () => {
    setTrendingLoading(true);
    setTrendingError(false);
    try {
      const result = await api.request<Page<Manga>>(
        '/catalog/search?sort=hot&pageSize=28&language=vi',
        'GET',
        undefined,
        true
      );
      if (result.items) {
        setTrendingSpotlights(result.items);
        setTrending(result.items.slice(0, 12));
      }
    } catch {
      setTrendingError(true);
    } finally {
      setTrendingLoading(false);
    }
  };

  useEffect(() => {
    // SSR can return an empty catalog when the hosting server cannot reach the
    // upstream. ApiClient also tries the browser fallback, so do not skip it.
    if (page !== initialCatalog.page || initialCatalog.items.length === 0) void loadMain(page);
  }, [page]);

  useEffect(() => {
    void loadFeatured();
    void loadTrending();
  }, []);

  const goPage = (p: number) => {
    prefetchPage(p);
    router.push(`/?page=${p}`);
    const section = document.querySelector('.main-content-section');
    const targetY = section ? window.scrollY + section.getBoundingClientRect().top - 96 : 0;
    window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
  };

  const coverFallback = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const image = event.currentTarget;
    if (!image.src.endsWith('/cover-placeholder.svg')) image.src = '/cover-placeholder.svg';
    image.classList.add('loaded');
  };

  return (
    <div className="home-page">
      <h1 className="sr-only">Đọc truyện tranh tiếng Việt tại DokiHentai</h1>
      {/* SPOTLIGHT SECTION */}
      <section className="doki-spotlight" aria-label="Truyện nổi bật">
        {currentSpotlight ? (
          <>
            <img
              className="spotlight-backdrop"
              src={spotlightCovers[currentSpotlight.id] || currentSpotlight.cover}
              alt=""
              fetchPriority="high"
              referrerPolicy="no-referrer"
              onError={() => rejectSpotlight(currentSpotlight.id)}
            />
            <div className="spotlight-shade"></div>
            <div className="spotlight-content">
              <span className="spotlight-eyebrow">
                <span></span> TÂM ĐIỂM HÔM NAY
              </span>
              <div className="spotlight-meta">
                <span className="spotlight-status">
                  {statuses[currentSpotlight.status] || 'Đang cập nhật'}
                </span>
                <span className="spotlight-rating">
                  <Icon name="star" /> {currentSpotlight.rating.toFixed(1)}
                </span>
                <span>
                  {currentSpotlight.country === 'ko'
                    ? 'Manhwa'
                    : ['cn', 'zh', 'zh-hk'].includes(currentSpotlight.country)
                      ? 'Manhua'
                      : 'Manga'}
                </span>
                <span>Romance</span>
                <span>DokiHentai</span>
              </div>
              <h2>{currentSpotlight.title}</h2>
              <p>{spotlightDescription(currentSpotlight)}</p>
              <div className="spotlight-actions">
                <Link prefetch={false} 
                  className="spotlight-read"
                  href={
                    currentSpotlight.chapters && currentSpotlight.chapters.length > 0
                      ? `/chuong/${currentSpotlight.chapters[0].id}`
                      : `/truyen-tranh/${currentSpotlight.id}`
                  }
                  onClick={() => savePosition(currentSpotlight.id)}
                >
                  <Icon name="play" /> Đọc ngay
                </Link>
                <Link prefetch={false} 
                  className="spotlight-detail"
                  href={`/truyen-tranh/${currentSpotlight.id}`}
                  onClick={() => savePosition(currentSpotlight.id)}
                >
                  <Icon name="info" /> Chi tiết
                </Link>
                <button
                  type="button"
                  className={`spotlight-save ${store.isFollowed(currentSpotlight.id) ? 'saved' : ''}`}
                  disabled={following}
                  aria-label={
                    store.isFollowed(currentSpotlight.id) ? 'Bỏ theo dõi truyện' : 'Theo dõi truyện'
                  }
                  aria-pressed={store.isFollowed(currentSpotlight.id)}
                  onClick={() => toggleFollow(currentSpotlight)}
                >
                  <Icon name="bookmark" />
                </button>
              </div>
              <div className="spotlight-controls">
                <button
                  type="button"
                  className="spotlight-pause"
                  aria-label={autoPaused ? 'Tiếp tục chuyển truyện' : 'Tạm dừng chuyển truyện'}
                  aria-pressed={autoPaused}
                  onClick={toggleAutoSlide}
                >
                  {autoPaused ? '▶' : 'Ⅱ'}
                </button>
                <div className="spotlight-dots" aria-label="Chọn truyện nổi bật">
                  {spotlightPool.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      className={spotlightIndex === i ? 'active' : ''}
                      aria-label={`Hiển thị truyện nổi bật ${i + 1}`}
                      aria-pressed={spotlightIndex === i}
                      onClick={() => selectSpotlight(i)}
                    ></button>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="spotlight-content">
            <span className="spotlight-eyebrow">KHÁM PHÁ DOKIHENTAI</span>
            <h2>
              Mỗi trang truyện,
              <br />
              một thế giới mới.
            </h2>
            <p>Khám phá Manga, Manhwa và Manhua. Những câu chuyện yêu thích luôn chờ bạn.</p>
            <Link prefetch={false} className="spotlight-read" href="/tim-truyen-nang-cao">
              <Icon name="compass" /> Khám phá ngay
            </Link>
          </div>
        )}
      </section>

      {/* MAIN COLUMNS */}
      <div className="columns">
        <section className="main-content-section">
          <div className="section-title">
            <div>
              <h2>Mới cập nhật</h2>
              <p className="section-subtitle">Truyện và các chương vừa được cập nhật</p>
            </div>
            <Link prefetch={false} 
              className="view-all-btn"
              href="/tim-truyen-nang-cao?sort=latest"
              title="Xem tất cả truyện mới cập nhật"
            >
              <span className="desktop-text">Xem tất cả</span>
              <span className="mobile-text">Tất cả</span>
              <Icon name="arrowRight" />
            </Link>
          </div>

          <div className="list-meta-bar">
            <span>Cập nhật mới nhất → cũ nhất</span>
            <span className="total-badge">{loading ? 'Đang tải truyện…' : error && !items.length ? 'Chưa tải được dữ liệu' : `${total.toLocaleString('vi')} truyện`}</span>
          </div>

          {error && (
            <div className="error-state glass-panel">
              <Icon name="info" />
              <h3>Chưa thể tải danh sách truyện</h3>
              <p>{error}</p>
              <button className="primary" onClick={() => loadMain(page)}>
                Thử lại
              </button>
            </div>
          )}

          <div className="manga-grid">
            {loading ? (
              Array.from({ length: 12 }, (_, i) => (
                <div key={i} className="skeleton skeleton-card"></div>
              ))
            ) : (
              items.map(m => <MangaCard key={m.id} manga={m} />)
            )}
          </div>

          {!loading && !error && (
            <Pagination
              page={page}
              total={total}
              size={30}
              change={goPage}
              hover={prefetchPage}
            />
          )}
        </section>
      </div>

      {/* RECOMMENDATIONS CAROUSEL */}
      <section className="recommendations">
        <div className="section-title">
          <div>
            <h2>Manhwa nổi bật</h2>
            <p className="section-subtitle">Những câu chuyện đáng để khám phá</p>
          </div>
          <Link prefetch={false} 
            className="view-all-manhwa-link"
            href="/tim-truyen-nang-cao?country=ko&sort=latest&language=vi"
          >
            <span className="desktop-text">Xem tất cả</span>
            <span className="mobile-text">Tất cả Manhwa</span>
            <Icon name="arrowRight" />
          </Link>
        </div>

        <div className="featured-carousel-track">
          {featured.map((m, i) => (
            <Link prefetch={false} 
              key={m.id}
              className="featured-card"
              id={`manga-card-${m.id}`}
              data-manga-id={m.id}
              href={`/truyen-tranh/${m.id}`}
              onClick={() => savePosition(m.id)}
              onMouseEnter={() => api.prefetchDetail(m.id)}
              onTouchStart={() => api.prefetchDetail(m.id)}
            >
              <img
                src={m.cover || '/cover-placeholder.svg'}
                alt={m.title}
                fetchPriority={i < 2 ? 'high' : 'auto'}
                loading={i < 2 ? 'eager' : 'lazy'}
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={e => (e.currentTarget as HTMLElement).classList.add('loaded')}
                onError={coverFallback}
              />
              <div className="featured-overlay">
                <span className="featured-badge">
                  <Icon name="star" /> {m.rating.toFixed(1)}
                </span>
                <h3>{m.title}</h3>
                <p className="featured-sub">
                  <Icon name="book" style={{ width: '12px', height: '12px' }} />
                  {m.chapters && m.chapters[0]
                    ? m.chapters[0].title
                    : m.author || 'Đang cập nhật'}
                </p>
              </div>
            </Link>
          ))}
          {featuredLoading &&
            [1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton featured-card"></div>)}
        </div>
        {featuredError && (
          <div className="featured-empty">
            <span>Đề cử đang tạm gián đoạn.</span>
            <button onClick={loadFeatured}>
              Tải lại <Icon name="arrowRight" />
            </button>
          </div>
        )}
      </section>

      {/* TRENDING SECTION */}
      <section className="home-trending" aria-label="Truyện thịnh hành">
        <div className="section-title">
          <div>
            <h2>Thịnh hành</h2>
            <p className="section-subtitle">Những bộ truyện được cộng đồng theo dõi nhiều nhất</p>
          </div>
          <Link prefetch={false} className="view-all-btn" href="/tim-truyen-nang-cao?sort=hot">
            Xem tất cả <Icon name="arrowRight" />
          </Link>
        </div>
        {trendingLoading ? (
          <div className="manga-grid">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton skeleton-card"></div>
            ))}
          </div>
        ) : trendingError ? (
          <div className="featured-empty">
            <span>Chưa thể tải truyện thịnh hành.</span>
            <button onClick={loadTrending}>
              Thử lại <Icon name="arrowRight" />
            </button>
          </div>
        ) : (
          <div className="manga-grid">
            {trending.map(m => (
              <MangaCard key={m.id} manga={m} idPrefix="trending-" />
            ))}
          </div>
        )}
      </section>

      {/* COMMUNITY SIDEBAR */}
      <section className="home-community" aria-label="Cộng đồng đọc truyện">
        <Sidebar />
      </section>
    </div>
  );
}

export default function HomePage({ initialCatalog }: { initialCatalog: Page<Manga> }) {
  return (
    <Suspense fallback={<div className="loading-panel"><div className="search-spinner"></div></div>}>
      <HomeContent initialCatalog={initialCatalog} />
    </Suspense>
  );
}
