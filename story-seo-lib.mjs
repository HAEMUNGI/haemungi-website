// Read-only, server-rendered story archive for Cloudflare Pages Functions.
// Uses the SAME public publishable key as dist/content-config.js (never a service key).
export const SITE_ORIGIN = 'https://haemungi.pages.dev';
const SUPABASE_ORIGIN = 'https://ayymgaddbsglwqxurlff.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_xP2jaly3x1uFRS8aWi3AdA_YofHlA4E';
const MEDIA_BUCKET = 'hm-media';
const MAX_PAGE_SIZE = 500;
const MAX_PAGES = 10;

export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);
const safeMediaPath = path => /^(image)\/[a-z0-9-]+\.(png|jpg|jpeg|webp|avif)$/.test(path || '');
const safeStorySlug = slug => /^[a-z0-9][a-z0-9-]{0,79}$/.test(slug || '');
const cardPageMatch = slot => /^cardnews-([a-z0-9]+)-(\d{2})$/.exec(slot || '');
const storyKind = slot => {
  if (cardPageMatch(slot)) return 'cardnews';
  if (/^webtoon-[a-z0-9-]+$/.test(slot)) return 'webtoon';
  if (/^today-[a-z0-9-]+$/.test(slot)) return 'today';
  if (/^gallery-[a-z0-9-]+$/.test(slot)) return 'gallery';
  if (/^emoticon-[a-z0-9-]+$/.test(slot)) return 'emoticon';
  return '';
};
const kindLabel = {webtoon:'헤뭉이 일상다반사', today:'헤뭉이의 오늘', cardnews:'헤뭉이 카드뉴스', gallery:'헤뭉이 원화', emoticon:'헤뭉이 이모티콘'};

function imageUrl(row) {
  if (safeMediaPath(row.source_path))
    return `${SUPABASE_ORIGIN}/storage/v1/object/public/${MEDIA_BUCKET}/${row.source_path}`;
  try {
    const url = new URL(row.source_url);
    if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
  } catch (_) { /* No public image. */ }
  return '';
}
const safeISO = value => {
  const date = new Date(value || '');
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
};
const short = (value, length = 160) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, length);

/** Fetch only owner-published rows using public RLS. No drafts, no privileged access. */
export async function loadPublishedRows(fetchImpl = fetch) {
  const results = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${SUPABASE_ORIGIN}/rest/v1/hm_media_public`);
    url.searchParams.set('select', 'slot,kind,title,description,alt_text,source_path,source_url,is_published,updated_at');
    url.searchParams.set('is_published', 'eq.true');
    url.searchParams.set('kind', 'eq.image');
    url.searchParams.set('order', 'updated_at.desc,slot.asc');
    url.searchParams.set('limit', String(MAX_PAGE_SIZE));
    url.searchParams.set('offset', String(page * MAX_PAGE_SIZE));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetchImpl(url, {
        headers: {apikey: SUPABASE_PUBLISHABLE_KEY, Accept:'application/json'},
        signal:controller.signal
      });
      if (!response.ok) throw new Error(`Public catalog unavailable (${response.status})`);
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error('Unexpected public catalog response');
      results.push(...rows.filter(row => row && row.is_published === true && row.kind === 'image' &&
        typeof row.slot === 'string' && storyKind(row.slot)));
      if (rows.length < MAX_PAGE_SIZE) break;
    } finally { clearTimeout(timeout); }
  }
  return results;
}

export function groupStories(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row || row.is_published !== true || row.kind !== 'image') continue;
    const kind = storyKind(row.slot);
    if (!kind || !safeStorySlug(row.slot)) continue;
    const card = cardPageMatch(row.slot);
    const slug = card ? `cardnews-${card[1]}` : row.slot;
    if (!safeStorySlug(slug)) continue;
    const title = String(row.title || '').trim();
    const seriesTitle = card ? title.split(' · ')[0].trim() : title;
    const date = safeISO(row.updated_at);
    if (!groups.has(slug)) groups.set(slug, {
      slug, kind, label:kindLabel[kind], title:seriesTitle || kindLabel[kind],
      description:String(row.description || '').trim(), updatedAt:date, pages:[]
    });
    const group = groups.get(slug);
    if (date > group.updatedAt) group.updatedAt = date;
    if (!group.description && row.description) group.description = String(row.description).trim();
    group.pages.push({
      slot:row.slot, order:card ? Number(card[2]) : 1,
      image:imageUrl(row), alt:String(row.alt_text || title || group.title),
      title:card ? title.split(' · ').slice(1).join(' · ') : title
    });
  }
  return [...groups.values()].map(group => ({
    ...group, pages:group.pages.sort((a, b) => a.order - b.order),
    href:`/stories/${group.slug}`
  })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.slug.localeCompare(a.slug));
}

const makeJSONLD = data => JSON.stringify(data).replace(/[<>&]/g, char => ({'<':'\\u003c','>':'\\u003e','&':'\\u0026'})[char]);
const visibleDate = iso => iso ? new Intl.DateTimeFormat('ko-KR', {
  timeZone:'Asia/Seoul', year:'numeric',month:'long',day:'numeric'
}).format(new Date(iso)) : '';

function documentHTML({title, description, canonical, image, body, schema, noindex = false}) {
  const fullTitle = `${title} | HAEMUNGI`;
  const desc = short(description || title, 160);
  const fallbackImage = `${SITE_ORIGIN}/assets/haemungi-hero.webp`;
  const ogImage = image || fallbackImage;
  return `<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHTML(fullTitle)}</title>
