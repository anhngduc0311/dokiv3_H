'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '../../contexts/store-context';
import { Icon } from '../ui/icon';

export interface BottomDockProps {
  onOpenMobileMenu: () => void;
}

export function BottomDock({ onOpenMobileMenu }: BottomDockProps) {
  const store = useStore();
  const pathname = usePathname();
  const [isDockHidden, setIsDockHidden] = useState(false);

  useEffect(() => {
    let lastScrollY = typeof window !== 'undefined' ? window.scrollY : 0;

    const onScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > 60 && currentScrollY > lastScrollY + 8) {
        setIsDockHidden(true);
      } else if (currentScrollY < lastScrollY - 8 || currentScrollY <= 30) {
        setIsDockHidden(false);
      }
      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={`mobile-bottom-dock glass-panel ${isDockHidden ? 'is-hidden' : ''}`}
      aria-label="Điều hướng nhanh trên điện thoại"
    >
      <Link href="/" className={`dock-item ${pathname === '/' ? 'active' : ''}`}>
        <Icon name="home" />
        <span>Trang chủ</span>
      </Link>
      <Link
        href="/tim-truyen-nang-cao"
        className={`dock-item ${pathname === '/tim-truyen-nang-cao' ? 'active' : ''}`}
      >
        <Icon name="compass" />
        <span>Khám phá</span>
      </Link>
      <Link
        href="/theo-doi"
        className={`dock-item ${pathname === '/theo-doi' ? 'active' : ''}`}
      >
        <span className="dock-icon-wrap">
          <Icon name="heart" />
          {store.follows.length > 0 && <span className="dock-badge">{store.follows.length}</span>}
        </span>
        <span>Tủ sách</span>
      </Link>
      <Link
        href="/lich-su"
        className={`dock-item ${pathname === '/lich-su' ? 'active' : ''}`}
      >
        <span className="dock-icon-wrap">
          <Icon name="clock" />
          {store.history.length > 0 && <span className="dock-badge-dot"></span>}
        </span>
        <span>Lịch sử</span>
      </Link>
      <button
        type="button"
        className="dock-item"
        onClick={onOpenMobileMenu}
        aria-label="Menu mở rộng"
      >
        <Icon name="menu" />
        <span>Menu</span>
      </button>
    </nav>
  );
}
