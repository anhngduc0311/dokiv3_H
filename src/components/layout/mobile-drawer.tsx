'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useStore } from '../../contexts/store-context';
import { Icon } from '../ui/icon';

export interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  genresOpen: boolean;
  onToggleGenres: () => void;
  tags: { id: string; name: string }[];
}

export function MobileDrawer({
  isOpen,
  onClose,
  genresOpen,
  onToggleGenres,
  tags
}: MobileDrawerProps) {
  const store = useStore();
  const [filterText, setFilterText] = useState('');

  const filteredTags = useMemo(() => {
    if (!filterText.trim()) return tags;
    const q = filterText.trim().toLowerCase();
    return tags.filter(t => t.name.toLowerCase().includes(q));
  }, [tags, filterText]);

  if (!isOpen) return null;

  const userInitial = store.user?.name?.slice(0, 1)?.toUpperCase() || 'U';
  const role = store.user?.role;
  const canAccessAdmin = role === 'admin' || role === 'superadmin' || role === 'editor' || role === 'translator';

  return (
    <div className="mobile-drawer-backdrop" onClick={onClose}>
      <aside className="mobile-drawer glass-panel" onClick={e => e.stopPropagation()}>
        {/* Drawer Header */}
        <div className="drawer-header">
          <Link href="/" className="brand" aria-label="DokiHentai - Trang chủ" onClick={onClose}>
            <img
              className="brand-symbol"
              src="/brand-mark.png"
              width="44"
              height="44"
              alt=""
              aria-hidden="true"
            />
            <span className="brand-wordmark">
              doki<span>hentai</span>
              <span className="brand-period">.</span>
            </span>
          </Link>
          <button
            type="button"
            className="icon-button btn-close-drawer"
            aria-label="Đóng menu"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </div>

        {/* User Quick Card in Drawer */}
        <div className="drawer-user-card">
          {store.user ? (
            <>
              <div className="drawer-user-info">
                <div className="user-avatar-badge">{userInitial}</div>
                <div>
                  <strong>{store.user.name}</strong>
                  <small className="muted">{store.user.email}</small>
                </div>
              </div>
              <div className="drawer-user-stats">
                <Link href="/theo-doi" onClick={onClose}>
                  <span className="num">{store.follows.length}</span>
                  <span className="label">Đang theo dõi</span>
                </Link>
                <Link href="/lich-su" onClick={onClose}>
                  <span className="num">{store.history.length}</span>
                  <span className="label">Lịch sử đọc</span>
                </Link>
              </div>
              {canAccessAdmin && (
                <div className="drawer-admin-action">
                  <Link href="/admin" className="admin-drawer-btn" onClick={onClose}>
                    <Icon name="dashboard" /> <span>Quản trị hệ thống</span>
                  </Link>
                </div>
              )}
            </>
          ) : (
            <div className="drawer-guest-card">
              <p>Đăng nhập để lưu lại tủ sách của bạn.</p>
              <div className="drawer-auth-actions">
                <Link href="/dang-nhap" className="primary" onClick={onClose}>
                  <Icon name="user" /> Đăng nhập
                </Link>
                <Link href="/dang-ky" className="secondary" onClick={onClose}>
                  Đăng ký
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Links List */}
        <nav className="drawer-nav">
          <div className="nav-section-label">THỂ LOẠI & ĐỐI TƯỢNG</div>
          <button type="button" className="drawer-genre-toggle" onClick={onToggleGenres}>
            <span className="genre-toggle-left">
              <Icon name="tag" /> <span>Thể loại truyện {tags.length > 0 ? `(${tags.length})` : ''}</span>
            </span>
            <Icon
              name="chevronDown"
              style={{ transform: genresOpen ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          {genresOpen && (
            <div className="drawer-genre-container" style={{ padding: '6px 12px 14px' }}>
              <div style={{ position: 'relative', marginBottom: 10 }}>
                <input
                  type="search"
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  placeholder="Lọc thể loại nhanh…"
                  style={{
                    width: '100%',
                    padding: '6px 28px 6px 10px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)'
                  }}
                />
                {filterText && (
                  <button
                    type="button"
                    onClick={() => setFilterText('')}
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      lineHeight: 1
                    }}
                    aria-label="Xóa bộ lọc"
                  >
                    ×
                  </button>
                )}
              </div>
              <div
                className="drawer-genre-pills"
                style={{
                  maxHeight: '40vh',
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  padding: '2px 0'
                }}
              >
                {filteredTags.map(t => (
                  <Link
                    key={t.id}
                    href={`/tim-truyen-nang-cao?genre=${t.id}`}
                    onClick={onClose}
                    className={t.name.toLowerCase() === 'romance' ? 'tag-romance' : ''}
                  >
                    {t.name}
                  </Link>
                ))}
                {tags.length === 0 && <p className="muted">Đang tải thể loại…</p>}
                {tags.length > 0 && filteredTags.length === 0 && (
                  <p className="muted" style={{ fontSize: '12px', padding: '8px 0' }}>
                    Không có thể loại nào khớp với "{filterText}".
                  </p>
                )}
              </div>
            </div>
          )}
          <Link href="/tim-truyen-nang-cao?demographic=shounen" onClick={onClose}>
            <Icon name="sparkles" /> <span>Truyện Con trai (Shounen)</span>
          </Link>
          <Link href="/tim-truyen-nang-cao?demographic=shoujo" onClick={onClose}>
            <Icon name="heart" /> <span>Truyện Con gái (Shoujo)</span>
          </Link>
          <a href="https://dokihentai.com" target="_blank" rel="noopener noreferrer">
            <Icon name="book" /> <span>Light Novel ↗</span>
          </a>

          <div className="nav-section-label">HỆ THỐNG</div>
          <button type="button" className="drawer-theme-btn" onClick={store.toggleTheme}>
            <span className="btn-left">
              <Icon name={store.settings.theme === 'light' ? 'moon' : 'sun'} />{' '}
              <span>Giao diện {store.settings.theme === 'light' ? 'Sáng' : 'Tối'}</span>
            </span>
            <span className="theme-pill">
              {store.settings.theme === 'light' ? 'Sáng' : 'Tối'}
            </span>
          </button>
          {store.user && (
            <button
              type="button"
              className="drawer-logout-btn"
              onClick={() => {
                store.logout();
                onClose();
              }}
            >
              <Icon name="logout" /> <span>Đăng xuất tài khoản</span>
            </button>
          )}
        </nav>
      </aside>
    </div>
  );
}
