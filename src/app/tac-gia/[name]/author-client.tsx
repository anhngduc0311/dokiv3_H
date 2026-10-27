'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { pageNumber } from '@/lib/seo';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Manga, Page } from '../../../types';
import { api } from '../../../lib/api';
import { message } from '../../../lib/utils';
import { Icon } from '../../../components/ui/icon';
import { MangaCard } from '../../../components/ui/manga-card';
import { Pagination } from '../../../components/ui/pagination';

function AuthorContent({ initialCatalog }: { initialCatalog?: Page<Manga> }) {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawName = params?.name ? String(params.name) : searchParams.get('name') || '';
  const [name, setName] = useState(rawName);
  const [searchQuery, setSearchQuery] = useState(rawName);
  const [sort, setSort] = useState(() => searchParams.get('sort') || 'latest');
  const [page, setPage] = useState(() => pageNumber(searchParams.get('page') || undefined));

  const [items, setItems] = useState<Manga[]>(initialCatalog?.items || []);
  const [total, setTotal] = useState(initialCatalog?.total || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const epochRef = useRef(0);
  const initialRequest = useRef(!!initialCatalog);

  useEffect(() => {
    const currentName = params?.name ? decodeURIComponent(String(params.name)) : searchParams.get('name') || '';
    setName(currentName);
    setSearchQuery(currentName);
    const p = pageNumber(searchParams.get('page') || undefined);
    const s = searchParams.get('sort') || 'latest';
    setPage(p);
    setSort(s);
    if (currentName) {
      if (initialRequest.current) initialRequest.current = false;
      else void loadAuthor(currentName, p, s);
    }
  }, [params, searchParams]);

  const searchAuthor = () => {
    if (!searchQuery.trim()) return;
    router.push(`/tac-gia/${encodeURIComponent(searchQuery.trim())}`);
  };

  const onSortChange = (newSort: string) => {
    setSort(newSort);
    setPage(1);
    if (name) {
      router.push(`/tac-gia/${encodeURIComponent(name)}?sort=${newSort}&page=1`);
    }
  };

  const goPage = (p: number) => {
    setPage(p);
    if (name) {
      router.push(`/tac-gia/${encodeURIComponent(name)}?sort=${sort}&page=${p}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const loadAuthor = async (authorName: string, currentPage: number, currentSort: string) => {
    if (!authorName) return;
    const path = `/catalog/author/${encodeURIComponent(authorName)}?page=${currentPage}&pageSize=24&sort=${currentSort}`;
    const n = ++epochRef.current;
    setError('');

    const cached = api.getCached<Page<Manga>>(path);
    if (cached && cached.items && cached.items.length > 0) {
      setItems(cached.items);
      setTotal(cached.total);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const r = await api.request<Page<Manga>>(path, 'GET', undefined, true);
      if (n === epochRef.current) {
        setItems(r.items || []);
        setTotal(r.total || 0);
      }
    } catch (e) {
      if (n === epochRef.current) setError(message(e));
    } finally {
      if (n === epochRef.current) setLoading(false);
    }
  };

  return (
    <div className="author-page-container">
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <Link href="/">Trang chủ</Link>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-sep">Tác giả</span>
        {name && (
          <>
            <span className="breadcrumb-sep">›</span>
            <span className="current-crumb">{name}</span>
          </>
        )}
      </div>

      {/* Author Hero Banner */}
      <section className="author-hero glass-panel">
        <div className="author-hero-content">
          <div className="author-avatar-badge">
            <span className="author-avatar-letter">{(name || 'A').slice(0, 1).toUpperCase()}</span>
          </div>

          <div className="author-details">
            <div className="author-title-row">
              <h1>{name || 'Tìm kiếm tác giả'}</h1>
              {name && (
                <span className="author-count-pill">{total.toLocaleString('vi')} bộ truyện</span>
              )}
            </div>
            <p className="author-subtitle">
              {name ? (
                <>
                  Tổng hợp danh sách các bộ truyện tranh sáng tác và minh họa bởi{' '}
                  <strong>{name}</strong>
                </>
              ) : (
                'Nhập tên tác giả hoặc họa sĩ để tìm kiếm tất cả các bộ truyện liên quan'
              )}
            </p>

            {/* Quick Author Search Form */}
            <form
              className="author-search-bar"
              onSubmit={e => {
                e.preventDefault();
                searchAuthor();
              }}
            >
              <div className="author-search-input-field">
                <Icon name="user" className="field-icon" />
                <input
                  type="search"
                  name="authorQuery"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Nhập tên tác giả khác (ví dụ: Ryon, Izumi, Oda...)"
                  aria-label="Tìm theo tên tác giả"
                  autoComplete="off"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="btn-clear-author-input"
                    aria-label="Xóa"
                    onClick={() => setSearchQuery('')}
                  >
                    ×
                  </button>
                )}
              </div>
              <button type="submit" className="primary btn-author-search">
                <Icon name="search" /> Tìm tác giả
              </button>
            </form>
          </div>
        </div>
      </section>

      {name && (
        <>
          {/* Results Header with Sort Controls */}
          <div className="section-title author-results-header">
            <div className="results-heading">
              <h2>
                <Icon name="book" /> Truyện của tác giả {name}
              </h2>
              <span className="muted">{total.toLocaleString('vi')} kết quả</span>
            </div>

            <div className="author-sort-wrap">
              <label htmlFor="author-sort-select">Sắp xếp:</label>
              <select
                id="author-sort-select"
                value={sort}
                onChange={e => onSortChange(e.target.value)}
              >
                <option value="latest">Mới cập nhật chap</option>
                <option value="hot">Theo dõi nhiều nhất</option>
                <option value="rating">Đánh giá cao nhất</option>
                <option value="new">Truyện mới đăng</option>
                <option value="title">Bảng chữ cái (A-Z)</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="error-state glass-panel">
              <Icon name="info" />
              <p>{error}</p>
              <button onClick={() => loadAuthor(name, page, sort)} className="primary">
                Thử lại
              </button>
            </div>
          )}

          {loading ? (
            <div className="loading-panel">
              <div className="search-spinner" style={{ width: 36, height: 36, margin: '0 auto 14px' }}></div>
              <p>Đang tìm tất cả truyện của tác giả {name}…</p>
            </div>
          ) : (
            <>
              <div className="author-manga-grid">
                {items.map(m => (
                  <MangaCard key={m.id} manga={m} />
                ))}
              </div>

              {!items.length && !error && (
                <div className="empty-state glass-panel">
                  <Icon name="user" />
                  <h2>Chưa tìm thấy truyện của tác giả "{name}"</h2>
                  <p>Hãy thử kiểm tra lại chính tả hoặc tìm tên tác giả bằng từ khóa ngắn gọn hơn.</p>
                </div>
              )}

              {total > 24 && (
                <Pagination
                  page={page}
                  total={total}
                  size={24}
                  change={goPage}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function AuthorPage({ initialCatalog }: { initialCatalog?: Page<Manga> }) {
  return (
    <Suspense fallback={<div className="loading-panel"><div className="search-spinner"></div></div>}>
      <AuthorContent initialCatalog={initialCatalog} />
    </Suspense>
  );
}
