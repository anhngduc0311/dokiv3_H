'use client';

import { useEffect, useState } from 'react';
import { PageLoadingScreen } from './page-loading-screen';

export function HomeEntryLoader({ loading, failed }: { loading: boolean; failed: boolean }) {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!visible || loading) return;
    let cancelled = false;
    let fadeTimer: ReturnType<typeof setTimeout>;
    const cleanups: (() => void)[] = [];
    const finish = () => {
      if (cancelled) return;
      cancelled = true;
      setLeaving(true);
      fadeTimer = setTimeout(() => setVisible(false), 450);
    };
    // Wait for the first covers, but a slow image must not keep the page covered.
    const deadline = setTimeout(finish, failed ? 0 : 1800);
    const frame = requestAnimationFrame(() => {
      if (failed) { finish(); return; }
      const images = Array.from(document.querySelectorAll<HTMLImageElement>(
        '.home-page .spotlight-backdrop, .home-page .main-content-section .manga-grid img'
      )).slice(0, 7);
      const pending = images.filter(image => !image.complete);
      if (!pending.length) { finish(); return; }
      let remaining = pending.length;
      for (const image of pending) {
        const settled = () => {
          image.removeEventListener('load', settled);
          image.removeEventListener('error', settled);
          if (--remaining === 0) finish();
        };
        image.addEventListener('load', settled);
        image.addEventListener('error', settled);
        cleanups.push(() => {
          image.removeEventListener('load', settled);
          image.removeEventListener('error', settled);
        });
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      clearTimeout(deadline);
      clearTimeout(fadeTimer);
      cleanups.forEach(cleanup => cleanup());
    };
  }, [loading, failed, visible]);

  return visible ? <>
    <PageLoadingScreen leaving={leaving} />
    <noscript><style>{'#app-splash { display: none; }'}</style></noscript>
  </> : null;
}
