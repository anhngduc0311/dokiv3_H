import type { NextConfig } from 'next';
import { COVER_HOSTS } from './src/lib/cover-images';

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: COVER_HOSTS.flatMap(hostname => [
      { protocol: 'https' as const, hostname, port: '' },
      { protocol: 'https' as const, hostname: `**.${hostname}`, port: '' },
    ]),
  },
  async redirects() {
    return [
      { source: '/nettrom', destination: '/', permanent: true },
      { source: '/nettrom/tim-truyen-nang-cao', destination: '/tim-truyen-nang-cao', permanent: true },
      { source: '/nettrom/truyen-tranh/:id', destination: '/truyen-tranh/:id', permanent: true },
      { source: '/nettrom/chuong/:id', destination: '/chuong/:id', permanent: true },
      { source: '/nettrom/theo-doi', destination: '/theo-doi', permanent: true },
      { source: '/nettrom/lich-su', destination: '/lich-su', permanent: true },
    ];
  },
};

export default nextConfig;
