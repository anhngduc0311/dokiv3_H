import AuthorClient from './[name]/author-client';
import { pageMetadata } from '@/lib/seo';

export const metadata = pageMetadata({ title: 'Tìm truyện theo tác giả', path: '/tac-gia' });
export default function AuthorsPage() { return <AuthorClient />; }
