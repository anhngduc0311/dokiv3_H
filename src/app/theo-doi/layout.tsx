import { pageMetadata } from '@/lib/seo';
export const metadata = pageMetadata({ title: 'Truyện theo dõi', path: '/theo-doi', noindex: true });
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
