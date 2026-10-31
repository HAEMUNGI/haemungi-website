import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadPublishedRows, groupStories, renderArchive, renderStory, renderSitemap} from './story-seo-lib.mjs';
import {onRequest as archiveRoute} from './functions/stories/index.js';
import {onRequest as detailRoute} from './functions/stories/[slug].js';
import {onRequest as sitemapRoute} from './functions/sitemap.xml.js';

const file = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const cfg = file('dist/content-config.js');
const backend = file('story-seo-lib.mjs');
const keyInConfig = /publishableKey: '([^']+)'/.exec(cfg)?.[1];
assert(keyInConfig?.startsWith('sb_publishable_'));
assert(backend.includes(keyInConfig), 'Server reader must use the same public key as the browser');
assert.doesNotMatch(backend, /service_role|sb_secret_/);
assert.match(file('admin-setup.sql'), /hm_media_public_read on public\.hm_media_public[\s\S]+?using \(is_published\)/);

const data = [
  {slot:'webtoon-20261101-kimjang',kind:'image',title:'김장하는 헤뭉이',description:'겨울이 다가와요.\n헤뭉이가 배추를 씻었어요!',
    alt_text:'김장하는 헤뭉이 8컷',source_path:'image/123abc.webp',source_url:null,is_published:true,updated_at:'2026-11-01T00:15:00Z'},
  {slot:'today-halloween',kind:'image',title:'할로윈',description:'포근한 귀신 친구들',
    alt_text:'',source_path:'image/456def.jpg',source_url:null,is_published:true,updated_at:'2026-10-31T10:00:00Z'},
  {slot:'cardnews-mh123abc-01',kind:'image',title:'11월의 첫날 · 첫 장',description:'첫 손님이 찾아왔다.',
    alt_text:'첫 손님',source_path:'image/abc111.webp',source_url:null,is_published:true,updated_at:'2026-11-01T01:00:00Z'},
  {slot:'cardnews-mh123abc-02',kind:'image',title:'11월의 첫날 · 둘째 장',description:'첫 손님이 찾아왔다.',
    alt_text:'둘째 장',source_path:'image/abc222.webp',source_url:null,is_published:true,updated_at:'2026-11-01T01:00:00Z'},
  {slot:'today-hidden',kind:'image',title:'비공개 원고',description:'비공개 내용 노출 금지',
    source_path:'image/abc333.webp',is_published:false,updated_at:'2026-11-01T01:05:00Z'},
  {slot:'goods-new-mug',kind:'image',title:'굿즈',description:'상품',source_path:'image/abc333.webp',is_published:true},
  {slot:'webtoon-malformed',kind:'video',title:'영상',description:'영상',source_url:'https://example.com/video',is_published:true}
];
let apiQueries = 0;
const mockFetch = async (url, options) => {
  apiQueries++;
  const query = new URL(url);
  assert.equal(query.pathname, '/rest/v1/hm_media_public');
  assert.equal(query.searchParams.get('is_published'), 'eq.true');
  assert.equal(query.searchParams.get('kind'), 'eq.image');
  assert.equal(options.headers.apikey, keyInConfig);
  assert(!('Authorization' in options.headers), 'Never send admin credentials for public reads');
  return new Response(JSON.stringify(data.filter(row => row.is_published && row.kind === 'image')),
    {headers:{'Content-Type':'application/json'}});
};

