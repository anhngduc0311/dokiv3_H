'use client';

import React from 'react';
import Link from 'next/link';
import { BrandLogo } from '../ui/brand-logo';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div>
          <Link href="/" className="brand" aria-label="DokiHentai - Trang chủ">
            <BrandLogo />
          </Link>
          <p>
            <strong>DokiHentai (Doki Hentai - dokihentai.com)</strong> — Trang web đọc truyện hentai,
            manga 18+, manhwa 18+, doujinshi vietsub tiếng Việt online mới nhất và hoàn toàn miễn phí.
            Kho truyện phong phú, đầy đủ thể loại, hình ảnh sắc nét chuẩn HD và cập nhật liên tục mỗi ngày.
            Nội dung gắn nhãn RTA (Restricted To Adults - 18+).
          </p>
          <small className="footer-copy">
            © 2026 DokiHentai · Web đọc truyện hentai & manga 18+ vietsub online
          </small>
        </div>
        <div>
          <h3>KHÁM PHÁ TRUYỆN</h3>
          <div className="footer-navigation">
            <Link href="/">Trang chủ</Link>
            <Link href="/tim-truyen-nang-cao">Khám phá toàn bộ</Link>
            <Link href="/tim-truyen-nang-cao?sort=latest">Truyện hentai mới nhất</Link>
            <Link href="/tim-truyen-nang-cao?sort=rating">Truyện 18+ yêu thích</Link>
            <Link href="/tac-gia">Tác giả truyện hentai</Link>
          </div>
        </div>
        <div>
          <h3>THƯ VIỆN CỦA BẠN</h3>
          <div className="footer-navigation">
            <Link href="/theo-doi">Truyện theo dõi</Link>
            <Link href="/lich-su">Lịch sử đọc truyện</Link>
            <Link href="/tim-truyen-nang-cao?country=ja">Manga Hentai Nhật Bản</Link>
            <Link href="/tim-truyen-nang-cao?country=ko">Manhwa 18+ Hàn Quốc</Link>
          </div>
        </div>
        <div>
          <h3>NỘI DUNG & BẢN QUYỀN</h3>
          <p>
            Nền tảng đọc truyện tranh trực tuyến phi lợi nhuận. Mọi thông tin và hình ảnh được tổng
            hợp từ các nguồn mở trên internet.
          </p>
        </div>
      </div>
    </footer>
  );
}
