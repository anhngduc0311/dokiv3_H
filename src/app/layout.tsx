import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.scss';
import { StoreProvider } from '../contexts/store-context';
import { AppShell } from '../components/layout/app-shell';

export const metadata: Metadata = {
  title: 'DokiTruyen - Đọc Truyện Tranh Online Miễn Phí (Manga, Manhwa, Manhua Mới Nhất) | dokitruyen.com',
  description:
    '🔥 DokiTruyen (dokitruyen.com) - Trang web đọc truyện tranh online miễn phí cập nhật mới nhất mỗi ngày. Hơn 10,000+ bộ Manga, Manhwa, Manhua tiếng Việt Full HD load cực nhanh!',
  keywords:
    'dokitruyen, doki truyen, dokitruyen com, doc truyen tranh, truyen tranh online, manga, manhwa, manhua, doki truyện, truyen tranh moi nhat, doc manga full hd',
  authors: [{ name: 'DokiTruyen' }],
  metadataBase: new URL('https://dokitruyen.com'),
  icons: {
    icon: '/favicon.svg'
  },
  openGraph: {
    siteName: 'DokiTruyen',
    title: 'DokiTruyen - Đọc Truyện Tranh Online Miễn Phí Mới Nhất',
    description:
      '🔥 DokiTruyen (dokitruyen.com) - Trang đọc truyện tranh online miễn phí cập nhật mới nhất mỗi ngày. Đọc Manga, Manhwa, Manhua tiếng Việt Full HD load siêu mượt!',
    url: 'https://dokitruyen.com/',
    type: 'website',
    images: ['https://dokitruyen.com/brand-mark.png'],
    locale: 'vi_VN'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DokiTruyen - Đọc Truyện Tranh Online Miễn Phí Mới Nhất',
    description:
      '🔥 DokiTruyen (dokitruyen.com) - Khám phá và đọc hơn 10,000+ truyện tranh online miễn phí mỗi ngày.',
    images: ['https://dokitruyen.com/brand-mark.png']
  },
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large',
    'max-video-preview': -1
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': 'https://dokitruyen.com/#website',
      url: 'https://dokitruyen.com/',
      name: 'DokiTruyen',
      alternateName: ['Doki Truyện', 'dokitruyen', 'dokitruyen.com', 'DokiTruyện'],
      description: 'Website đọc truyện tranh online miễn phí cập nhật mới nhất mỗi ngày',
      publisher: {
        '@id': 'https://dokitruyen.com/#organization'
      },
      potentialAction: [
        {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://dokitruyen.com/tim-truyen-nang-cao?q={search_term_string}'
          },
          'query-input': 'required name=search_term_string'
        }
      ],
      inLanguage: 'vi-VN'
    },
    {
      '@type': 'Organization',
      '@id': 'https://dokitruyen.com/#organization',
      name: 'DokiTruyen',
      alternateName: ['Doki Truyện', 'dokitruyen', 'dokitruyen.com'],
      url: 'https://dokitruyen.com/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://dokitruyen.com/brand-mark.png',
        caption: 'DokiTruyen Logo'
      }
    }
  ]
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      </head>
      <body>
        <div id="app-splash" aria-hidden="true">
          <div className="splash-content">
            <div className="splash-logo-wrap">
              <div className="splash-glow"></div>
              <img
                className="splash-logo"
                src="/brand-mark.png"
                width={64}
                height={64}
                alt="DokiTruyen Logo"
              />
            </div>
            <div className="splash-brand">
              doki<span>truyen</span>
              <span className="splash-dot">.</span>
            </div>
            <div className="splash-loader">
              <div className="splash-progress"></div>
            </div>
          </div>
        </div>

        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
