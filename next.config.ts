import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
