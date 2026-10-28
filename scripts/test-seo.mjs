import { test } from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual TS modules with isolated DB/catalog adapters, without
// connecting to production or calling its migration/seed functions.
function loader(overrides = {}) {
  const modules = new Map();
  function load(file) {
    file = path.resolve(file);
    if (modules.has(file)) return modules.get(file).exports;
    const loadedModule = { exports: {} };
    modules.set(file, loadedModule);
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = id => {
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id.startsWith('.') || id.startsWith('@/')) {
        const base = id.startsWith('@/') ? path.resolve('src', id.slice(2)) : path.resolve(path.dirname(file), id);
        const resolved = [base, `${base}.ts`, `${base}.tsx`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
        return load(resolved);
      }
      return require(id);
    };
    vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: file })(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return load;
}
const seo = loader()('src/lib/seo.ts');
const manga = { id: 'id/&', title: 'Tên truyện', author: 'Tác giả', description: '<p>Mô tả &amp; nội dung</p>', cover: '/cover.png', genres: ['Fantasy'], updatedAt: '2026-10-01', chapters: [], source: 'mimihentai', rating: 9 };

test('metadata uses per-manga canonical, matching OG/Twitter and clean description', () => {
  const meta = seo.mangaMetadata(manga);
  assert.equal(meta.alternates.canonical, 'https://www.dokihentai.com/truyen-tranh/id%2F%26');
  assert.equal(meta.openGraph.url, meta.alternates.canonical);
  assert.equal(meta.openGraph.description, 'Mô tả & nội dung');
  assert.equal(meta.twitter.images[0], 'https://www.dokihentai.com/cover.png');
  assert.equal(meta.other.rating, 'adult');
});
test('untrusted content cannot break out of a JSON-LD script', () => {
  const value = { title: '</script><script>alert(1)</script>' };
  const serialized = seo.serializeJsonLd(value);
  assert.ok(!serialized.includes('<'));
  assert.deepEqual(JSON.parse(serialized), value);
});
test('estimated ratings are never published as aggregateRating', () => {
  const schema = seo.mangaSchema(manga);
  assert.equal(schema['@type'], 'ComicSeries');
  assert.equal(schema.aggregateRating, undefined);
  assert.equal(schema.dateModified, '2026-10-01T00:00:00.000Z');
  assert.equal(seo.isoDate('invalid'), undefined);
});
test('pagination rejects malformed, fractional, negative and unsafe page numbers', () => {
  for (const value of ['-1', '0', 'NaN', '1.5', 'Infinity', '9007199254740992']) assert.equal(seo.pageNumber(value), 1);
  assert.equal(seo.pageNumber(['3', '8']), 3);
});
test('noindex pages remain followable', () => {
  const meta = seo.pageMetadata({ title: 'Tài khoản', path: '/dang-nhap', noindex: true });
  assert.equal(meta.robots.index, false);
  assert.equal(meta.robots.follow, true);
});
test('sitemap escapes XML, encodes IDs, and omits fabricated lastmod', async () => {
  const load = loader({ './db': { sql: async () => [{ prefix: '/truyen-tranh/', id: 'a&b', modified: '2026-10-01' }] } });
  const { GET } = load('src/app/sitemaps/[file]/route.ts');
  const response = await GET(new Request('https://attacker.example/sitemaps/0.xml'), { params: Promise.resolve({ file: '0.xml' }) });
  assert.equal(response.status, 200);
  const xml = await response.text();
  assert.match(xml, /https:\/\/www.dokihentai.com\/truyen-tranh\/a%26b/);
  const { urlset } = load('src/lib/sitemap.ts');
  assert.match(urlset([{ path: '/?a=1&b=2' }]), /&amp;b=2/);
  assert.ok(!urlset([{ path: '/' }]).includes('lastmod'));
});
test('sitemap index includes every shard beyond the old 1000-item cap', async () => {
  const load = loader({
    './db': { sql: async () => [{ total: 10001 }] },
    '@/lib/sitemap-catalog': { catalogSitemapPaths: async () => ['/sitemaps/catalog-0.xml', '/sitemaps/catalog-1.xml'] },
  });
  const { GET } = load('src/app/sitemap.xml/route.ts');
  const response = await GET();
  const xml = await response.text();
  assert.equal((xml.match(/<sitemap>/g) || []).length, 6);
  assert.match(xml, /sitemaps\/2.xml/);
  assert.match(xml, /sitemaps\/catalog-1.xml/);
});
test('DB failures return retryable 503 and never cache a partial sitemap', async () => {
  const load = loader({
    './db': { sql: async () => { throw new Error('offline'); } },
    '@/lib/sitemap-catalog': { catalogSitemapPaths: async () => [] },
  });
  const response = await load('src/app/sitemap.xml/route.ts').GET();
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('retry-after'), '300');
});
test('invalid sitemap names are rejected before any database query', async () => {
  const load = loader({ './db': { sql: () => { throw new Error('must not query'); } } });
  const { GET } = load('src/app/sitemaps/[file]/route.ts');
  for (const file of ['-1.xml', '01.xml', 'x.xml', '1.json', '999999999999999999.xml']) {
    const response = await GET(new Request('https://www.dokihentai.com'), { params: Promise.resolve({ file }) });
    assert.equal(response.status, 404);
  }
});
test('robots applies one consistent policy to all crawlers', () => {
  const robots = loader()('src/app/robots.ts').default();
  assert.equal(robots.rules.userAgent, '*');
  assert.ok(robots.rules.allow.includes('/api/catalog/image-proxy'));
  assert.equal(robots.sitemap, 'https://www.dokihentai.com/sitemap.xml');
  assert.ok(!robots.rules.disallow.includes('/dang-nhap'));
});