<meta name="description" content="${escapeHTML(desc)}">
<meta name="robots" content="${noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'}">
<link rel="canonical" href="${escapeHTML(canonical)}">
<meta property="og:type" content="article"><meta property="og:site_name" content="HAEMUNGI">
<meta property="og:title" content="${escapeHTML(title)}"><meta property="og:description" content="${escapeHTML(desc)}">
<meta property="og:url" content="${escapeHTML(canonical)}"><meta property="og:image" content="${escapeHTML(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
${schema ? `<script type="application/ld+json">${makeJSONLD(schema)}</script>` : ''}
<style>
:root{font-family:system-ui,-apple-system,"Noto Sans KR",sans-serif;color:#4c3d35;background:#fcf7ef}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#fffaf4,#f9f1e8);min-height:100vh}
a{color:#805a46;text-decoration:none}a:hover{text-decoration:underline}a:focus-visible{outline:3px solid #d1a383;outline-offset:3px}
header,footer{background:#fffcf8;border-bottom:1px solid #ede1d4}header .inner,footer .inner{max-width:980px;margin:auto;padding:20px clamp(18px,4vw,36px)}
header .inner{display:flex;align-items:center;justify-content:space-between;gap:16px}header strong{color:#7f5746;letter-spacing:.1em}
header nav{display:flex;gap:15px;font-size:13px;flex-wrap:wrap}main{max-width:980px;margin:auto;padding:45px clamp(18px,4vw,36px) 80px}
.eyebrow{font-size:11px;color:#aa8166;letter-spacing:.18em;font-weight:800}.hero{text-align:center;margin-bottom:34px}
h1{font-family:Georgia,"Noto Serif KR",serif;font-size:clamp(29px,5vw,49px);line-height:1.4;color:#4d342b;margin:8px 0 16px}
h2{font-size:clamp(19px,3vw,26px);line-height:1.5;margin:0 0 14px}.intro{font-size:15px;line-height:1.9;color:#827063}
.archive-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:22px;margin-top:25px}
.story-card,.story-article{background:#fffcf9;border:1px solid #e9d7c7;border-radius:22px;box-shadow:0 15px 35px #8b674014;overflow:hidden}
.story-card>a{display:block}.story-card img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;background:#f5ebe0}
.story-card-copy{padding:20px 21px 25px}.story-card h2{margin:9px 0}.story-card p,.story-prose p{line-height:1.9;color:#78685c;overflow-wrap:anywhere}
.story-card p{font-size:14px;margin:0}.story-card small,.meta{font-size:12px;color:#9b8472}.story-prose{padding:24px clamp(20px,4vw,45px) 32px}
.story-prose p{white-space:pre-wrap;font-size:clamp(15px,2.3vw,18px);line-height:2.05;margin:0 0 24px}
.story-image{margin:0;background:#f5e9db}.story-image img{width:100%;height:auto;display:block}.story-image figcaption{padding:10px 20px;color:#867261;font-size:12px}
.image-archive{display:grid;gap:20px;padding:20px;max-width:800px;margin:auto}.image-archive img{max-height:1200px;width:100%;object-fit:contain;border-radius:12px}
.back{display:inline-block;margin-top:30px;padding:12px 18px;background:#f1e2d3;border-radius:30px;font-size:14px;font-weight:750}
footer{border-top:1px solid #ede1d4;border-bottom:0;text-align:center;color:#a18b78;font-size:12px;line-height:1.8}
@media(max-width:580px){header .inner{flex-direction:column;align-items:flex-start}main{padding-top:30px}.archive-grid{grid-template-columns:1fr}}
</style></head><body>
<header><div class="inner"><a href="/"><strong>✿ HAEMUNGI</strong></a><nav aria-label="이동"><a href="/">공식 홈페이지</a><a href="/stories">이야기 모음</a><a href="/#daily">일상다반사</a></nav></div></header>
<main>${body}</main>
<footer><div class="inner">작은 하루가 특별한 이야기가 되는 곳 · HAEMUNGI<br>이미지 및 캐릭터 디자인 © 2026 HAEMUNGI · 일현 조성훈. 무단 이용·재배포 금지.</div></footer>
</body></html>`;
}

export function renderArchive(stories) {
  const body = `<section class="hero"><p class="eyebrow">THE HAEMUNGI STORY ARCHIVE</p><h1>헤뭉이의 이야기 모음</h1>
    <p class="intro">작은 머리카락 한 올의 일상부터 특별한 모험까지.<br>그림과 함께 글로도 차곡차곡 기록합니다.</p></section>
    <section aria-label="공개된 이야기"><div class="archive-grid">${stories.map(story => {
      const cover = story.pages[0]?.image;
      return `<article class="story-card"><a href="${escapeHTML(story.href)}">${cover ? `<img src="${escapeHTML(cover)}" alt="${escapeHTML(story.pages[0].alt)}" loading="lazy">` : ''}
      <div class="story-card-copy"><small>${escapeHTML(story.label)}${story.updatedAt ? ` · ${escapeHTML(visibleDate(story.updatedAt))}` : ''}</small>
      <h2>${escapeHTML(story.title)}</h2><p>${escapeHTML(short(story.description || '헤뭉이의 새로운 이야기입니다.', 130))}</p></div></a></article>`;
    }).join('')}</div>${stories.length ? '' : '<p class="intro">아직 공개된 이야기가 없습니다. 새로운 이야기가 곧 찾아올 거예요.</p>'}</section>`;
  return documentHTML({title:'헤뭉이 이야기 아카이브',description:'헤뭉이의 오늘, 일상다반사 웹툰, 카드뉴스를 그림과 글로 읽는 공식 이야기 보관함.',
    canonical:`${SITE_ORIGIN}/stories`,body,
    schema:{'@context':'https://schema.org','@type':'CollectionPage',name:'헤뭉이 이야기 아카이브',url:`${SITE_ORIGIN}/stories`}});
}

export function renderStory(story) {
  const canonical = `${SITE_ORIGIN}${story.href}`;
  const images = story.pages.map((page, index) => page.image ? `<figure class="story-image"><img src="${escapeHTML(page.image)}" alt="${escapeHTML(page.alt)}" loading="${index ? 'lazy' : 'eager'}">${story.pages.length > 1 ? `<figcaption>${index + 1} / ${story.pages.length} · ${escapeHTML(page.title || story.title)}</figcaption>` : ''}</figure>` : '').join('');
  const body = `<article class="story-article"><div class="story-prose"><p class="eyebrow">${escapeHTML(story.label)}</p>
    <h1>${escapeHTML(story.title)}</h1>${story.updatedAt ? `<p class="meta">최근 수정 ${escapeHTML(visibleDate(story.updatedAt))}</p>` : ''}</div>
    <div class="image-archive">${images}</div>
    <div class="story-prose"><h2>이야기</h2><p>${escapeHTML(story.description || `${story.title}. 헤뭉이의 작은 일상을 그림으로 만나보세요.`)}</p></div></article>
    <a class="back" href="/stories">← 이야기 모음으로 돌아가기</a>`;
  const image = story.pages.find(page => page.image)?.image;
  return documentHTML({title:story.title,description:story.description || story.title,canonical,image,body,
    schema:{'@context':'https://schema.org','@type':'Article',headline:story.title,description:short(story.description || story.title, 400),
      mainEntityOfPage:canonical,url:canonical,author:{'@type':'Person',name:'일현 조성훈'},
      publisher:{'@type':'Organization',name:'HAEMUNGI',url:SITE_ORIGIN},
      ...(image ? {image:story.pages.filter(page => page.image).map(page => page.image)} : {}),
      ...(story.updatedAt ? {dateModified:story.updatedAt} : {})}});
}

export function renderNotFound() {
  return documentHTML({title:'이야기를 찾을 수 없어요',description:'공개되지 않았거나 존재하지 않는 헤뭉이 이야기입니다.',
    canonical:`${SITE_ORIGIN}/stories`,noindex:true,
    body:'<section class="hero"><h1>아직 만나볼 수 없는 이야기예요.</h1><p class="intro">공개된 다른 이야기를 둘러보세요.</p><a class="back" href="/stories">이야기 모음 보기</a></section>'});
}

export function renderUnavailable() {
  return documentHTML({title:'잠시 후 다시 만나요',description:'헤뭉이의 이야기를 불러오는 중입니다.',
    canonical:`${SITE_ORIGIN}/stories`,noindex:true,
    body:'<section class="hero"><h1>잠시만 기다려 주세요.</h1><p class="intro">이야기 보관함 연결이 잠시 느려졌어요. 조금 후 다시 열어주세요.</p></section>'});
}

export const htmlResponse = (html, status = 200, method = 'GET') => new Response(method === 'HEAD' ? null : html, {
  status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=0, s-maxage=60',
    'X-Content-Type-Options':'nosniff',...(status === 503 ? {'Retry-After':'60'} : {})}
});

export function renderSitemap(stories) {
  const urls = [{loc:SITE_ORIGIN+'/'},{loc:SITE_ORIGIN+'/stories'}, {loc:SITE_ORIGIN+'/playground'},
    ...stories.map(story => ({loc:SITE_ORIGIN+story.href, lastmod:story.updatedAt}))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(item => `  <url><loc>${escapeHTML(item.loc)}</loc>${item.lastmod ? `<lastmod>${escapeHTML(item.lastmod)}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>`;
}

export const xmlResponse = (xml, status = 200, method = 'GET') => new Response(method === 'HEAD' ? null : xml, {
  status,headers:{'Content-Type':'application/xml; charset=utf-8',
    'Cache-Control':'public, max-age=0, s-maxage=60',
    ...(status === 503 ? {'Retry-After':'60'} : {})}
});
