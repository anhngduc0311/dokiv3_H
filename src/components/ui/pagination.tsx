'use client';

import React from 'react';
import { Icon } from './icon';

export interface PaginationProps {
  page: number;
  total: number;
  size?: number;
  change: (n: number) => void;
  hover?: (n: number) => void;
}

export function Pagination({ page = 1, total = 0, size = 28, change, hover }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / size));

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
      <button
        type="button"
        className="pag-btn"
        disabled={page <= 1}
        onClick={() => change(page - 1)}
        onMouseEnter={() => onHover(page - 1)}
        onTouchStart={() => onHover(page - 1)}
        aria-label="Trang trước"
      >
        <Icon name="arrowLeft" />
      </button>

      {numbers.map(p => (
        <button
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
          <button
            type="button"
            className="pag-btn"
            onClick={() => change(totalPages)}
            onMouseEnter={() => onHover(totalPages)}
            onTouchStart={() => onHover(totalPages)}
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        type="button"
        className="pag-btn"
        disabled={page >= totalPages}
        onClick={() => change(page + 1)}
        onMouseEnter={() => onHover(page + 1)}
        onTouchStart={() => onHover(page + 1)}
        aria-label="Trang tiếp"
      >
        <Icon name="arrowRight" />
      </button>
    </nav>
  );
}
