'use client';

import React from 'react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <Link href="/" className="brand" aria-label="DokiTruyen - Trang chủ">
            <img
              className="brand-symbol"
              src="/brand-mark.png"
              width="44"
              height="44"
              alt=""
              aria-hidden="true"
            />
            <span className="brand-wordmark">
              doki<span>truyen</span>
              <span className="brand-period">.</span>
            </span>
          </Link>
          <p>
            <strong>DokiTruyen (Doki Truyện - dokitruyen.com)</strong> — Trang đọc truyện tranh
            online miễn phí cập nhật mới nhất mỗi ngày. Đọc Manga, Manhwa, Manhua tiếng Việt bản
            dịch chất lượng cao, hình ảnh sắc nét và tối ưu mượt mà trên điện thoại và máy tính.
          </p>
          <small className="footer-copy">
            © 2026 DokiTruyen · Website đọc truyện tranh online
          </small>
        </div>
        <div>
          <h3>KHÁM PHÁ TRUYỆN</h3>
          <div className="footer-navigation">
            <Link href="/">Trang chủ</Link>
            <Link href="/tim-truyen-nang-cao">Khám phá toàn bộ</Link>
            <Link href="/tim-truyen-nang-cao?sort=latest">Truyện mới cập nhật</Link>
            <Link href="/tim-truyen-nang-cao?sort=rating">Truyện được yêu thích</Link>
          </div>
        </div>
        <div>
          <h3>THƯ VIỆN CỦA BẠN</h3>
          <div className="footer-navigation">
            <Link href="/theo-doi">Truyện theo dõi</Link>
            <Link href="/lich-su">Lịch sử đọc truyện</Link>
            <Link href="/tim-truyen-nang-cao?country=ja">Manga Nhật Bản</Link>
            <Link href="/tim-truyen-nang-cao?country=ko">Manhwa Hàn Quốc</Link>
          </div>
        </div>
        <div>
          <h3>NỘI DUNG & BẢN QUYỀN</h3>
          <p>
            Nền tảng đọc truyện tranh trực tuyến phi lợi nhuận. Mọi thông tin và hình ảnh được tổng
            hợp từ các nguồn mở trên internet.
          </p>
          <div className="footer-links">
            <a href="https://mangadex.org" target="_blank" rel="noopener noreferrer">
              MangaDex ↗
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
