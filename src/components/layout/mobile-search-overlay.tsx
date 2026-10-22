'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Manga } from '../../types';
import { api } from '../../lib/api';
import { Icon } from '../ui/icon';

export interface MobileSearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileSearchOverlay({ isOpen, onClose }: MobileSearchOverlayProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Manga[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchEpochRef = useRef(0);

  if (!isOpen) return null;

  const onQueryInput = (val: string) => {
    setQuery(val);
    const q = val.trim();
    if (!q) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const epoch = ++searchEpochRef.current;

    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.request<{ items: Manga[]; total: number }>(
          '/catalog/search?' + api.query({ q, pageSize: 6 }),
          'GET',
          undefined,
          true
        );
        if (epoch === searchEpochRef.current) {
          setSuggestions(res.items || []);
          setLoadingSuggestions(false);
        }
      } catch {
        if (epoch === searchEpochRef.current) {
          setSuggestions([]);
          setLoadingSuggestions(false);
        }
      }
    }, 220);
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
  };

  const search = () => {
    onClose();
    if (!query.trim()) return;
    router.push(`/tim-truyen-nang-cao?q=${encodeURIComponent(query.trim())}`);
  };

  const selectManga = (m: Manga) => {
    onClose();
    router.push(`/truyen-tranh/${m.id}`);
  };

  const coverFallback = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    img.onerror = null;
    img.src = '/cover-placeholder.svg';
  };

  return (
    <div className="mobile-search-overlay" onClick={onClose}>
      <div className="mobile-search-bar" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="btn-back-search icon-button"
          onClick={onClose}
          aria-label="Quay lại"
        >
          <Icon name="arrowLeft" />
        </button>
        <form
          className="mobile-search-form"
          onSubmit={e => {
            e.preventDefault();
            search();
          }}
        >
          <input
            name="mobileQuery"
            value={query}
            onChange={e => onQueryInput(e.target.value)}
            placeholder="Tìm kiếm truyện tranh, tác giả…"
            autoFocus
            autoComplete="off"
          />
          {query.trim() && (
            <button
              type="button"
              className="btn-clear"
              onClick={clearSearch}
              aria-label="Xóa"
            >
              <Icon name="close" />
            </button>
          )}
          <button type="submit" className="btn-submit" aria-label="Tìm">
            <Icon name="search" />
          </button>
        </form>
      </div>

      {query.trim() && (
        <div className="mobile-suggestions-box" onClick={e => e.stopPropagation()}>
          {loadingSuggestions ? (
            <div className="suggestion-loading">
              <div className="search-spinner"></div>
              <span>Đang tìm kiếm...</span>
            </div>
          ) : suggestions.length > 0 ? (
            <>
              <div className="suggestion-list">
                {suggestions.map(m => (
                  <Link
                    key={m.id}
                    href={`/truyen-tranh/${m.id}`}
                    className="suggestion-item"
                    onClick={() => selectManga(m)}
                  >
                    <img
                      src={m.cover || '/cover-placeholder.svg'}
                      alt={m.title}
                      className="suggestion-cover"
                      onError={coverFallback}
                    />
                    <div className="suggestion-info">
                      <strong className="suggestion-title">{m.title}</strong>
                      <div className="suggestion-meta">
                        {m.chapters && m.chapters.length > 0 && (
                          <span className="suggestion-chapter">
                            {m.chapters[0].title || 'Mới nhất'}
                          </span>
                        )}
                        {m.rating > 0 && (
                          <span className="suggestion-rating">
                            <Icon name="star" /> {m.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Icon name="chevron" className="chevron-icon" />
                  </Link>
                ))}
              </div>
              <button type="button" className="suggestion-footer" onClick={search}>
                <span>
                  Xem tất cả kết quả cho "<strong>{query.trim()}</strong>"
                </span>
                <Icon name="chevron" />
              </button>
            </>
          ) : (
            !loadingSuggestions && (
              <div className="suggestion-empty">
                <Icon name="search" />
                <p>
                  Không tìm thấy truyện cho "<strong>{query.trim()}</strong>"
                </p>
                <button type="button" className="btn-full-search" onClick={search}>
                  Tìm kiếm nâng cao
                </button>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
