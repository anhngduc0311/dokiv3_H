'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { pageNumber } from '@/lib/seo';
import { Manga, Page } from '../../types';
import { api } from '../../lib/api';
import { useStore } from '../../contexts/store-context';
import { message } from '../../lib/utils';
import { Icon } from '../../components/ui/icon';
import { MangaCard } from '../../components/ui/manga-card';
import { Pagination } from '../../components/ui/pagination';

function SearchContent({ initialCatalog }: { initialCatalog: Page<Manga> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useStore();

  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<Manga[]>(initialCatalog.items);
  const [total, setTotal] = useState(initialCatalog.total);
  const [page, setPage] = useState(initialCatalog.page);
  const [pageSize] = useState(24);
  const [loading, setLoading] = useState(initialCatalog.items.length === 0);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const epochRef = useRef(0);
  const initialRequest = useRef(initialCatalog.items.length > 0);

  const getDefaults = () => ({
    source: searchParams.get('source') || '',
    q: searchParams.get('q') || '',
    author: searchParams.get('author') || '',
    genre: searchParams.get('genre') || '',
    status: searchParams.get('status') || '',
    country: searchParams.get('country') || '',
    demographic: searchParams.get('demographic') || '',
    language: searchParams.get('language') || store.settings.language || 'vi',
    year: searchParams.get('year') || '',
    sort: searchParams.get('sort') || 'latest'
  });

  const [form, setForm] = useState(getDefaults);

  useEffect(() => {
    void api
      .request<{ id: string; name: string }[]>('/catalog/tags')
      .then(r => {
        const loadedTags = r || [];
        setTags(loadedTags);
        const currentGenre = searchParams.get('genre');
        if (currentGenre && isNaN(Number(currentGenre))) {
          const matched = loadedTags.find(t => t.name.toLowerCase() === currentGenre.toLowerCase());
          if (matched) {
            setForm(prev => ({ ...prev, genre: matched.id }));
          }
        }
      })
      .catch(() => { });
  }, [searchParams]);

  useEffect(() => {
    const newForm = getDefaults();
    setForm(newForm);
    const p = pageNumber(searchParams.get('page') || undefined);
    setPage(p);
    if (initialRequest.current) initialRequest.current = false;
    else void loadSearch(newForm, p);
  }, [searchParams]);

  const cleanParams = (targetForm: typeof form, targetPage: number) => {
    const qp: Record<string, string | number> = {};
    for (const [key, val] of Object.entries(targetForm)) {
      if (val !== '' && val !== undefined && val !== null && key !== 'page') {
        qp[key] = val;
      }
    }
    if (targetPage > 1) {
      qp['page'] = targetPage;
    }
    return qp;
  };

  const submit = (overrideForm?: typeof form) => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('search_scroll_y');
      sessionStorage.removeItem('search_manga_id');
      sessionStorage.removeItem('last_scroll_y');
      sessionStorage.removeItem('last_manga_id');
    }
    const target = overrideForm || form;
    const qp = cleanParams(target, 1);
    const qs = api.query(qp);
    router.push(`/tim-truyen-nang-cao${qs ? '?' + qs : ''}`);
  };

  const clearAuthor = () => {
    const updated = { ...form, author: '' };
    setForm(updated);
    submit(updated);
  };

  const reset = () => {
    api.clearCache('/catalog/search');
    api.clearCache('/catalog/home');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('search_scroll_y');
      sessionStorage.removeItem('search_manga_id');
      sessionStorage.removeItem('last_scroll_y');
      sessionStorage.removeItem('last_manga_id');
    }
    const empty = {
      source: '',
      q: '',
      author: '',
      genre: '',
      status: '',
      country: '',
      demographic: '',
      language: store.settings.language || 'vi',
      year: '',
      sort: 'latest'
    };
    setForm(empty);
    router.push('/tim-truyen-nang-cao');
  };

  const restorePosition = () => {
    if (typeof window === 'undefined') return;
    const savedY = sessionStorage.getItem('search_scroll_y');
    const savedMangaId = sessionStorage.getItem('search_manga_id');
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

      sessionStorage.removeItem('search_scroll_y');
      sessionStorage.removeItem('search_manga_id');
    }, 60);
  };

  const prefetchPage = (p: number) => {
    if (p >= 1) {
      const qp = cleanParams(form, p);
      qp['pageSize'] = pageSize;
      api.prefetch('/catalog/search?' + api.query(qp));
    }
  };

  const loadSearch = async (currentForm: typeof form, currentPage: number) => {
    const qp = cleanParams(currentForm, currentPage);
    qp['pageSize'] = pageSize;
    const path = '/catalog/search?' + api.query(qp);
    const n = ++epochRef.current;
    setError('');

    const cached = api.getCached<Page<Manga>>(path);
    if (cached && cached.items) {
      setItems(cached.items);
      setTotal(cached.total);
      setLoading(false);
      restorePosition();
      return;
    }

    setLoading(true);
    try {
      const r = await api.request<Page<Manga>>(path, 'GET', undefined, true);
      if (n === epochRef.current) {
        setItems(r.items || []);
        setTotal(r.total || 0);
        restorePosition();
      }
    } catch (e) {
      if (n === epochRef.current) setError(message(e));
    } finally {
      if (n === epochRef.current) setLoading(false);
    }
  };

  const goPage = (p: number) => {
    prefetchPage(p);
    const qp = cleanParams(form, p);
    router.push(`/tim-truyen-nang-cao?${api.query(qp)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="search-page-container">
      <div className="section-title">
        <h1>
          <Icon name="compass" /> Tìm truyện nâng cao
        </h1>
        <span className="muted total-count-pill">{total.toLocaleString('vi')} bộ truyện</span>
      </div>

      <form
        className="filter-panel glass-panel"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        {form.author && (
          <div className="active-author-banner">
            <div className="banner-text">
              <Icon name="user" />
              <span>
                Đang lọc theo tác giả: <strong>{form.author}</strong>
              </span>
            </div>
            <button
              type="button"
              className="btn-clear-author"
              onClick={clearAuthor}
              aria-label="Xóa bộ lọc tác giả"
            >
              <Icon name="close" />
              <span>Xóa lọc tác giả</span>
            </button>
          </div>
        )}

        <div className="filter-title-row">
          <div className="search-input-field">
            <Icon name="search" className="field-icon" />
            <input
              type="search"
              name="q"
              value={form.q}
              onChange={e => setForm({ ...form, q: e.target.value })}
              placeholder="Tên truyện, tác giả…"
              aria-label="Tìm theo tên truyện hoặc tác giả"
              autoComplete="off"
            />
            {form.q && (
              <button
                type="button"
                className="btn-clear-input"
                aria-label="Xóa từ khóa"
                onClick={() => setForm({ ...form, q: '' })}
              >
                ×
              </button>
            )}
          </div>
          <button
            className="secondary btn-toggle-filter"
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? 'Thu gọn bộ lọc' : 'Mở rộng bộ lọc'}
            onClick={() => setExpanded(!expanded)}
          >
            <Icon name="filter" />
            <span>Bộ lọc</span>
            <Icon
              name="chevronDown"
              className="filter-chevron"
              style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
            />
          </button>
        </div>

        {expanded && (
          <div className="filter-grid">
            <label>
              <span>Thể loại truyện</span>
              <select
                name="genre"
                value={form.genre}
                onChange={e => setForm({ ...form, genre: e.target.value })}
              >
                <option value="">Tất cả thể loại</option>
                {tags.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Tình trạng phát hành</span>
              <select
                name="status"
                value={form.status}
                onChange={e => setForm({ ...form, status: e.target.value })}
              >
                <option value="">Tất cả tình trạng</option>
                <option value="ongoing">Đang tiến hành</option>
                <option value="completed">Đã hoàn thành</option>
                <option value="hiatus">Tạm ngưng</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </label>

            <label>
              <span>Quốc gia gốc</span>
              <select
                name="country"
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value })}
              >
                <option value="">Tất cả quốc gia</option>
                <option value="ja">Nhật Bản (Manga)</option>
                <option value="ko">Hàn Quốc (Manhwa)</option>
                <option value="zh">Trung Quốc (Manhua)</option>
                <option value="en">Tiếng Anh (Comic)</option>
              </select>
            </label>

            <label>
              <span>Đối tượng độc giả</span>
              <select
                name="demographic"
                value={form.demographic}
                onChange={e => setForm({ ...form, demographic: e.target.value })}
              >
                <option value="">Tất cả đối tượng</option>
                <option value="shounen">Shounen (Thiếu niên - Nam)</option>
                <option value="shoujo">Shoujo (Thiếu nữ - Nữ)</option>
                <option value="seinen">Seinen (Trưởng thành - Nam)</option>
                <option value="josei">Josei (Trưởng thành - Nữ)</option>
              </select>
            </label>

            <label>
              <span>Ngôn ngữ bản dịch</span>
              <select
                name="language"
                value={form.language}
                onChange={e => setForm({ ...form, language: e.target.value })}
              >
                <option value="vi">🇻🇳 Tiếng Việt</option>
                <option value="en">🇬🇧 Tiếng Anh</option>
              </select>
            </label>

            <label>
              <span>Năm phát hành</span>
              <input
                type="number"
                min="1950"
                max="2030"
                name="year"
                value={form.year}
                onChange={e => setForm({ ...form, year: e.target.value })}
                placeholder="Ví dụ: 2024"
              />
            </label>
          </div>
        )}

        <div className="filter-bottom-bar">
          <label className="sort-field-wrap">
            <span>Sắp xếp theo</span>
            <select
              name="sort"
              value={form.sort}
              onChange={e => setForm({ ...form, sort: e.target.value })}
            >
              <option value="latest">Mới cập nhật chap</option>
              <option value="new">Truyện mới đăng</option>
              <option value="hot">Xem nhiều nhất</option>
              <option value="rating">Được thích nhiều nhất</option>
              <option value="follows">Theo dõi nhiều nhất</option>
              <option value="title">Bảng chữ cái (A-Z)</option>
            </select>
          </label>

          <div className="filter-action-buttons">
            <button type="button" className="secondary btn-reset-filter" onClick={reset}>
              Đặt lại
            </button>
            <button className="primary btn-submit-filter" type="submit">
              <Icon name="search" /> Lọc truyện
            </button>
          </div>
        </div>
      </form>

      <div className="section-title results-title">
        <h2>Kết quả tìm kiếm</h2>
        <span className="muted">{total.toLocaleString('vi')} truyện phù hợp</span>
      </div>

      {error && (
        <div className="error-state glass-panel">
          <Icon name="info" />
          <p>{error}</p>
          <button onClick={() => loadSearch(form, page)} className="primary">
            Thử lại
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-panel">
          <div className="search-spinner" style={{ width: 32, height: 32, margin: '0 auto 12px' }}></div>
          <p>Đang tìm truyện phù hợp…</p>
        </div>
      ) : (
        <div className="search-results-section">
          <div className="search-grid">
            {items.map(m => (
              <MangaCard key={m.id} manga={m} />
            ))}
          </div>

          {!items.length && !error && (
            <div className="empty-state glass-panel">
              <Icon name="search" />
              <h2>Không tìm thấy bộ truyện nào</h2>
              <p>Thử tìm từ khóa ngắn hơn hoặc nới lỏng các tiêu chí bộ lọc.</p>
              <button className="primary" onClick={reset}>
                Xóa toàn bộ bộ lọc
              </button>
            </div>
          )}

          {total > pageSize && (
            <Pagination
              page={page}
              total={total}
              size={pageSize}
              change={goPage}
              hover={prefetchPage}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage({ initialCatalog }: { initialCatalog: Page<Manga> }) {
  return (
    <Suspense fallback={<div className="loading-panel"><div className="search-spinner"></div></div>}>
      <SearchContent initialCatalog={initialCatalog} />
    </Suspense>
  );
}
