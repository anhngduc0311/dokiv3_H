import { pageMetadata } from '@/lib/seo';
export const metadata = pageMetadata({ title: 'Lịch sử đọc', path: '/lich-su', noindex: true });
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
