import { sitemapHeaders, urlset } from '@/lib/sitemap';

export function GET() {
  return new Response(urlset(['/', '/tac-gia', '/tim-truyen-nang-cao'].map(path => ({ path }))), { headers: sitemapHeaders });
}
