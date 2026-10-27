import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { pageMetadata, serializeJsonLd } from '@/lib/seo';

const font = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700', '800'], display: 'swap', variable: '--font-doki' });
import './globals.scss';
import { StoreProvider } from '../contexts/store-context';
import { AppShell } from '../components/layout/app-shell';

export const metadata: Metadata = {
  ...pageMetadata({ title: 'Đọc truyện tranh tiếng Việt', path: '/' }),
  metadataBase: new URL('https://dokihentai.com'),
  icons: { icon: '/favicon.svg' },
  authors: [{ name: 'DokiHentai' }],
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
      '@id': 'https://dokihentai.com/#website',
      url: 'https://dokihentai.com/',
      name: 'DokiHentai',
      alternateName: ['Doki Hentai', 'dokihentai', 'dokihentai.com', 'DokiHentai'],
      description: 'Website đọc truyện tranh online miễn phí cập nhật mới nhất mỗi ngày',
      publisher: {
        '@id': 'https://dokihentai.com/#organization'
      },
      potentialAction: [
        {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://dokihentai.com/tim-truyen-nang-cao?q={search_term_string}'
          },
          'query-input': 'required name=search_term_string'
        }
      ],
      inLanguage: 'vi-VN'
    },
    {
      '@type': 'Organization',
      '@id': 'https://dokihentai.com/#organization',
      name: 'DokiHentai',
      alternateName: ['Doki Hentai', 'dokihentai', 'dokihentai.com'],
      url: 'https://dokihentai.com/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://dokihentai.com/brand-mark.png',
        caption: 'DokiHentai Logo'
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
    <html lang="vi" className={font.variable}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Đến nội dung chính</a>
        <StoreProvider>
          <AppShell>{children}</AppShell>
        </StoreProvider>
      </body>
    </html>
  );
}
