'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from '../ui/icon';

export interface GenresDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  tags: { id: string; name: string }[];
}

export function GenresDropdown({ isOpen, onClose, tags }: GenresDropdownProps) {
  if (!isOpen) return null;

  return (
    <div className="genre-dropdown glass-panel">
      <div className="genre-dropdown-header">
        <span>
          <Icon name="tag" /> Tất cả thể loại truyện
        </span>
        <button type="button" className="icon-button" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      <div className="genre-tags-grid">
        {tags.map(t => (
          <Link
            key={t.id}
            href={`/tim-truyen-nang-cao?genre=${t.id}`}
            onClick={onClose}
            className={t.name.toLowerCase() === 'romance' ? 'tag-romance' : ''}
          >
            {t.name}
          </Link>
        ))}
      </div>
      {tags.length === 0 && <p className="muted">Đang tải danh sách thể loại…</p>}
    </div>
  );
}
