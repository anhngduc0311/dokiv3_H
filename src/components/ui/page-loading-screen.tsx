export function PageLoadingScreen({ leaving = false }: { leaving?: boolean }) {
  return (
    <div id="app-splash" className={leaving ? 'fade-out' : undefined}
      role="status" aria-live="polite" aria-hidden={leaving || undefined}>
      <div className="splash-content">
        <div className="splash-logo-wrap" aria-hidden="true">
          <div className="splash-glow" />
          {/* The local logo is available without waiting for the cover CDN. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="splash-logo" src="/favicon.svg" alt="" width={64} height={64} />
        </div>
        <div className="splash-brand" aria-hidden="true">Doki<span>Hentai</span></div>
        <div className="splash-loader" aria-hidden="true"><div className="splash-progress" /></div>
        <p className="splash-caption">Đang tải truyện cho bạn…</p>
      </div>
    </div>
  );
}
