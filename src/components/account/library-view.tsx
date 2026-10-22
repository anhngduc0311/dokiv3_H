'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useStore } from '../../contexts/store-context';
import { ago, message } from '../../lib/utils';
import { Icon } from '../ui/icon';

export interface LibraryViewProps {
  isHistory?: boolean;
}

export function LibraryView({ isHistory = false }: LibraryViewProps) {
  const store = useStore();

  useEffect(() => {
    if (store.user) {
      void store.refreshLibrary().catch(e => store.notify(message(e)));
    }
  }, []);

  const items = isHistory ? store.history : store.follows;

  const remove = async (id: string) => {
    try {
      await store.removeHistory(id);
    } catch (e) {
      store.notify(message(e));
    }
  };

  return (
    <div className="library-page-container">
      <div className="section-title">
        <h1>
          <Icon name={isHistory ? 'clock' : 'heart'} />
          {isHistory ? 'Lịch sử đọc truyện' : 'Truyện đang theo dõi'}
        </h1>
        <span className="muted total-count-pill">{items.length} bộ</span>
      </div>

      <div className="library-sub-bar">
        <p className="muted">
          {store.user
            ? 'Dữ liệu được đồng bộ an toàn với tài khoản của bạn.'
            : 'Dữ liệu được lưu trên trình duyệt này. Hãy đăng nhập để đồng bộ giữa máy tính và điện thoại.'}
        </p>

        <div className="library-nav-pills">
          <Link
            href="/theo-doi"
            className={`lib-pill-btn ${!isHistory ? 'active' : ''}`}
          >
            <Icon name="heart" /> Theo dõi ({store.follows.length})
          </Link>
          <Link
            href="/lich-su"
            className={`lib-pill-btn ${isHistory ? 'active' : ''}`}
          >
            <Icon name="clock" /> Lịch sử ({store.history.length})
          </Link>
        </div>
      </div>

      {!isHistory && !store.user && items.length === 0 ? (
        <div className="empty-state glass-panel">
          <Icon name="heart" />
          <h2>Giữ những bộ truyện bạn yêu thích</h2>
          <p>Đăng nhập để theo dõi truyện và nhận thông báo khi có chương mới.</p>
          <Link
            className="primary"
            href="/dang-nhap?returnUrl=%2Ftheo-doi"
          >
            Đăng nhập ngay
          </Link>
        </div>
      ) : (
        <>
          <div className="library-grid">
            {items.map(item => (
              <article key={item.mangaId} className="library-card glass-panel">
                <Link className="lib-cover-link" href={`/truyen-tranh/${item.mangaId}`}>
                  <img
                    src={item.cover || '/cover-placeholder.svg'}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />
                </Link>
                <div className="lib-content">
                  <h2>
                    <Link href={`/truyen-tranh/${item.mangaId}`}>{item.title}</Link>
                  </h2>

                  {isHistory ? (
                    <>
                      <p className="lib-chap-info">
                        <Icon name="play" style={{ width: 11, height: 11 }} /> {item.chapterTitle}
                      </p>
                      {item.readAt && (
                        <small className="muted">{ago(item.readAt)} trước</small>
                      )}
                      <div className="lib-actions">
                        <Link
                          className="primary btn-read-continue"
                          href={`/chuong/${item.chapterId}`}
                        >
                          Đọc tiếp <Icon name="arrowRight" style={{ width: 12, height: 12 }} />
                        </Link>
                        <button
                          type="button"
                          className="text-button btn-remove-item"
                          onClick={() => remove(item.mangaId)}
                        >
                          Xóa
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="lib-actions">
                      <Link
                        className="primary btn-read-continue"
                        href={`/truyen-tranh/${item.mangaId}`}
                      >
                        Xem truyện <Icon name="chevron" />
                      </Link>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>

          {items.length === 0 && (
            <div className="empty-state glass-panel">
              <Icon name="book" />
              <h2>
                {isHistory
                  ? 'Bạn chưa đọc bộ truyện nào'
                  : 'Bạn chưa theo dõi bộ truyện nào'}
              </h2>
              <p>Hàng ngàn bộ truyện hấp dẫn đang chờ đón bạn khám phá.</p>
              <Link className="primary" href="/">
                Khám phá truyện hay
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
