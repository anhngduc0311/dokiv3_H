'use client';

import Image from 'next/image';
import { useState } from 'react';
import { canOptimizeCover } from '@/lib/cover-images';

export function CoverImage({ src, alt, eager = false, sizes = '(max-width: 600px) 45vw, (max-width: 1100px) 25vw, 200px' }: {
  src: string; alt: string; eager?: boolean; sizes?: string;
}) {
  const [fallback, setFallback] = useState(false);
  const [direct, setDirect] = useState(false);
  const source = fallback ? '/cover-placeholder.svg' : src || '/cover-placeholder.svg';
  const optimized = !direct && canOptimizeCover(source);
  return <Image src={source} alt={alt} width={240} height={360} sizes={sizes}
    loading={eager ? 'eager' : 'lazy'} fetchPriority={eager ? 'high' : 'auto'}
    className="loaded" decoding="async" referrerPolicy="no-referrer" unoptimized={!optimized}
    onError={() => {
      // Hotlink-protected sources can require a direct browser request.
      if (optimized && !fallback) setDirect(true); else setFallback(true);
    }} />;
}
