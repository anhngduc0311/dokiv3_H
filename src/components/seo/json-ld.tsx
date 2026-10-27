import { serializeJsonLd } from '@/lib/seo';

export function JsonLd({ data }: { data: unknown[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({ '@context': 'https://schema.org', '@graph': data }) }} />;
}
