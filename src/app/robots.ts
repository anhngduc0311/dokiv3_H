import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: ['/', '/api/catalog/image-proxy'], disallow: ['/api/', '/admin/'] },
    // Account pages remain crawlable so bots can read their noindex metadata.
    sitemap: absoluteUrl('/sitemap.xml'),
  };
}
