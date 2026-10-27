import { pageMetadata } from '@/lib/seo';
export const metadata = pageMetadata({ title: 'Quản trị', path: '/admin', noindex: true });
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