const rows = await loadPublishedRows(mockFetch);
assert.equal(apiQueries, 1);
const stories = groupStories(rows);
assert.equal(stories.length, 3, 'One card series is one indexable story');
assert(!JSON.stringify(stories).includes('비공개'));
assert(!JSON.stringify(stories).includes('굿즈'));
assert.deepEqual(stories.find(row => row.slug === 'cardnews-mh123abc').pages.map(page => page.order), [1, 2]);
const archive = renderArchive(stories);
assert.match(archive, /<h1>헤뭉이의 이야기 모음<\/h1>/);
assert.match(archive, /href="\/stories\/webtoon-20261101-kimjang"/);
assert.match(archive, /<meta name="robots" content="index,follow/);
assert.match(archive, /application\/ld\+json/);
const body = renderStory(stories.find(row => row.slug === 'webtoon-20261101-kimjang'));
assert.match(body, /<h1>김장하는 헤뭉이<\/h1>/);
assert.match(body, /겨울이 다가와요/);
assert.match(body, /<link rel="canonical" href="https:\/\/haemungi.pages.dev\/stories\/webtoon-20261101-kimjang">/);
assert.match(body, /<meta property="og:title" content="김장하는 헤뭉이">/);
assert.match(body, /"@type":"Article"/);

const hostile = groupStories([{slot:'today-xss',kind:'image',is_published:true,title:'</title><script>alert(1)</script>',
  description:'</script><script>alert(2)</script>',source_path:'image/abc000.webp',updated_at:'2026-11-01T00:00:00Z'}]);
const safeHTML = renderStory(hostile[0]);
assert.doesNotMatch(safeHTML, /<script>alert\([12]\)<\/script>/, 'Story text must be HTML-escaped');
assert.match(safeHTML, /&lt;script&gt;/);
const sitemap = renderSitemap(stories);
assert.match(sitemap, /<loc>https:\/\/haemungi.pages.dev\/stories\/webtoon-20261101-kimjang<\/loc>/);
assert.doesNotMatch(sitemap, /today-hidden/);

const routes = JSON.parse(file('dist/_routes.json'));
assert.deepEqual(routes.include, ['/stories','/stories/*','/sitemap.xml']);
assert(!routes.include.includes('/*'), 'Keep free static requests outside the Function');
assert.match(file('dist/robots.txt'), /Sitemap: https:\/\/haemungi.pages.dev\/sitemap.xml/);
assert.match(file('dist/index.html'), /href="\/stories"/);
assert.match(file('dist/managed-content.js'), /\/stories\/\$\{encodeURIComponent\(row\.slot\)\}/);

const previousFetch = globalThis.fetch;
try {
  globalThis.fetch = mockFetch;
  const index = await archiveRoute({request:{method:'GET'}});
  assert.equal(index.status, 200);
  assert.match(await index.text(), /김장하는 헤뭉이/);
  const found = await detailRoute({request:{method:'GET'},params:{slug:'webtoon-20261101-kimjang'}});
  assert.equal(found.status, 200);
  assert.match(await found.text(), /겨울이 다가와요/);
  const hidden = await detailRoute({request:{method:'GET'},params:{slug:'today-hidden'}});
  assert.equal(hidden.status, 404);
  assert.match(await hidden.text(), /noindex,nofollow/);
  assert.equal((await detailRoute({request:{method:'GET'},params:{slug:'../admin'}})).status, 404);
  assert.equal((await detailRoute({request:{method:'POST'},params:{slug:'today-halloween'}})).status, 405);
  const head = await detailRoute({request:{method:'HEAD'},params:{slug:'today-halloween'}});
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const xml = await sitemapRoute({request:{method:'GET'}});
  assert.equal(xml.status, 200);
  assert.match(await xml.text(), /<urlset/);
  globalThis.fetch = async () => new Response('upstream error', {status:500});
  const previousError = console.error;
  try {
    console.error = () => {}; // Expected mock outage must not pollute CI with a false alarm.
    const unavailable = await archiveRoute({request:{method:'GET'}});
    assert.equal(unavailable.status, 503);
    assert.match(await unavailable.text(), /noindex,nofollow/);
  } finally { console.error = previousError; }
} finally { globalThis.fetch = previousFetch; }

console.log('PASS: SEO archive, article HTML, published-only visibility, card-series grouping, sitemap, slug safety, XSS escaping, 404/503, HEAD, static-route exclusions.');
