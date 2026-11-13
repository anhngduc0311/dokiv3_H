'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Header } from './header';
import { Footer } from './footer';
import { BottomDock } from './bottom-dock';
import { MobileSearchOverlay } from './mobile-search-overlay';
import { MobileDrawer } from './mobile-drawer';
import { GenresDropdown } from './genres-dropdown';
import { useStore } from '../../contexts/store-context';
import { api } from '../../lib/api';
import { Icon } from '../ui/icon';

const genreCollator = new Intl.Collator('vi', { sensitivity: 'base' });

export function AppShell({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const pathname = usePathname();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [genresOpen, setGenresOpen] = useState(false);
  const [drawerGenresOpen, setDrawerGenresOpen] = useState(false);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);

  const isReader = pathname.startsWith('/chuong/');
  const isAdmin = pathname.startsWith('/admin');

  // Share the genre data, while keeping the two menus independent.
  const loadGenres = async () => {
    if (tags.length === 0) {
      try {
        const res = await api.request<{ id: string; name: string }[]>('/catalog/tags');
        setTags([...(res ?? [])].sort((a, b) => genreCollator.compare(a.name, b.name)));
      } catch {
        store.notify('Không tải được thể loại. Vui lòng thử lại.');
      }
    }
  };

  const toggleGenres = () => {
    setGenresOpen(!genresOpen);
    if (!genresOpen) void loadGenres();
  };

  const toggleDrawerGenres = () => {
    setDrawerGenresOpen(!drawerGenresOpen);
    if (!drawerGenresOpen) void loadGenres();
  };

  const openMobileMenu = () => {
    setGenresOpen(false);
    setMobileMenuOpen(true);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setDrawerGenresOpen(false);
  };

  // Close menus on path changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    setGenresOpen(false);
    setDrawerGenresOpen(false);

    // Scroll restoration behavior like Angular app
    if (typeof window !== 'undefined') {
      const hasSavedHomeScroll =
        sessionStorage.getItem('home_scroll_y') || sessionStorage.getItem('home_manga_id');
      const isReturningHome = pathname === '/';
      if (!hasSavedHomeScroll || !isReturningHome) {
        window.scrollTo(0, 0);
      }
    }
  }, [pathname]);

  // Keyboard escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setMobileSearchOpen(false);
        setGenresOpen(false);
        setDrawerGenresOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isAdmin) {
    return (
      <>
        {children}
        {store.toast && (
          <div className="toast glass-panel" role="status">
            <Icon name="info" />
            <span>{store.toast}</span>
            <button aria-label="Đóng thông báo" onClick={store.clearToast}>
              ×
            </button>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {!isReader && (
        <Header
          onOpenMobileMenu={openMobileMenu}
          onOpenMobileSearch={() => setMobileSearchOpen(true)}
          genresOpen={genresOpen}
          onToggleGenres={toggleGenres}
          tags={tags}
        />
      )}

      {!isReader && (
        <>
          <MobileSearchOverlay
            isOpen={mobileSearchOpen}
            onClose={() => setMobileSearchOpen(false)}
          />
          <MobileDrawer
            isOpen={mobileMenuOpen}
            onClose={closeMobileMenu}
            genresOpen={drawerGenresOpen}
            onToggleGenres={toggleDrawerGenres}
            tags={tags}
          />
        </>
      )}

      <div className={`site-container ${isReader ? 'reader-container' : ''}`}>
        {!isReader && (
          <GenresDropdown
            isOpen={genresOpen}
            onClose={() => setGenresOpen(false)}
            tags={tags}
          />
        )}
        <main id="main-content" tabIndex={-1}>{children}</main>
      </div>

      {!isReader && (
        <>
          <Footer />
          <BottomDock onOpenMobileMenu={openMobileMenu} />
        </>
      )}

      {store.toast && (
        <div className="toast glass-panel" role="status">
          <Icon name="info" />
          <span>{store.toast}</span>
          <button aria-label="Đóng thông báo" onClick={store.clearToast}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
