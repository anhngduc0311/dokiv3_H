import { pageMetadata } from '@/lib/seo';
import Script from 'next/script';
export const metadata = pageMetadata({ title: 'Đăng nhập', path: '/dang-nhap', noindex: true });
export default function Layout({ children }: { children: React.ReactNode }) { return <><Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />{children}</>; }
