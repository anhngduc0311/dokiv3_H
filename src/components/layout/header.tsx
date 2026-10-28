'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { BrandLogo } from '../ui/brand-logo';
import { useRouter, usePathname } from 'next/navigation';
import { Manga, NotificationItem } from '../../types';
import { api } from '../../lib/api';
import { useStore } from '../../contexts/store-context';
import { ago, statuses } from '../../lib/utils';
import { Icon } from '../ui/icon';

export interface HeaderProps {
  onOpenMobileMenu: () => void;
  onOpenMobileSearch: () => void;
  genresOpen: boolean;
  onToggleGenres: () => void;
  tags: { id: string; name: string }[];
}

export function Header({
  onOpenMobileMenu,
  onOpenMobileSearch,
  genresOpen,
  onToggleGenres,
  tags
}: HeaderProps) {
  const store = useStore();
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Manga[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchEpochRef = useRef(0);
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const notifWrapRef = useRef<HTMLDivElement | null>(null);
  const accountWrapRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns on route change
  useEffect(() => {
    setSuggestionsOpen(false);
    setNotificationsOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // Click outside listener
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchWrapRef.current && !searchWrapRef.current.contains(target)) {
        setSuggestionsOpen(false);
      }
      if (notifWrapRef.current && !notifWrapRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
      if (accountWrapRef.current && !accountWrapRef.current.contains(target)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  const onQueryInput = (val: string) => {
    setQuery(val);
    const q = val.trim();
    setHighlightedIndex(-1);
    if (!q) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      setLoadingSuggestions(false);
      return;
    }

    setSuggestionsOpen(true);
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

  const onFocus = () => {
    if (query.trim().length > 0 && (suggestions.length > 0 || loadingSuggestions)) {
      setSuggestionsOpen(true);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setSuggestions([]);
    setSuggestionsOpen(false);
  };

  const selectManga = (m: Manga) => {
    setSuggestionsOpen(false);
    router.push(`/truyen-tranh/${m.id}`);
  };

  const search = () => {
    setSuggestionsOpen(false);
    if (!query.trim()) return;
    router.push(`/tim-truyen-nang-cao?q=${encodeURIComponent(query.trim())}`);
  };

  const onKeydown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestionsOpen) return;
    const maxIndex = suggestions.length; // items 0..len-1, len for footer

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = highlightedIndex + 1;
      setHighlightedIndex(next > maxIndex ? 0 : next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = highlightedIndex - 1;
      setHighlightedIndex(prev < 0 ? maxIndex : prev);
    } else if (event.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        event.preventDefault();
        selectManga(suggestions[highlightedIndex]);
      } else if (highlightedIndex === maxIndex) {
        event.preventDefault();
        search();
      }
    } else if (event.key === 'Escape') {
      setSuggestionsOpen(false);
    }
  };

  const toggleNotifications = () => {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    if (next) {
      setAccountOpen(false);
      void store.loadNotifications();
    }
  };

  const onNotificationClick = async (n: NotificationItem) => {
    setNotificationsOpen(false);
    if (!n.isRead) {
      await store.markNotificationRead(n.id);
    }
  };

  const coverFallback = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const img = e.currentTarget;
    img.onerror = null;
    img.src = '/cover-placeholder.svg';
  };

  const userInitial = store.user?.name?.slice(0, 1)?.toUpperCase() || 'U';
  const role = store.user?.role;
  const canAccessAdmin = role === 'admin' || role === 'superadmin' || role === 'editor' || role === 'translator';

  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Hamburger Menu for Mobile */}
        <button
          type="button"
          className="mobile-menu-btn icon-button"
          aria-label="Mở menu"
          onClick={onOpenMobileMenu}
        >
          <Icon name="menu" />
        </button>

        {/* Brand Logo */}
        <Link href="/" className="brand" aria-label="DokiHentai - Trang chủ">
          <BrandLogo />
        </Link>

        {/* Desktop Navigation */}
        <nav className="header-navigation" aria-label="Điều hướng chính">
          <Link href="/" className={pathname === '/' ? 'active' : ''}>
            <Icon name="home" /> Trang chủ
          </Link>
          <Link href="/tim-truyen-nang-cao" className={pathname === '/tim-truyen-nang-cao' ? 'active' : ''}>
            <Icon name="compass" /> Khám phá
          </Link>
          <button
            type="button"
            className={`genre-nav-btn ${genresOpen ? 'active' : ''}`}
            aria-expanded={genresOpen}
            onClick={onToggleGenres}
          >
            <Icon name="tag" /> Thể loại <Icon name="chevronDown" />
          </button>
          <span className="nav-divider" aria-hidden="true"></span>
          <Link href="/theo-doi" className={pathname === '/theo-doi' ? 'active' : ''}>
            <Icon name="heart" /> Thư viện
          </Link>
          <Link href="/lich-su" className={pathname === '/lich-su' ? 'active' : ''}>
            <Icon name="clock" /> Lịch sử
          </Link>
          <Link href="/tim-truyen-nang-cao?sort=rating" className="nav-ranking">
            <Icon name="trophy" /> Xếp hạng
          </Link>
        </nav>

        {/* Desktop / Tablet Search Wrap */}
        <div className="header-search-wrap" ref={searchWrapRef}>
          <form
            className="header-search"
            onSubmit={e => {
              e.preventDefault();
              search();
            }}
          >
            <input
              name="query"
              value={query}
              onChange={e => onQueryInput(e.target.value)}
              onFocus={onFocus}
              onKeyDown={onKeydown}
              placeholder="Tìm kiếm truyện, tác giả…"
              aria-label="Tìm truyện"
              autoComplete="off"
            />
            {loadingSuggestions && <div className="search-spinner" aria-hidden="true"></div>}
            {query.trim() && (
              <button
                type="button"
                className="btn-clear-search"
                aria-label="Xóa từ khóa"
                onClick={clearSearch}
              >
                <Icon name="close" />
              </button>
            )}
            <button aria-label="Tìm kiếm" type="submit" className="btn-search-submit">
              <Icon name="search" />
            </button>
          </form>

          {suggestionsOpen && query.trim() && (
            <div className="search-suggestions glass-panel" onMouseDown={e => e.stopPropagation()}>
              {loadingSuggestions && !suggestions.length ? (
                <div className="suggestion-loading">
                  <div className="search-spinner"></div>
                  <span>Đang tìm kiếm gợi ý…</span>
                </div>
              ) : suggestions.length > 0 ? (
                <>
                  <div className="suggestion-list">
                    {suggestions.map((m, i) => (
                      <Link
                        key={m.id}
                        href={`/truyen-tranh/${m.id}`}
                        className={`suggestion-item ${highlightedIndex === i ? 'highlighted' : ''}`}
                        onClick={() => selectManga(m)}
                        onMouseEnter={() => setHighlightedIndex(i)}
                      >
                        <img
                          src={m.cover || '/cover-placeholder.svg'}
                          alt={m.title}
                          className="suggestion-cover"
                          onError={coverFallback}
                          loading="lazy"
                        />
                        <div className="suggestion-info">
                          <strong className="suggestion-title">{m.title}</strong>
                          <div className="suggestion-meta">
                            {m.chapters && m.chapters.length > 0 && (
                              <span className="suggestion-chapter">
                                {m.chapters[0].title || 'Mới cập nhật'}
                              </span>
                            )}
                            {m.rating > 0 && (
                              <span className="suggestion-rating">
                                <Icon name="star" /> {m.rating.toFixed(1)}
                              </span>
                            )}
                            {m.genres && m.genres.length > 0 && (
                              <span className="suggestion-genre">{m.genres.slice(0, 2).join(', ')}</span>
                            )}
                          </div>
                          {m.author && <span className="suggestion-author">{m.author}</span>}
                        </div>
                        {m.status && (
                          <span
                            className={`suggestion-status ${
                              m.status === 'ongoing' ? 'ongoing' : m.status === 'completed' ? 'completed' : ''
                            }`}
                          >
                            {statuses[m.status] || m.status}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`suggestion-footer ${highlightedIndex === suggestions.length ? 'highlighted' : ''}`}
                    onClick={search}
                    onMouseEnter={() => setHighlightedIndex(suggestions.length)}
                  >
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

        {/* Header Actions */}
        <div className="header-actions">
          {/* Mobile Search Trigger Button */}
          <button
            type="button"
            className="icon-button mobile-search-trigger"
            aria-label="Mở tìm kiếm"
            onClick={onOpenMobileSearch}
          >
            <Icon name="search" />
          </button>

          {/* Quick Theme Toggle */}
          <button
            type="button"
            className="icon-button theme-toggle-btn"
            aria-label="Đổi giao diện sáng/tối"
            onClick={store.toggleTheme}
            title={store.settings.theme === 'light' ? 'Chuyển sang nền tối' : 'Chuyển sang nền sáng'}
          >
            <Icon name={store.settings.theme === 'light' ? 'moon' : 'sun'} />
          </button>

          {/* Notifications Dropdown */}
          {store.user && (
            <div className="notification-wrap" ref={notifWrapRef}>
              <button
                type="button"
                className={`icon-button notification-trigger-btn ${notificationsOpen ? 'is-open' : ''}`}
                onClick={toggleNotifications}
                aria-label="Thông báo"
                title={
                  store.unreadNotifications > 0
                    ? `${store.unreadNotifications} thông báo mới`
                    : 'Thông báo'
                }
              >
                <Icon name="bell" />
                {store.unreadNotifications > 0 && (
                  <span className="notification-badge">
                    {store.unreadNotifications > 99 ? '99+' : store.unreadNotifications}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div className="dropdown-backdrop" onClick={() => setNotificationsOpen(false)}></div>
                  <div
                    className="notification-dropdown glass-panel"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="notif-dropdown-header">
                      <div className="notif-header-title">
                        <strong>Thông báo</strong>
                        {store.unreadNotifications > 0 && (
                          <span className="notif-count-pill">{store.unreadNotifications} mới</span>
                        )}
                      </div>
                      {store.unreadNotifications > 0 && (
                        <button
                          type="button"
                          className="btn-mark-all-read"
                          onClick={store.markAllNotificationsRead}
                        >
                          Đã đọc tất cả
                        </button>
                      )}
                    </div>

                    <div className="notif-dropdown-list">
                      {store.notifications.map(n => (
                        <Link
                          key={n.id}
                          href={
                            n.type === 'welcome' ||
                            !n.mangaId ||
                            n.mangaId === '00000000-0000-0000-0000-000000000000'
                              ? '/'
                              : `/truyen-tranh/${n.mangaId}`
                          }
                          className={`notif-item ${!n.isRead ? 'unread' : ''} ${
                            n.type === 'welcome' ? 'welcome-notif' : ''
                          }`}
                          onClick={() => onNotificationClick(n)}
                        >
                          <div
                            className={`notif-item-avatar ${
                              n.type === 'welcome' ? 'welcome-avatar' : ''
                            }`}
                          >
                            {n.type === 'welcome'
                              ? '🎉'
                              : n.actorName
                              ? n.actorName.slice(0, 1).toUpperCase()
                              : '💬'}
                          </div>
                          <div className="notif-item-body">
                            <p className="notif-message">{n.message}</p>
                            <div className="notif-meta">
                              <span className="notif-manga-title">
                                {n.type === 'welcome' ? 'Hệ thống DokiHentai' : n.mangaTitle}
                              </span>
                              <span className="notif-dot">•</span>
                              <span className="notif-time">{ago(n.createdAt)} trước</span>
                            </div>
                          </div>
                          {!n.isRead && <span className="notif-unread-dot" title="Chưa đọc"></span>}
                        </Link>
                      ))}
                      {store.notifications.length === 0 && (
                        <div className="notif-empty">
                          <Icon name="bell" />
                          <p>Chưa có thông báo nào.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Account Button & Dropdown */}
          <div className="account-wrap" ref={accountWrapRef}>
            <button
              type="button"
              className={`account-button ${accountOpen ? 'is-open' : ''}`}
              onClick={() => setAccountOpen(!accountOpen)}
              aria-label="Tài khoản"
            >
              <span className="account-avatar-pill">
                {store.user ? (
                  <span className="avatar-initial">{userInitial}</span>
                ) : (
                  <Icon name="user" />
                )}
              </span>
              <span className="account-username">{store.user?.name || 'Tài khoản'}</span>
              <svg
                className="account-chevron"
                viewBox="0 0 16 16"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polyline points="4 6 8 10 12 6"></polyline>
              </svg>
            </button>

            {accountOpen && (
              <div className="account-menu glass-panel" onClick={e => e.stopPropagation()}>
                {store.user ? (
                  <>
                    <div className="account-menu-header">
                      <div className="user-avatar-badge">{userInitial}</div>
                      <div className="user-meta-info">
                        <strong>{store.user.name}</strong>
                        <small className="muted">{store.user.email}</small>
                      </div>
                    </div>
                    <div className="menu-divider"></div>
                    <Link href="/theo-doi" onClick={() => setAccountOpen(false)}>
                      <Icon name="heart" /> Truyện theo dõi ({store.follows.length})
                    </Link>
                    <Link href="/lich-su" onClick={() => setAccountOpen(false)}>
                      <Icon name="clock" /> Lịch sử đọc ({store.history.length})
                    </Link>
                    <Link href="/doi-mat-khau" onClick={() => setAccountOpen(false)}>
                      <Icon name="lock" /> Đổi mật khẩu
                    </Link>
                    {canAccessAdmin && (
                      <>
                        <div className="menu-divider"></div>
                        <Link
                          href="/admin"
                          className="admin-menu-link"
                          onClick={() => setAccountOpen(false)}
                        >
                          <Icon name="dashboard" /> <span>Quản trị hệ thống</span>
                        </Link>
                      </>
                    )}
                    <div className="menu-divider"></div>
                    <button
                      type="button"
                      className="logout-btn"
                      onClick={() => {
                        store.logout();
                        setAccountOpen(false);
                      }}
                    >
                      <Icon name="logout" /> Đăng xuất
                    </button>
                  </>
                ) : (
                  <div className="account-menu-guest">
                    <p>Đăng nhập để đồng bộ truyện theo dõi và lịch sử đọc.</p>
                    <Link
                      href="/dang-nhap"
                      className="primary btn-login-link"
                      onClick={() => setAccountOpen(false)}
                    >
                      <Icon name="user" /> Đăng nhập
                    </Link>
                    <Link
                      href="/dang-ky"
                      className="secondary btn-reg-link"
                      onClick={() => setAccountOpen(false)}
                    >
                      Đăng ký tài khoản
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
