'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Icon } from '../ui/icon';

export interface GenresDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  tags: { id: string; name: string }[];
}

export function GenresDropdown({ isOpen, onClose, tags }: GenresDropdownProps) {
  const [filterText, setFilterText] = useState('');

  const filteredTags = useMemo(() => {
    if (!filterText.trim()) return tags;
    const q = filterText.trim().toLowerCase();
    return tags.filter(t => t.name.toLowerCase().includes(q));
  }, [tags, filterText]);

  if (!isOpen) return null;

  return (
    <div
      className="genre-dropdown glass-panel"
      style={{
        maxHeight: '75vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.6)'
      }}
    >
      <div className="genre-dropdown-header" style={{ flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 240 }}>
          <span>
            <Icon name="tag" /> Tất cả thể loại ({tags.length})
          </span>
          <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
            <input
              type="search"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Lọc thể loại nhanh…"
              style={{
                width: '100%',
                padding: '5px 28px 5px 12px',
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
                aria-label="Xóa tìm kiếm"
              >
                ×
              </button>
            )}
          </div>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng bảng thể loại">
          <Icon name="close" />
        </button>
      </div>

      <div
        className="genre-tags-grid"
        style={{
          overflowY: 'auto',
          paddingRight: '6px',
          flex: 1
        }}
      >
        {filteredTags.map(t => (
          <Link
            key={t.id}
            href={`/tim-truyen-nang-cao?genre=${t.id}`}
            onClick={onClose}
          >
            {t.name}
          </Link>
        ))}
      </div>

      {tags.length === 0 && <p className="muted" style={{ padding: '12px 0' }}>Đang tải danh sách thể loại…</p>}
      {tags.length > 0 && filteredTags.length === 0 && (
        <p className="muted" style={{ padding: '16px 0', textAlign: 'center' }}>
          Không tìm thấy thể loại nào khớp với "{filterText}".
        </p>
      )}
    </div>
  );
}
