'use client';

import React, { useRef } from 'react';
import { CoverImage } from './cover-image';
import Link from 'next/link';
import { Manga } from '../../types';
import { api } from '../../lib/api';
import { compact, ago } from '../../lib/utils';
import { Icon } from './icon';

export interface MangaCardProps {
  manga: Manga;
  idPrefix?: string;
}

export function MangaCard({ manga, idPrefix = '' }: MangaCardProps) {
  const prefetchedRef = useRef(false);

  const recentChapters = (manga.chapters || []).slice(0, 3).map(chapter => ({
    ...chapter,
    relativeTime: ago(chapter.publishedAt)
  }));

  const savePosition = () => {
    if (typeof window !== 'undefined') {
      const isSearch = window.location.pathname.includes('/tim-truyen-nang-cao');
      if (isSearch) {
        sessionStorage.setItem('search_scroll_y', window.scrollY.toString());
        sessionStorage.setItem('search_manga_id', manga.id);
      } else {
        sessionStorage.setItem('home_scroll_y', window.scrollY.toString());
        sessionStorage.setItem('home_manga_id', manga.id);
      }
      sessionStorage.setItem('last_scroll_y', window.scrollY.toString());
      sessionStorage.setItem('last_manga_id', manga.id);
    }
  };

  const prefetch = () => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    api.prefetchDetail(manga.id);
  };

  const originText = manga.country === 'ko' ? 'Manhwa' : ['cn', 'zh', 'zh-hk'].includes(manga.country) ? 'Manhua' : 'Manga';

  return (
    <article
      className="manga-card"
      id={`${idPrefix}manga-card-${manga.id}`}
      data-manga-id={manga.id}
    >
      <Link prefetch={false}
        href={`/truyen-tranh/${manga.id}`}
        className="cover-link"
        onClick={savePosition}
        onMouseEnter={prefetch}
        onTouchStart={prefetch}
        aria-label={manga.title}
      >
        <CoverImage key={manga.cover} src={manga.cover} alt={manga.title} />
        {(manga.contentRating === 'erotica' || manga.contentRating === 'pornographic') && (
          <span className="age-label">18+</span>
        )}
        {manga.rating > 0 && <span className="cover-rating">
          <Icon name="star" /> {manga.rating.toFixed(1)}
        </span>}
        <span className="cover-read" aria-hidden="true">
          <Icon name="book" />
        </span>
      </Link>
      <div className="manga-card-info">
        <div className="card-stats">
          <span>
            <Icon name="star" /> {manga.rating ? manga.rating.toFixed(1) : '0.0'}
          </span>
          <span>
            <Icon name="heart" /> {compact(manga.follows || 0)}
          </span>
        </div>
        <h3>
          <Link prefetch={false} href={`/truyen-tranh/${manga.id}`} onClick={savePosition} title={manga.title}>
            {manga.title}
          </Link>
        </h3>
        <p className="card-origin">
          {originText} · {manga.source === 'mimihentai' ? 'MimiHentai' : manga.source === 'truyengg' ? 'TruyenGG' : manga.year || 'DokiHentai'}
        </p>
      </div>
      <div className="mini-chapters">
        {recentChapters.map(c => (
          <div key={c.id} className="mini-chap-item">
            <Link prefetch={false} href={`/chuong/${c.id}`} onClick={savePosition} title={c.title}>
              {c.title}
            </Link>
            <time dateTime={c.publishedAt}>{c.relativeTime}</time>
          </div>
        ))}
        {(!manga.chapters || manga.chapters.length === 0) && (
          <div className="mini-chap-item">
            <span className="muted-author">{manga.author || 'Đang cập nhật'}</span>
          </div>
        )}
      </div>
    </article>
  );
}
