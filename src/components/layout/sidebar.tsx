'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Manga, Comment, Page } from '../../types';
import { api } from '../../lib/api';
import { useStore } from '../../contexts/store-context';
import { compact, ago, message } from '../../lib/utils';
import { Icon } from '../ui/icon';

export function Sidebar() {
  const store = useStore();
  const [ranking, setRanking] = useState<Manga[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [sort, setSort] = useState('hot');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const epochRef = useRef(0);

  const tabs = [
    { key: 'hot', label: '★ Top Hot' },
    { key: 'rating', label: '♥ Yêu thích' },
    { key: 'new', label: '◷ Mới' }
  ];

  const savePosition = (id: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('home_scroll_y', window.scrollY.toString());
      sessionStorage.setItem('home_manga_id', id);
    }
  };

  const loadRanking = async (sortKey: string) => {
    const n = ++epochRef.current;
    setSort(sortKey);
    setLoading(true);
    setError('');
    try {
      const r = await api.request<Page<Manga>>(
        '/catalog/search?' +
          api.query({
            sort: sortKey,
            pageSize: 7,
            language: store.settings.language
          }),
        'GET',
        undefined,
        true
      );
      if (n === epochRef.current) {
        setRanking(r.items || []);
      }
    } catch (e) {
      if (n === epochRef.current) {
        setError(message(e));
      }
    } finally {
      if (n === epochRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadRanking('hot');
    void api
      .request<Page<Comment>>('/comments')
      .then(r => {
        if (r && r.items) {
          setComments(r.items.slice(0, 5));
        }
      })
      .catch(() => {});
  }, []);

  return (
    <aside className="sidebar">
      {/* 1. READING HISTORY SECTION */}
      <section className="sidebar-section glass-panel">
        <div className="section-title">
          <h2>
            <Icon name="clock" /> Lịch sử đọc
          </h2>
          <Link href="/lich-su" className="view-all-link">
            Xem tất cả ›
          </Link>
        </div>

        {store.history.length === 0 && (
          <div className="empty-history">
            <Icon name="book" />
            <p>Chưa có lịch sử đọc truyện</p>
            <small>Khám phá và bắt đầu đọc ngay nào</small>
          </div>
        )}

        {store.history.slice(0, 3).map(h => (
          <Link key={h.mangaId} className="history-row" href={`/chuong/${h.chapterId}`}>
            <img
              src={h.cover || '/cover-placeholder.svg'}
              alt=""
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onLoad={e => (e.currentTarget as HTMLElement).classList.add('loaded')}
              onError={e => (e.currentTarget as HTMLElement).classList.add('loaded')}
            />
            <div className="history-info">
              <strong>{h.title}</strong>
              <small>
                <Icon name="play" style={{ width: '10px', height: '10px' }} /> {h.chapterTitle}
              </small>
            </div>
            <Icon name="chevron" className="chevron-icon" />
          </Link>
        ))}
      </section>

      {/* 2. RANKING SECTION */}
      <section className="sidebar-section glass-panel">
        <div className="section-title">
          <h2>
            <Icon name="trophy" /> Bảng xếp hạng
          </h2>
        </div>

        <div className="rank-tabs" role="tablist">
          {tabs.map(t => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={sort === t.key}
              className={sort === t.key ? 'active' : ''}
              onClick={() => loadRanking(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="error">
            {error} <button onClick={() => loadRanking(sort)}>Thử lại</button>
          </p>
        )}

        {loading && (
          <div className="rank-loading">
            <div className="search-spinner"></div>
            <span>Đang tải bảng xếp hạng…</span>
          </div>
        )}

        <div className="rank-list">
          {ranking.map((m, i) => (
            <Link
              key={m.id}
              className="rank-row"
              id={`manga-card-${m.id}`}
              data-manga-id={m.id}
              href={`/truyen-tranh/${m.id}`}
              onClick={() => savePosition(m.id)}
            >
              <span className={`rank-number ${i === 0 ? 'top-1' : i === 1 ? 'top-2' : i === 2 ? 'top-3' : ''}`}>
                {i + 1}
              </span>
              <img
                src={m.cover || '/cover-placeholder.svg'}
                alt={m.title}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onLoad={e => (e.currentTarget as HTMLElement).classList.add('loaded')}
                onError={e => (e.currentTarget as HTMLElement).classList.add('loaded')}
              />
              <div className="rank-info">
                <h3>{m.title}</h3>
                <span className="rank-stat">
                  <Icon name={sort === 'rating' ? 'star' : 'heart'} />
                  {sort === 'rating' ? `${m.rating.toFixed(1)} ★` : `${compact(m.follows)} theo dõi`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 3. RECENT COMMENTS */}
      <section className="sidebar-section glass-panel">
        <div className="section-title">
          <h2>
            <Icon name="comment" /> Bình luận mới
          </h2>
        </div>

        <div className="sidebar-comments-list">
          {comments.map(c => (
            <div key={c.id} className="recent-comment">
              <div className="comment-user-row">
                <span className="avatar mini">{c.name.slice(0, 1).toUpperCase()}</span>
                <strong>{c.name}</strong>
                <small>{ago(c.createdAt)}</small>
              </div>
              <p>{c.body}</p>
              <Link href={`/truyen-tranh/${c.mangaId}`} onClick={() => savePosition(c.mangaId)} className="comment-comic-link">
                <Icon name="book" style={{ width: '11px', height: '11px' }} /> {c.mangaTitle}
              </Link>
            </div>
          ))}
          {comments.length === 0 && <p className="muted empty-small">Chưa có bình luận nào.</p>}
        </div>
      </section>
    </aside>
  );
}
