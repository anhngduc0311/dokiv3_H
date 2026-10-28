import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { pageMetadata, serializeJsonLd } from '@/lib/seo';

const font = Be_Vietnam_Pro({ subsets: ['latin', 'vietnamese'], weight: ['400', '500', '600', '700', '800'], display: 'swap', variable: '--font-doki' });
import './globals.scss';
import { StoreProvider } from '../contexts/store-context';
import { AppShell } from '../components/layout/app-shell';

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'DokiHentai - Web Đọc Truyện Hentai, Manga 18+, Doujinshi Vietsub Online',
    text: 'DokiHentai - Website đọc truyện hentai, manga 18+, manhwa 18+, doujinshi vietsub tiếng Việt mới nhất, không quảng cáo, cập nhật mỗi ngày chất lượng full HD.',
    path: '/',
    adult: true,
  }),
  metadataBase: new URL('https://www.dokihentai.com'),
  icons: { icon: '/favicon.svg' },
  authors: [{ name: 'DokiHentai' }],
  category: 'manga',
  classification: 'Adult Entertainment',
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
      '@id': 'https://www.dokihentai.com/#website',
      url: 'https://www.dokihentai.com/',
      name: 'DokiHentai',
      alternateName: ['Doki Hentai', 'dokihentai', 'dokihentai.com', 'DokiHentai - Web Đọc Truyện Hentai Online'],
      description: 'Website đọc truyện hentai, manga 18+, manhwa 18+, doujinshi vietsub tiếng Việt mới nhất cập nhật mỗi ngày',
      publisher: {
        '@id': 'https://www.dokihentai.com/#organization'
      },
      isFamilyFriendly: false,
      potentialAction: [
        {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://www.dokihentai.com/tim-truyen-nang-cao?q={search_term_string}'
          },
          'query-input': 'required name=search_term_string'
        }
      ],
      inLanguage: 'vi-VN'
    },
    {
      '@type': 'Organization',
      '@id': 'https://www.dokihentai.com/#organization',
      name: 'DokiHentai',
      alternateName: ['Doki Hentai', 'dokihentai', 'dokihentai.com'],
      url: 'https://www.dokihentai.com/',
      logo: {
        '@type': 'ImageObject',
        url: 'https://www.dokihentai.com/brand-mark.png',
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
        <meta name="rating" content="RTA-5042-1996-1400-1577-RTA" />
        <meta name="rating" content="adult" />
        <meta name="RATING" content="RTA-5042-1996-1400-1577-RTA" />
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
