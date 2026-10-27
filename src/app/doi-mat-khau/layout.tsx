import { pageMetadata } from '@/lib/seo';
export const metadata = pageMetadata({ title: 'Đổi mật khẩu', path: '/doi-mat-khau', noindex: true });
export default function Layout({ children }: { children: React.ReactNode }) { return <>{children}</>; }