test('remote catalog is discoverable before any reader has saved it locally', async () => {
  const calls = [];
  const load = loader({
    './mimi-catalog': { getMimiSitemapPage: async page => {
      calls.push(page);
      return { total_items: 481, items: Array.from({ length: page <= 10 ? 48 : 1 },
        (_, i) => ({ id: (page - 1) * 48 + i + 1, last_updated: null })) };
    } },
    './db': { sql: async strings => {
      assert.match(strings.join(''), /^SELECT/);
      assert.match(strings.join(''), /"Id"::text = ANY/);
      return [{ Id: '1' }, { Id: '2' }];
    } },
  });
  const catalog = load('src/lib/sitemap-catalog.ts');
  assert.deepEqual(await catalog.catalogSitemapPaths(), ['/sitemaps/catalog-0.xml', '/sitemaps/catalog-1.xml']);
  calls.length = 0;
  const first = await catalog.catalogSitemapRows(0);
  assert.equal(first.length, 478);
  assert.equal(first[0].path, '/truyen-tranh/3');
  assert.equal(first.at(-1).path, '/truyen-tranh/480');
  assert.deepEqual(calls, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(await catalog.catalogSitemapRows(1), [{ path: '/truyen-tranh/481', modified: null }]);
});

test('catalog outage returns retryable 503 instead of publishing a partial index or shard', async () => {
  const load = loader({
    './db': { sql: async () => [{ total: 29 }] },
    '@/lib/sitemap-catalog': {
      CATALOG_SITEMAP_SIZE: 480,
      catalogSitemapPaths: async () => { throw new Error('upstream unavailable'); },
      catalogSitemapRows: async () => { throw new Error('upstream unavailable'); },
    },
  });
  const index = await load('src/app/sitemap.xml/route.ts').GET();
  const shard = await load('src/app/sitemaps/[file]/route.ts').GET(new Request('https://www.dokihentai.com'),
    { params: Promise.resolve({ file: 'catalog-0.xml' }) });
  for (const response of [index, shard]) {
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
});

test('a shard containing only locally moderated/stored stories remains valid XML', async () => {
  const load = loader({
    './db': { sql: async () => { throw new Error('must not query local shard'); } },
    '@/lib/sitemap-catalog': { CATALOG_SITEMAP_SIZE: 480, catalogSitemapRows: async () => [] },
  });
  const response = await load('src/app/sitemaps/[file]/route.ts').GET(new Request('https://www.dokihentai.com'),
    { params: Promise.resolve({ file: 'catalog-0.xml' }) });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /<urlset[^>]*><\/urlset>/);
});

test('strict sitemap adapter uses the real upstream page size and rejects incomplete responses', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      assert.match(url, /page=2&page_size=48&sort=title$/);
      return Response.json({ items: [{ id: 123 }], total_items: 49, page: 2, page_size: 48 });
    };
    const { getMimiSitemapPage } = loader()('src/lib/mimi-catalog.ts');
    assert.equal((await getMimiSitemapPage(2)).items[0].id, 123);
    globalThis.fetch = async () => Response.json({ items: [], page: 2, page_size: 48 });
    await assert.rejects(getMimiSitemapPage(2), /Invalid sitemap catalog response/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('manga content and chapter links exist in HTML before effects/JavaScript', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const load = loader({
    'next/navigation': { useParams: () => ({ id: manga.id }), useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/truyen-tranh/id' },
    'next/link': ({ children, prefetch, ...props }) => { void prefetch; return React.createElement('a', props, children); },
    '../../../contexts/store-context': { useStore: () => ({ settings: { language: 'vi' }, history: [], user: null, isFollowed: () => false }) },
    '../../../lib/api': { api: { getCached: () => null } },
    '../../../components/layout/sidebar': { Sidebar: () => null },
  });
  const Client = load('src/app/truyen-tranh/[id]/manga-client.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Client, { initialManga: { ...manga, follows: 0, chapters: [{ id: 'chapter-1', number: 1, title: 'Chương 1', language: 'vi', publishedAt: '2026-10-01' }] } }));
  assert.match(html, /<h1[^>]*>Tên truyện<\/h1>/);
  assert.match(html, /href="\/chuong\/chapter-1"/);
  assert.match(html, /Mô tả/);
  assert.ok(!html.includes('Đang tải thông tin'));
});

test('reader images are server rendered and visible without onLoad JavaScript', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const load = loader({
    'next/navigation': { useParams: () => ({ id: 'c1' }), useRouter: () => ({ push() {} }) },
    'next/link': ({ children, prefetch, ...props }) => { void prefetch; return React.createElement('a', props, children); },
    '../../../contexts/store-context': { useStore: () => ({ settings: { width: 900, dataSaver: false } }) },
    '../../../lib/api': { api: {} },
  });
  const Client = load('src/app/chuong/[id]/reader-client.tsx').default;
  const data = { manga, chapter: { id: 'c1', title: 'Chương 1', number: 1 }, pages: ['https://cdn.example/page1.jpg'], dataSaverPages: [], navigation: [] };
  const html = renderToStaticMarkup(React.createElement(Client, { initialData: data }));
  assert.match(html, /src="https:\/\/cdn.example\/page1.jpg"/);
  assert.ok(!html.includes('visibility:hidden'));
});

test('listing pagination emits crawlable anchors preserving filters', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const load = loader({
    'next/navigation': { usePathname: () => '/tim-truyen-nang-cao', useSearchParams: () => new URLSearchParams('genre=12&page=2') },
    'next/link': ({ children, prefetch, ...props }) => { void prefetch; return React.createElement('a', props, children); },
  });
  const { Pagination } = load('src/components/ui/pagination.tsx');
  const html = renderToStaticMarkup(React.createElement(Pagination, { page: 2, total: 100, size: 24, change() {} }));
  assert.match(html, /href="\/tim-truyen-nang-cao\?genre=12&amp;page=3" rel="next"/);
  assert.match(html, /href="\/tim-truyen-nang-cao\?genre=12" rel="prev"/);
});

test('chapter aliases redirect permanently to the resolved ID', async () => {
  const load = loader({
    'next/navigation': { notFound: () => { throw new Error('404'); }, permanentRedirect: url => { throw new Error(`308:${url}`); } },
    './reader-client': () => null,
    '@/lib/seo-data': { loadReader: async () => ({ manga, chapter: { id: 'real-id' } }) },
  });
  const page = load('src/app/chuong/[id]/page.tsx').default;
  await assert.rejects(page({ params: Promise.resolve({ id: '123_chap_1' }) }), /308:\/chuong\/real-id/);
});

test('missing manga metadata produces notFound rather than generic indexable metadata', async () => {
  const load = loader({
    'next/navigation': { notFound: () => { throw new Error('404'); } },
    './manga-client': () => null,
    '@/lib/seo-data': { loadManga: async () => null },
  });
  const { generateMetadata } = load('src/app/truyen-tranh/[id]/page.tsx');
  await assert.rejects(generateMetadata({ params: Promise.resolve({ id: 'missing' }) }), /404/);
});

test('cover optimization only accepts local assets and declared HTTPS hosts', () => {
  const { canOptimizeCover } = loader()('src/lib/cover-images.ts');
  assert.equal(canOptimizeCover('/cover.png'), true);
  assert.equal(canOptimizeCover('https://img.moe-cdn.net/cover.jpg'), true);
  for (const src of ['http://mimihentai.moe/x.jpg', 'https://mimihentai.moe.evil.example/x.jpg', '//evil.example/x.jpg', '/api/catalog/image-proxy?url=x', 'https://localhost:3000/x']) assert.equal(canOptimizeCover(src), false);
});

test('local stories with no public chapters never fall through to the upstream catalog', async () => {
  const load = loader({
    './db': { ensureDbInitialized: async () => {}, sql: async strings => strings.join('').includes('SELECT "SourceType"') ? [{ SourceType: 'manual', IsHidden: false, IsDraft: false }] : [] },
    './redis': { cacheGet: async () => null, cacheSet: async () => {} },
    './mimi-catalog': { getMimiChapters: () => { throw new Error('must not call upstream'); } },
  });
  const { getMangaChapters } = load('src/lib/catalog-service.ts');
  const result = await getMangaChapters('local');
  assert.equal(result.total, 0);
});

test('draft, hidden, locked and scheduled chapters cannot be served to public readers', async () => {
  for (const extra of [{ manga_hidden: true }, { manga_draft: true }, { IsLocked: true }, { ScheduledPublishAt: '2999-01-01' }, { PublishedAt: '2999-01-01' }]) {
    const load = loader({
      './db': { ensureDbInitialized: async () => {}, sql: async () => [{ PublishedAt: '2020-01-01', ...extra }] },
      './redis': { cacheGet: async () => null, cacheSet: async () => {} },
      './mimi-catalog': { getMimiReader: () => { throw new Error('must not call upstream'); } },
    });
    const { getChapterReader } = load('src/lib/catalog-service.ts');
    assert.equal(await getChapterReader('private'), null);
  }
});

test('empty SSR homepage starts the browser recovery request even on the same page', async () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const effects = [];
  const requests = [];
  const empty = { items: [], total: 0, page: 1, pageSize: 30 };
  const load = loader({
    react: { ...React, useEffect: effect => effects.push(effect) },
    'next/navigation': { useRouter: () => ({ push() {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/' },
    'next/link': ({ children, prefetch, ...props }) => { void prefetch; return React.createElement('a', props, children); },
    '../contexts/store-context': { useStore: () => ({ user: null, history: [], settings: {}, isFollowed: () => false }) },
    '../lib/api': { api: { getCached: () => null, prefetch() {}, request: async request => { requests.push(request); return empty; } } },
    '../components/layout/sidebar': { Sidebar: () => null },
  });
  const Client = load('src/app/home-client.tsx').default;
  const html = renderToStaticMarkup(React.createElement(Client, { initialCatalog: empty }));
  assert.ok(html.includes('Đang tải truyện…'));
  assert.ok(!html.includes('0 truyện'));
  for (const effect of effects) effect();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(requests.includes('/catalog/home?page=1&pageSize=30'));
});

test('browser fallback recovers real items when the production API returns an empty 200', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const recovered = { items: [manga], total: 32182, page: 1, pageSize: 30 };
  let fallbackCalls = 0;
  try {
    globalThis.window = {};
    globalThis.fetch = async () => Response.json({ items: [], total: 0, page: 1, pageSize: 30 });
    const load = loader({
      './utils': { getStoredToken: () => null },
      './mimi-client': { clientGetHome: async () => { fallbackCalls++; return recovered; } },
    });
    const { ApiClient } = load('src/lib/api.ts');
    const client = new ApiClient();
    const result = await client.request('/catalog/home?page=1&pageSize=30', 'GET', undefined, true);
    assert.equal(result.items.length, 1);
    assert.equal(result.total, 32182);
    assert.equal(fallbackCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  }
});

test('upstream failures in detail and reader metadata/pages preserve browser recovery', async () => {
  for (const kind of ['manga', 'reader']) {
    const load = loader({
      'next/navigation': { notFound: () => { throw new Error('unexpected 404'); } },
      './manga-client': () => null,
      './reader-client': () => null,
      '@/lib/seo-data': {
        loadManga: async () => { throw new Error('upstream unavailable'); },
        loadReader: async () => { throw new Error('upstream unavailable'); },
      },
    });
    const route = kind === 'manga' ? 'src/app/truyen-tranh/[id]/page.tsx' : 'src/app/chuong/[id]/page.tsx';
    const page = load(route);
    const props = { params: Promise.resolve({ id: '70756' }) };
    const meta = await page.generateMetadata(props);
    assert.equal(meta.robots.index, false);
    const recovery = await page.default(props);
    assert.equal(recovery.props[kind === 'manga' ? 'initialManga' : 'initialData'], null);
  }
});

test('detail and reader clients can render a loading shell without server data', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const load = loader({
    'next/navigation': { useParams: () => ({ id: '70756' }), useRouter: () => ({ push() {} }), usePathname: () => '/truyen-tranh/70756', useSearchParams: () => new URLSearchParams() },
    'next/link': ({ children, prefetch, ...props }) => { void prefetch; return React.createElement('a', props, children); },
    '../../../contexts/store-context': { useStore: () => ({ settings: { language: 'vi', width: 900 }, history: [], user: null }) },
    '../../../lib/api': { api: { getCached: () => null } },
    '../../../components/layout/sidebar': { Sidebar: () => null },
  });
  const Detail = load('src/app/truyen-tranh/[id]/manga-client.tsx').default;
  const Reader = load('src/app/chuong/[id]/reader-client.tsx').default;
  assert.match(renderToStaticMarkup(React.createElement(Detail, { initialManga: null })), /loading-panel|skeleton/);
  assert.match(renderToStaticMarkup(React.createElement(Reader, { initialData: null })), /loading-panel|skeleton|spinner/);
});

test('a failed chapter list does not discard an available manga detail', async () => {
  const load = loader({
    'next/navigation': { notFound: () => { throw new Error('unexpected 404'); } },
    './manga-client': () => null,
    '@/lib/seo-data': { loadManga: async () => manga, loadChapters: async () => { throw new Error('chapters unavailable'); }, clientManga: value => value },
  });
  const result = await load('src/app/truyen-tranh/[id]/page.tsx').default({ params: Promise.resolve({ id: manga.id }) });
  assert.equal(result.props.children[1].props.initialManga.id, manga.id);
});

test('detail API returns retryable 503 and the browser recovers from that response', async () => {
  const route = loader({ '@/lib/catalog-service': { getMangaDetail: async () => { throw new Error('upstream unavailable'); } } })('src/app/api/catalog/[id]/route.ts');
  const response = await route.GET(new Request('https://www.dokihentai.com/api/catalog/70756'), { params: Promise.resolve({ id: '70756' }) });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  try {
    globalThis.window = {};
    globalThis.fetch = async () => response.clone();
    const { ApiClient } = loader({ './utils': { getStoredToken: () => null }, './mimi-client': { clientGetDetail: async () => manga } })('src/lib/api.ts');
    assert.equal((await new ApiClient().request('/catalog/70756', 'GET', undefined, true)).id, manga.id);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
  }
});
