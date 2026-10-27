import { absoluteUrl } from '@/lib/seo';

export function GET() { return Response.redirect(absoluteUrl('/sitemap.xml'), 308); }
