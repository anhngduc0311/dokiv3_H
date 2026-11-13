'use client';

import React from 'react';
import { Icon } from './icon';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export interface PaginationProps {
  page: number;
  total: number;
  size?: number;
  change: (n: number) => void;
  hover?: (n: number) => void;
  clientOnly?: boolean;
}

export function Pagination({ page = 1, total = 0, size = 28, change, hover, clientOnly = false }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const crawlable = pathname === '/' || pathname === '/tim-truyen-nang-cao' || pathname.startsWith('/tac-gia/');
  const pageHref = (n: number) => {
    const query = new URLSearchParams(searchParams.toString());
    if (n === 1) query.delete('page'); else query.set('page', String(n));
    return `${pathname}${query.size ? `?${query}` : ''}`;
  };
  const totalPages = Math.max(1, Math.ceil(total / size));
  // Preserve real URLs and new-tab clicks while letting the home update its list.
  const navigate = (n: number) => clientOnly ? (event: { preventDefault: () => void }) => {
    event.preventDefault();
    change(n);
  } : undefined;

  const onHover = (n: number) => {
    if (hover && n >= 1 && n <= totalPages && n !== page) {
      hover(n);
    }
  };

  const start = Math.max(1, page - 2);
  const count = Math.max(0, Math.min(start + 4, totalPages) - start + 1);
  const numbers = Array.from({ length: count }, (_, i) => start + i);

  return (
    <nav className="pagination" aria-label="Phân trang">
      {crawlable && page > 1 ? <Link className="pag-btn" href={pageHref(page - 1)} rel="prev" aria-label="Trang trước" prefetch={false} onNavigate={navigate(page - 1)} onMouseEnter={() => onHover(page - 1)} onTouchStart={() => onHover(page - 1)}><Icon name="arrowLeft" /></Link> : <button
        type="button"
        className="pag-btn"
        disabled={page <= 1}
        onClick={() => change(page - 1)}
        onMouseEnter={() => onHover(page - 1)}
        onTouchStart={() => onHover(page - 1)}
        aria-label="Trang trước"
      >
        <Icon name="arrowLeft" />
      </button>}

      {numbers.map(p => (
        crawlable ? <Link key={p} className={`pag-btn ${page === p ? 'active' : ''}`} href={pageHref(p)} aria-current={page === p ? 'page' : undefined} prefetch={false} onNavigate={navigate(p)} onMouseEnter={() => onHover(p)} onTouchStart={() => onHover(p)}>{p}</Link> : <button
          key={p}
          type="button"
          className={`pag-btn ${page === p ? 'active' : ''}`}
          aria-current={page === p ? 'page' : undefined}
          onClick={() => change(p)}
          onMouseEnter={() => onHover(p)}
          onTouchStart={() => onHover(p)}
        >
          {p}
        </button>
      ))}

      {totalPages > page + 2 && (
        <>
          <span className="pag-ellipsis">…</span>
          {crawlable ? <Link className="pag-btn" href={pageHref(totalPages)} prefetch={false} onNavigate={navigate(totalPages)} onMouseEnter={() => onHover(totalPages)} onTouchStart={() => onHover(totalPages)}>{totalPages}</Link> : <button
            type="button"
            className="pag-btn"
            onClick={() => change(totalPages)}
            onMouseEnter={() => onHover(totalPages)}
            onTouchStart={() => onHover(totalPages)}
          >
            {totalPages}
          </button>}
        </>
      )}

      {crawlable && page < totalPages ? <Link className="pag-btn" href={pageHref(page + 1)} rel="next" aria-label="Trang tiếp" prefetch={false} onNavigate={navigate(page + 1)} onMouseEnter={() => onHover(page + 1)} onTouchStart={() => onHover(page + 1)}><Icon name="arrowRight" /></Link> : <button
        type="button"
        className="pag-btn"
        disabled={page >= totalPages}
        onClick={() => change(page + 1)}
        onMouseEnter={() => onHover(page + 1)}
        onTouchStart={() => onHover(page + 1)}
        aria-label="Trang tiếp"
      >
        <Icon name="arrowRight" />
      </button>}
    </nav>
  );
}
