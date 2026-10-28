import AuthorClient from './[name]/author-client';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({
  title: 'Tác Giả Truyện Hentai - Danh Sách Họa Sĩ & Nhóm Dịch',
  text: 'Tổng hợp danh sách các tác giả truyện hentai, doujinshi, manga 18+ nổi tiếng kèm danh sách các bộ truyện mới nhất tại DokiHentai.',
  path: '/tac-gia',
  adult: true,
  keywords: ['tác giả hentai', 'họa sĩ hentai', 'danh sách tác giả hentai', 'truyện hentai', 'dokihentai']
});
export default function AuthorsPage() { return <AuthorClient />; }
