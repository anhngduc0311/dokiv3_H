'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Reader as ReaderData, ZoomLevel, SpeedLevel } from '../../../types';
import { api } from '../../../lib/api';
import { useStore } from '../../../contexts/store-context';
import { message, proxyImage } from '../../../lib/utils';
import { readerBannerBounds } from '../../../lib/reader-banners';
import { Icon } from '../../../components/ui/icon';

const ZOOM_LEVELS: ZoomLevel[] = [
  { label: '50%', width: 500 },
  { label: '75%', width: 700 },
  { label: '100%', width: 900 },
  { label: '125%', width: 1150 },
  { label: '150%', width: 1400 },
  { label: '200%', width: 1800 },
  { label: 'Tràn màn', width: 0 }
];

const AUTO_SCROLL_SPEEDS: SpeedLevel[] = [
  { label: '1x (Chậm)', speed: 1 },
  { label: '2x (Vừa)', speed: 2 },
  { label: '3x (Nhanh)', speed: 3 },
  { label: '4x (Rất nhanh)', speed: 4 }
];

const SPEED_PPS: Record<number, number> = {
  1: 45,
  2: 85,
  3: 140,
  4: 220
};

function ReaderContent() {
  const params = useParams();
  const router = useRouter();
  const store = useStore();

  const id = String(params?.id || '');

  const [data, setData] = useState<ReaderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [loaded, setLoaded] = useState<Set<number>>(new Set());
  const [fallbackUrls, setFallbackUrls] = useState<Map<number, string>>(new Map());

  // Zoom Width State
  const [zoomWidth, setZoomWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const savedWidth = localStorage.getItem('td_reader_zoom_width');
      if (savedWidth !== null) {
        const w = parseInt(savedWidth, 10);
        if (!isNaN(w)) return w;
      }
    }
    return store.settings.width || 900;
  });
  const [showZoomMenu, setShowZoomMenu] = useState(false);

  // Reading Mode State
  const [mode, setMode] = useState<'vertical' | 'single'>(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('td_reader_mode') as 'vertical' | 'single';
      if (savedMode === 'vertical' || savedMode === 'single') return savedMode;
    }
    return 'vertical';
  });
  const [singlePageIndex, setSinglePageIndex] = useState(0);

  // Auto-scroll State
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [autoScrollSpeed, setAutoScrollSpeed] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedSpeed = localStorage.getItem('td_reader_autoscroll_speed');
      if (savedSpeed !== null) {
        const s = parseInt(savedSpeed, 10);
        if (!isNaN(s) && s >= 1 && s <= 4) return s;
      }
    }
    return 2;
  });
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Smart Header Auto-hide & Zen Mode
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('td_reader_pinned') === 'true';
    }
    return false;
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Report Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportErrorType, setReportErrorType] = useState('IMAGE_FAILED');
  const [reportDescription, setReportDescription] = useState('');

  // Refs for tracking
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const preloadedUrlsRef = useRef<Set<string>>(new Set());
  const cleanedPagesRef = useRef<Map<string, string>>(new Map());
  const preloadedNextIdRef = useRef('');
  const lastScrollYRef = useRef(0);
  const epochRef = useRef(0);

  const autoScrollAnimFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef(0);
  const scrollSubpixelRef = useRef(0);
  const isAutoScrollingRef = useRef(isAutoScrolling);
  isAutoScrollingRef.current = isAutoScrolling;
  const autoScrollSpeedRef = useRef(autoScrollSpeed);
  autoScrollSpeedRef.current = autoScrollSpeed;

  const scrollToTopInstant = () => {
    if (typeof window === 'undefined') return;
    try {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
      }
    } catch {}

    const docEl = document.documentElement;
    const prevScrollBehavior = docEl ? docEl.style.scrollBehavior : '';
    if (docEl) docEl.style.scrollBehavior = 'auto';

    const performScroll = () => {
      window.scrollTo(0, 0);
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      } catch {}
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
      const el = document.querySelector('.reader-container');
      if (el) el.scrollTop = 0;
    };

    performScroll();
    requestAnimationFrame(() => {
      performScroll();
      if (docEl) docEl.style.scrollBehavior = prevScrollBehavior;
    });

    setTimeout(performScroll, 30);
    setTimeout(performScroll, 100);
    setTimeout(performScroll, 250);
  };

  const stopAutoScroll = () => {
    setIsAutoScrolling(false);
    if (autoScrollAnimFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollAnimFrameRef.current);
      autoScrollAnimFrameRef.current = null;
    }
  };

  const startAutoScroll = () => {
    if (isAutoScrollingRef.current) return;
    setIsAutoScrolling(true);
    scrollSubpixelRef.current = 0;
    lastFrameTimeRef.current = performance.now();

    const scrollLoop = (now: number) => {
      if (!isAutoScrollingRef.current) return;

      const deltaMs = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      if (deltaMs > 0 && deltaMs < 200) {
        const pps = SPEED_PPS[autoScrollSpeedRef.current] || 85;
        const pixelsToScroll = (pps * deltaMs) / 1000;
        scrollSubpixelRef.current += pixelsToScroll;

        const intPixels = Math.floor(scrollSubpixelRef.current);
        if (intPixels > 0) {
          window.scrollBy(0, intPixels);
          scrollSubpixelRef.current -= intPixels;
        }
      }

      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (window.scrollY >= maxScroll - 5) {
        stopAutoScroll();
        store.notify('Đã cuộn đến cuối chương truyện.');
        return;
      }

      autoScrollAnimFrameRef.current = requestAnimationFrame(scrollLoop);
    };

    autoScrollAnimFrameRef.current = requestAnimationFrame(scrollLoop);
  };

  const toggleAutoScroll = () => {
    if (isAutoScrolling) {
      stopAutoScroll();
    } else {
      startAutoScroll();
    }
  };

  const selectSpeed = (speed: number) => {
    setAutoScrollSpeed(speed);
    setShowSpeedMenu(false);
    localStorage.setItem('td_reader_autoscroll_speed', speed.toString());
  };

  // Fullscreen change listener
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      stopAutoScroll();
    };
  }, []);

  const rawPages = (currentData: ReaderData | null): string[] => {
    if (!currentData) return [];
    const list =
      store.settings.dataSaver && currentData.dataSaverPages.length
        ? currentData.dataSaverPages
        : currentData.pages;
    return list.map(proxyImage);
  };

  const pagesList = rawPages(data);

  const pageUrl = (url: string, i: number): string => {
    return cleanedPagesRef.current.get(url) ?? fallbackUrls.get(i) ?? url;
  };

  const preloadUpcoming = (startIndex: number, count: number, currentPages: string[]) => {
    for (let i = startIndex; i < Math.min(currentPages.length, startIndex + count); i++) {
      const url = pageUrl(currentPages[i], i);
      if (url && !preloadedUrlsRef.current.has(url)) {
        preloadedUrlsRef.current.add(url);
        const img = new Image();
        img.src = url;
      }
    }
  };

  const position = (currentData: ReaderData | null) => {
    return currentData?.navigation.findIndex(c => c.id === id || c.id === currentData.chapter.id) ?? -1;
  };

  const previous = (currentData: ReaderData | null) => {
    const pos = position(currentData);
    return pos > 0 ? currentData?.navigation[pos - 1] : undefined;
  };

  const next = (currentData: ReaderData | null) => {
    const pos = position(currentData);
    const nav = currentData?.navigation;
    return nav && pos >= 0 && pos < nav.length - 1 ? nav[pos + 1] : undefined;
  };

  const preloadNextChapter = async (currentData: ReaderData | null) => {
    const nextChap = next(currentData);
    if (!nextChap || preloadedNextIdRef.current === nextChap.id) return;
    preloadedNextIdRef.current = nextChap.id;
    try {
      const r = await api.request<ReaderData>('/chapters/' + nextChap.id, 'GET', undefined, true);
      if (!r) return;
      const list =
        (store.settings.dataSaver && r.dataSaverPages?.length ? r.dataSaverPages : r.pages) || [];
      list.slice(0, 3).forEach(url => {
        const p = proxyImage(url);
        if (!preloadedUrlsRef.current.has(p)) {
          preloadedUrlsRef.current.add(p);
          const img = new Image();
          img.src = p;
        }
      });
    } catch {}
  };

  const onLoaded = (i: number, event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const image = event.currentTarget;
    const url = pagesList[i];
    if (url && !cleanedPagesRef.current.has(url) && image.naturalWidth > 0) {
      try {
        const probe = document.createElement('canvas');
        probe.width = probe.height = 12;
        const ctx = probe.getContext('2d', { willReadFrequently: true })!;
        ctx.imageSmoothingQuality = 'high';
        const { top, bottom } = readerBannerBounds(
          image.naturalWidth,
          image.naturalHeight,
          (y, height) => {
            ctx.drawImage(image, 0, y, image.naturalWidth, height, 0, 0, 12, 12);
            return ctx.getImageData(0, 0, 12, 12).data;
          }
        );
        if (top > 0 || bottom < image.naturalHeight) {
          const output = document.createElement('canvas');
          output.width = image.naturalWidth;
          output.height = bottom - top;
          output
            .getContext('2d')!
            .drawImage(
              image,
              0,
              top,
              output.width,
              output.height,
              0,
              0,
              output.width,
              output.height
            );
          cleanedPagesRef.current.set(url, output.toDataURL('image/jpeg', 0.95));
          setLoaded(prev => {
            const nextSet = new Set(prev);
            nextSet.delete(i);
            return nextSet;
          });
          return;
        }
      } catch {}
    }
    setLoaded(prev => new Set(prev).add(i));
    if (i === 0 && typeof window !== 'undefined' && window.scrollY > 40) {
      scrollToTopInstant();
    }
    preloadUpcoming(i + 1, 3, pagesList);
    const total = pagesList.length;
    if (total > 0 && i >= total - 4) {
      void preloadNextChapter(data);
    }
  };

  const imageError = (i: number) => {
    const current = pageUrl(pagesList[i], i);
    if (!current.startsWith('/api/catalog/image-proxy')) {
      const fallback = '/api/catalog/image-proxy?url=' + encodeURIComponent(current);
      setFallbackUrls(prev => new Map(prev).set(i, fallback));
      return;
    }
    setFailed(prev => new Set(prev).add(i));
  };

  const retry = (i: number) => {
    setFallbackUrls(prev => {
      const n = new Map(prev);
      n.delete(i);
      return n;
    });
    setFailed(prev => {
      const n = new Set(prev);
      n.delete(i);
      return n;
    });
    setLoaded(prev => {
      const n = new Set(prev);
      n.delete(i);
      return n;
    });
  };

  const loadChapter = async () => {
    const n = ++epochRef.current;
    setData(null);
    setLoading(true);
    setError('');
    setFailed(new Set());
    setLoaded(new Set());
    setFallbackUrls(new Map());
    preloadedUrlsRef.current.clear();
    cleanedPagesRef.current.clear();
    preloadedNextIdRef.current = '';
    scrollToTopInstant();

    try {
      const r = await api.request<ReaderData>('/chapters/' + id, 'GET', undefined, true);
      if (n !== epochRef.current) return;
      setData(r);
      void store.record(r).catch(() => {});
      scrollToTopInstant();
      const loadedPages = rawPages(r);
      preloadUpcoming(0, 4, loadedPages);
    } catch (e) {
      if (n === epochRef.current) setError(message(e));
    } finally {
      if (n === epochRef.current) setLoading(false);
      scrollToTopInstant();
    }
  };

  useEffect(() => {
    if (!id) return;
    setSinglePageIndex(0);
    stopAutoScroll();
    scrollToTopInstant();
    void loadChapter();
  }, [id]);

  const go = (targetId: string) => {
    scrollToTopInstant();
    router.push(`/chuong/${targetId}`);
  };

  const move = (direction: number) => {
    const c = direction < 0 ? previous(data) : next(data);
    if (c) {
      scrollToTopInstant();
      go(c.id);
    }
  };

  const getZoomLabel = () => {
    const match = ZOOM_LEVELS.find(l => l.width === zoomWidth);
    return match ? match.label : `${zoomWidth}px`;
  };

  const selectZoomWidth = (width: number) => {
    setZoomWidth(width);
    setShowZoomMenu(false);
    localStorage.setItem('td_reader_zoom_width', width.toString());
    store.saveSettings({ ...store.settings, width: width || 900 });
  };

  const zoomIn = () => {
    const widths = ZOOM_LEVELS.map(l => l.width);
    const curIdx = widths.indexOf(zoomWidth);
    if (curIdx >= 0 && curIdx < widths.length - 1) {
      selectZoomWidth(widths[curIdx + 1]);
    } else if (curIdx === -1) {
      selectZoomWidth(900);
    }
  };

  const zoomOut = () => {
    const widths = ZOOM_LEVELS.map(l => l.width);
    const curIdx = widths.indexOf(zoomWidth);
    if (curIdx > 0) {
      selectZoomWidth(widths[curIdx - 1]);
    } else if (curIdx === -1) {
      selectZoomWidth(700);
    }
  };

  const toggleMode = () => {
    const nextMode = mode === 'vertical' ? 'single' : 'vertical';
    setMode(nextMode);
    localStorage.setItem('td_reader_mode', nextMode);
    if (nextMode === 'single') {
      stopAutoScroll();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevSinglePage = () => {
    if (singlePageIndex > 0) {
      setSinglePageIndex(prev => prev - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (previous(data)) {
      move(-1);
    }
  };

  const nextSinglePage = () => {
    const total = pagesList.length;
    if (singlePageIndex < total - 1) {
      setSinglePageIndex(prev => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (next(data)) {
      move(1);
    }
  };

  const setSinglePage = (idx: number) => {
    setSinglePageIndex(Number(idx));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (mode !== 'single' || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = e.changedTouches[0].clientY - touchStartYRef.current;
    if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
      if (deltaX > 0) {
        prevSinglePage();
      } else {
        nextSinglePage();
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  };

  const onReaderClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        'button, select, input, a, textarea, .glass-panel, .header-menu, .report-modal-dialog, .reader-mobile-floating-bar'
      )
    ) {
      return;
    }
    setShowZoomMenu(false);
    setShowSpeedMenu(false);
    if (!isPinned) {
      setIsHeaderHidden(prev => !prev);
    }
  };

  const submitReport = () => {
    setShowReportModal(false);
    store.notify('Đã gửi báo cáo lỗi chương truyện. Cảm ơn bạn!');
    setReportDescription('');
  };

  // Scroll handler for smart header and back-to-top
  useEffect(() => {
    const onScroll = () => {
      const currentScrollY = window.scrollY;
      setShowScrollTop(currentScrollY > 400);

      if (!isPinned && !isHeaderHovered) {
        if (currentScrollY > 60 && currentScrollY > lastScrollYRef.current + 8) {
          setIsHeaderHidden(true);
          setShowZoomMenu(false);
          setShowSpeedMenu(false);
        } else if (currentScrollY < lastScrollYRef.current - 8 || currentScrollY <= 20) {
          setIsHeaderHidden(false);
        }
      }
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isPinned, isHeaderHovered]);

  // Keyboard shortcut listener
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        if (mode === 'single') prevSinglePage();
        else move(-1);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        if (mode === 'single') nextSinglePage();
        else move(1);
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-' || e.key === '_') {
        zoomOut();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (mode === 'single') nextSinglePage();
        else toggleAutoScroll();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'Escape') {
        setShowZoomMenu(false);
        setShowSpeedMenu(false);
        setShowReportModal(false);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const prevChap = previous(data);
  const nextChap = next(data);
  const isMinZoom = zoomWidth === 500;
  const isMaxZoom = zoomWidth === 0;

  return (
    <div
      className="reader-container"
      onClick={onReaderClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {loading && (
        <div className="loading-panel" role="status">
          <div className="search-spinner" />
          <p>Đang tải chương truyện…</p>
        </div>
      )}
      {error && (
        <div className="error-state glass-panel">
          <Icon name="info" />
          <h2>Chưa thể mở chương</h2>
          <p>{error}</p>
          <button className="primary" onClick={loadChapter}>
            Thử lại
          </button>
          <Link href="/">Về trang chủ</Link>
        </div>
      )}

      {data && (
        <>
          {/* 1. FLOATING TOP HEADER BAR */}
          <header
            className={`reader-header glass-panel ${isHeaderHidden && !isPinned ? 'is-hidden' : ''}`}
            onMouseEnter={() => setIsHeaderHovered(true)}
            onMouseLeave={() => setIsHeaderHovered(false)}
          >
            <div className="reader-header-inner">
              {/* Left: Back Button & Title Meta */}
              <div className="reader-title-box">
                <Link
                  href={`/truyen-tranh/${data.manga.id}`}
                  className="btn-back-comic"
                  title="Về trang thông tin truyện"
                  aria-label="Về trang truyện"
                >
                  <Icon name="arrowLeft" />
                </Link>
                <div className="title-meta">
                  <h2 className="comic-name">
                    <Link href={`/truyen-tranh/${data.manga.id}`} title={data.manga.title}>
                      {data.manga.title}
                    </Link>
                  </h2>
                  <span className="chap-badge">{data.chapter.title}</span>
                </div>
              </div>

              {/* Center: Chapter Navigation Selector */}
              <div className="reader-nav-controls" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn-nav-chap"
                  disabled={!prevChap}
                  onClick={() => {
                    scrollToTopInstant();
                    move(-1);
                  }}
                  title="Chương trước (Phím ←)"
                >
                  <Icon name="arrowLeft" style={{ width: 14, height: 14 }} />
                  <span>Trước</span>
                </button>

                <div className="chap-select-wrap">
                  <select
                    aria-label="Chọn chương"
                    value={data.chapter.id}
                    onChange={e => {
                      scrollToTopInstant();
                      go(e.target.value);
                    }}
                  >
                    {data.navigation.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron" className="select-arrow" />
                </div>

                <button
                  type="button"
                  className="btn-nav-chap btn-nav-next"
                  disabled={!nextChap}
                  onClick={() => {
                    scrollToTopInstant();
                    move(1);
                  }}
                  title="Chương sau (Phím →)"
                >
                  <span>Sau</span>
                  <Icon name="arrowRight" style={{ width: 14, height: 14 }} />
                </button>
              </div>

              {/* Right: Reader Tools */}
              <div className="reader-tools" onClick={e => e.stopPropagation()}>
                {/* Reading Mode Toggle */}
                <div className="mode-dropdown-wrap">
                  <button
                    type="button"
                    className="tool-btn btn-mode-toggle"
                    onClick={toggleMode}
                    title={
                      mode === 'vertical'
                        ? 'Đang cuộn dọc (Click đổi sang từng trang)'
                        : 'Đang từng trang (Click đổi sang cuộn dọc)'
                    }
                  >
                    <Icon
                      name={mode === 'vertical' ? 'scroll' : 'book'}
                      style={{ color: '#f5a000', width: 16, height: 16 }}
                    />
                    <span className="tool-text">
                      {mode === 'vertical' ? 'Cuộn dọc' : 'Từng trang'}
                    </span>
                  </button>
                </div>

                {/* Zoom Controls Group (Desktop) */}
                <div className="zoom-header-group">
                  <button
                    type="button"
                    className="tool-btn btn-zoom-action"
                    onClick={zoomOut}
                    disabled={isMinZoom}
                    title="Thu nhỏ (Phím -)"
                    aria-label="Thu nhỏ"
                  >
                    <Icon name="zoomOut" style={{ width: 14, height: 14 }} />
                  </button>

                  <div className="zoom-dropdown-wrap">
                    <button
                      type="button"
                      className="tool-btn btn-zoom-label"
                      onClick={() => {
                        setShowZoomMenu(!showZoomMenu);
                        setShowSpeedMenu(false);
                      }}
                      title={`Độ thu phóng: ${getZoomLabel()}`}
                    >
                      <span>{getZoomLabel()}</span>
                      <Icon
                        name="chevron"
                        style={{ transform: 'rotate(90deg)', width: 10, height: 10 }}
                      />
                    </button>

                    {showZoomMenu && (
                      <div className="zoom-levels-menu header-menu glass-panel">
                        <div className="menu-header">
                          <Icon name="search" style={{ width: 14, height: 14 }} /> Thu phóng trang
                        </div>
                        {ZOOM_LEVELS.map(lvl => (
                          <button
                            key={lvl.width}
                            type="button"
                            className={`menu-item-btn ${zoomWidth === lvl.width ? 'active' : ''}`}
                            onClick={() => selectZoomWidth(lvl.width)}
                          >
                            <span>{lvl.label}</span>
                            {zoomWidth === lvl.width && (
                              <Icon
                                name="check"
                                style={{ width: 14, height: 14, color: '#f5a000' }}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className="tool-btn btn-zoom-action"
                    onClick={zoomIn}
                    disabled={isMaxZoom}
                    title="Phóng to (Phím +)"
                    aria-label="Phóng to"
                  >
                    <Icon name="zoomIn" style={{ width: 14, height: 14 }} />
                  </button>
                </div>

                {/* Auto Scroll Group */}
                {mode === 'vertical' && (
                  <div className={`autoscroll-header-group ${isAutoScrolling ? 'is-active' : ''}`}>
                    <button
                      type="button"
                      className={`tool-btn btn-as-action ${isAutoScrolling ? 'active' : ''}`}
                      onClick={toggleAutoScroll}
                      title={
                        isAutoScrolling
                          ? 'Tạm dừng tự cuộn (Phím Space)'
                          : 'Bật tự động cuộn (Phím Space)'
                      }
                    >
                      <Icon
                        name={isAutoScrolling ? 'pause' : 'play'}
                        style={{ width: 13, height: 13 }}
                      />
                    </button>

                    <div className="as-speed-wrap">
                      <button
                        type="button"
                        className="tool-btn btn-as-speed"
                        onClick={() => {
                          setShowSpeedMenu(!showSpeedMenu);
                          setShowZoomMenu(false);
                        }}
                        title={`Tốc độ tự cuộn: ${autoScrollSpeed}x`}
                      >
                        <span>{autoScrollSpeed}x</span>
                        <Icon
                          name="chevron"
                          style={{ transform: 'rotate(90deg)', width: 10, height: 10 }}
                        />
                      </button>

                      {showSpeedMenu && (
                        <div className="as-speed-menu header-menu glass-panel">
                          <div className="menu-header">
                            <Icon name="clock" style={{ width: 14, height: 14 }} /> Tốc độ cuộn
                          </div>
                          {AUTO_SCROLL_SPEEDS.map(lvl => (
                            <button
                              key={lvl.speed}
                              type="button"
                              className={`menu-item-btn ${
                                autoScrollSpeed === lvl.speed ? 'active' : ''
                              }`}
                              onClick={() => selectSpeed(lvl.speed)}
                            >
                              <span>{lvl.label}</span>
                              {autoScrollSpeed === lvl.speed && (
                                <Icon
                                  name="check"
                                  style={{ width: 14, height: 14, color: '#f5a000' }}
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Fullscreen Toggle Button */}
                <button
                  type="button"
                  className="tool-btn btn-fullscreen"
                  onClick={toggleFullscreen}
                  title={
                    isFullscreen
                      ? 'Thoát toàn màn hình (Phím F)'
                      : 'Toàn màn hình (Phím F)'
                  }
                  aria-label="Toàn màn hình"
                >
                  <Icon name="fullscreen" style={{ width: 15, height: 15 }} />
                </button>

                {/* Report Button */}
                <button
                  type="button"
                  className="tool-btn btn-report"
                  onClick={() => setShowReportModal(true)}
                  title="Báo lỗi chương truyện"
                  aria-label="Báo lỗi"
                >
                  <Icon name="flag" style={{ width: 15, height: 15 }} />
                </button>
              </div>
            </div>
          </header>

          {/* External Source Notice */}
          {data.externalUrl && (
            <div className="external-source-card glass-panel">
              <p>Chương này được phát hành chính thức trên trang của nhóm dịch.</p>
              <a
                className="primary"
                href={data.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                Đọc tại nguồn gốc ↗
              </a>
            </div>
          )}

          {/* 2. MAIN READING AREA */}
          {/* Mode 1: Continuous Vertical Scroll */}
          {mode === 'vertical' && (
            <div
              className="reader-pages-vertical"
              style={{ maxWidth: zoomWidth > 0 ? `${zoomWidth}px` : '100%' }}
            >
              {pagesList.map((url, i) => (
                <div key={url} className="reader-page-item" id={`page-${i + 1}`}>
                  {failed.has(i) ? (
                    <div className="image-error-card">
                      <Icon
                        name="info"
                        style={{
                          color: '#ef4444',
                          width: 28,
                          height: 28,
                          marginBottom: 8
                        }}
                      />
                      <p>Không tải được trang {i + 1} từ máy chủ ảnh.</p>
                      <button className="secondary" onClick={() => retry(i)}>
                        Tải lại trang {i + 1}
                      </button>
                    </div>
                  ) : (
                    <img
                      src={pageUrl(url, i)}
                      alt={`Trang ${i + 1} — ${data.chapter.title}`}
                      loading={i < 3 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={i === 0 ? 'high' : 'auto'}
                      referrerPolicy="no-referrer"
                      style={{ visibility: loaded.has(i) ? undefined : 'hidden' }}
                      onLoad={e => onLoaded(i, e)}
                      onError={() => imageError(i)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Mode 2: Single Page Reader */}
          {mode === 'single' && (
            <div
              className="reader-single-page-wrap"
              style={{ maxWidth: zoomWidth > 0 ? `${zoomWidth}px` : '100%' }}
            >
              {pagesList.length > 0 && (
                <div className="single-page-display">
                  {/* Clickable zones */}
                  <div
                    className="click-zone-prev"
                    onClick={prevSinglePage}
                    title="Trang trước (←)"
                  ></div>
                  <div
                    className="click-zone-next"
                    onClick={nextSinglePage}
                    title="Trang sau (→)"
                  ></div>

                  {failed.has(singlePageIndex) ? (
                    <div className="image-error-card">
                      <Icon
                        name="info"
                        style={{
                          color: '#ef4444',
                          width: 28,
                          height: 28,
                          marginBottom: 8
                        }}
                      />
                      <p>Không tải được trang {singlePageIndex + 1}.</p>
                      <button className="secondary" onClick={() => retry(singlePageIndex)}>
                        Thử lại
                      </button>
                    </div>
                  ) : (
                    <img
                      src={pageUrl(pagesList[singlePageIndex], singlePageIndex)}
                      alt={`Trang ${singlePageIndex + 1}`}
                      decoding="async"
                      style={{
                        visibility: loaded.has(singlePageIndex) ? undefined : 'hidden'
                      }}
                      onLoad={e => onLoaded(singlePageIndex, e)}
                      onError={() => imageError(singlePageIndex)}
                    />
                  )}
                </div>
              )}

              {/* Single Page Controls Bar */}
              <div className="single-page-bar glass-panel" onClick={e => e.stopPropagation()}>
                <button
                  type="button"
                  className="btn-page-nav"
                  disabled={singlePageIndex === 0 && !prevChap}
                  onClick={prevSinglePage}
                >
                  <Icon name="arrowLeft" style={{ width: 14, height: 14 }} /> Trang trước
                </button>
                <div className="page-counter-select">
                  <select
                    value={singlePageIndex}
                    onChange={e => setSinglePage(Number(e.target.value))}
                  >
                    {pagesList.map((_, idx) => (
                      <option key={idx} value={idx}>
                        Trang {idx + 1} / {pagesList.length}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="btn-page-nav"
                  disabled={singlePageIndex === pagesList.length - 1 && !nextChap}
                  onClick={nextSinglePage}
                >
                  Trang sau <Icon name="arrowRight" style={{ width: 14, height: 14 }} />
                </button>
              </div>
            </div>
          )}

          {/* 3. BOTTOM CHAPTER NAVIGATION & FOOTER */}
          <div className="reader-bottom-nav glass-panel">
            <h2>
              Bạn đã đọc hết <span>{data.chapter.title}</span>
            </h2>
            <p className="chapter-info-sub">
              {data.manga.title && data.manga.title !== 'Null Meta' && `${data.manga.title} · `}
              {pagesList.length} trang
            </p>

            <div className="bottom-nav-row">
              <button
                type="button"
                className="btn-nav-chap"
                disabled={!prevChap}
                onClick={() => {
                  scrollToTopInstant();
                  move(-1);
                }}
              >
                <Icon name="arrowLeft" style={{ width: 14, height: 14 }} />{' '}
                <span>Chương trước</span>
              </button>

              <div className="chap-select-wrap">
                <select
                  aria-label="Chọn chương kết thúc"
                  value={data.chapter.id}
                  onChange={e => {
                    scrollToTopInstant();
                    go(e.target.value);
                  }}
                >
                  {data.navigation.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
                <Icon name="chevron" className="select-arrow" />
              </div>

              <button
                type="button"
                className="btn-nav-chap btn-nav-next primary"
                disabled={!nextChap}
                onClick={() => {
                  scrollToTopInstant();
                  move(1);
                }}
              >
                <span>Chương sau</span>{' '}
                <Icon name="arrowRight" style={{ width: 14, height: 14 }} />
              </button>
            </div>

            <div className="bottom-action-links">
              <Link href={`/truyen-tranh/${data.manga.id}`} className="bottom-action-btn">
                <Icon name="book" style={{ width: 15, height: 15 }} /> Về trang thông tin truyện
              </Link>
              <button
                type="button"
                className="bottom-action-btn"
                onClick={() => setShowReportModal(true)}
              >
                <Icon name="flag" style={{ width: 15, height: 15 }} /> Báo lỗi chương này
              </button>
            </div>
          </div>

          {/* 4. MOBILE FLOATING QUICK BAR */}
          <div
            className={`reader-mobile-floating-bar glass-panel ${
              isHeaderHidden && !isPinned ? 'is-hidden' : ''
            }`}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="btn-float-action"
              disabled={!prevChap}
              onClick={() => {
                scrollToTopInstant();
                move(-1);
              }}
              aria-label="Chương trước"
            >
              <Icon name="arrowLeft" />
            </button>

            <div className="float-chap-info">
              <select
                aria-label="Chọn chương nhanh"
                value={data.chapter.id}
                onChange={e => {
                  scrollToTopInstant();
                  go(e.target.value);
                }}
              >
                {data.navigation.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="btn-float-action btn-float-next"
              disabled={!nextChap}
              onClick={() => {
                scrollToTopInstant();
                move(1);
              }}
              aria-label="Chương sau"
            >
              <Icon name="arrowRight" />
            </button>
          </div>

          {/* 5. FLOATING SCROLL TO TOP BUTTON */}
          {showScrollTop && (
            <button
              type="button"
              className="btn-scroll-top glass-panel"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              title="Cuộn lên đầu trang"
              aria-label="Lên đầu trang"
            >
              <Icon name="arrowUp" style={{ width: 18, height: 18 }} />
            </button>
          )}

          {/* 6. REPORT MODAL POPUP */}
          {showReportModal && (
            <div className="report-modal-backdrop" onClick={() => setShowReportModal(false)}>
              <div className="report-modal-dialog glass-panel" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>
                    <Icon name="flag" style={{ color: '#f5a000' }} /> Báo lỗi chương truyện
                  </h3>
                  <button
                    type="button"
                    className="btn-close-modal"
                    onClick={() => setShowReportModal(false)}
                    aria-label="Đóng"
                  >
                    <Icon name="close" />
                  </button>
                </div>

                <div className="modal-body">
                  <p className="modal-sub">
                    Truyện: <strong>{data.manga.title}</strong> — {data.chapter.title}
                  </p>

                  <label className="form-label">Loại sự cố:</label>
                  <div className="report-radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="reportType"
                        checked={reportErrorType === 'IMAGE_FAILED'}
                        onChange={() => setReportErrorType('IMAGE_FAILED')}
                      />
                      <span>Ảnh bị lỗi / không tải được</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="reportType"
                        checked={reportErrorType === 'WRONG_CHAPTER'}
                        onChange={() => setReportErrorType('WRONG_CHAPTER')}
                      />
                      <span>Chương bị sai / trùng lặp nội dung</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="reportType"
                        checked={reportErrorType === 'BAD_TRANSLATION'}
                        onChange={() => setReportErrorType('BAD_TRANSLATION')}
                      />
                      <span>Lỗi dịch thuật / chữ bị mờ</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="reportType"
                        checked={reportErrorType === 'OTHER'}
                        onChange={() => setReportErrorType('OTHER')}
                      />
                      <span>Vấn đề khác</span>
                    </label>
                  </div>

                  <label className="form-label" style={{ marginTop: 14 }}>
                    Mô tả thêm (tùy chọn):
                  </label>
                  <textarea
                    className="report-textarea"
                    value={reportDescription}
                    onChange={e => setReportDescription(e.target.value)}
                    placeholder="Ghi chú thêm ví dụ: trang số 5 bị mờ hoặc load lâu..."
                  ></textarea>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn-cancel"
                    onClick={() => setShowReportModal(false)}
                  >
                    Hủy
                  </button>
                  <button type="button" className="btn-submit primary" onClick={submitReport}>
                    Gửi báo cáo
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function ReaderPage() {
  return (
    <Suspense fallback={<div className="loading-panel"><div className="search-spinner"></div></div>}>
      <ReaderContent />
    </Suspense>
  );
}
