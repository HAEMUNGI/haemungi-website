import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('./dist/analytics.js', import.meta.url), 'utf8');
const pageScript = readFileSync(new URL('./dist/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('./dist/index.html', import.meta.url), 'utf8');
const sql = readFileSync(new URL('./003_haemungi_analytics.sql', import.meta.url), 'utf8');

function makePage({ hostname = 'haemungi-little-world-2026.joseonghwun.chatgpt.site',
                    doNotTrack = '0', globalPrivacyControl = false,
                    referrer = 'https://www.threads.net/'} = {}) {
  const requests = [];
  const storage = new Map();
  const persistentStorage = new Map();
  const location = { protocol: 'https:', hostname, search: '', hash: '' };
  const window = {
    HAEMUNGI_CONTENT_CONFIG: {
      projectUrl: 'https://ayymgaddbsglwqxurlff.supabase.co',
      publishableKey: 'sb_publishable_test'
    },
    innerWidth: 420
  };
  const context = {
    window,
    document: { referrer },
    location,
    navigator: { doNotTrack, globalPrivacyControl, userAgent: 'Mozilla/5.0' },
    crypto: { randomUUID: () => '12345678-1234-4234-8234-123456789abc' },
    sessionStorage: {
      getItem: k => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, v),
      removeItem: k => storage.delete(k)
    },
    localStorage: {
      getItem: k => persistentStorage.get(k) ?? null,
      setItem: (k, v) => persistentStorage.set(k, v)
    },
    fetch: (url, options) => {
      requests.push({ endpoint: String(url), ...options, event: JSON.parse(options.body) });
      return Promise.resolve({ ok: true, status: 201 });
    },
    URL, URLSearchParams
  };
  vm.runInNewContext(script, context);
  return { analytics: window.HM_STATS, requests };
}

const live = makePage();
assert.equal(live.analytics.getStatus(), 'unset');
live.analytics.track('page_view', 'home');
assert.equal(live.requests.length, 0, 'No event may leave before opt-in');
assert.equal(live.analytics.setConsent(true), 'yes');
assert.equal(live.analytics.getStatus(), 'yes');
live.analytics.track('page_view', 'home');
live.analytics.track('page_view', 'home'); // Duplicate prevented.
live.analytics.track('goods_detail', 'goods', 'shirt');
live.analytics.track('card_view', 'cards', 'card-01');
live.analytics.track('room_spot', 'room', 'window');
live.analytics.track('goods_search', 'goods');
live.analytics.track('page_view', 'bogus'); // Unsupported page rejected.
live.analytics.track('goods_detail', 'goods', '../../unexpected'); // Slug rejected.

assert.equal(live.requests.length, 5);
assert.deepEqual(live.requests.map(r => r.event.event_type),
  ['page_view','goods_detail','card_view','room_spot','goods_search']);
assert(live.requests.every(r => r.event.source_kind === 'threads'));
assert(live.requests.every(r => r.event.device_kind === 'mobile'));
assert(live.requests.every(r => r.method === 'POST'));
assert(live.requests.every(r => r.endpoint.endsWith('/rest/v1/hm_view_events')));
assert(live.requests.every(r => !/email|search_query|ip_address|user_agent/.test(r.body)));
assert.equal(live.analytics.setConsent(false), 'no');
live.analytics.track('page_view', 'about');
assert.equal(live.requests.length, 5, 'Revoked consent must stop further events');

const optOut = makePage({ doNotTrack: '1' });
assert.equal(optOut.analytics.setConsent(true), 'unavailable');
optOut.analytics.track('page_view', 'home');
assert.equal(optOut.requests.length, 0);
const gpc = makePage({ globalPrivacyControl: true });
assert.equal(gpc.analytics.setConsent(true), 'unavailable');
gpc.analytics.track('page_view', 'home');
assert.equal(gpc.requests.length, 0);
const preview = makePage({ hostname: 'terminal.local' });
assert.equal(preview.analytics.setConsent(true), 'unavailable');
preview.analytics.track('page_view', 'home');
assert.equal(preview.requests.length, 0);

assert(html.indexOf('analytics.js') > html.indexOf('content-config.js'));
assert(html.indexOf('analytics.js') < html.indexOf('main.js'));
assert(html.includes('id="analyticsLauncher"'), 'Consent must be discoverable on every page');
assert(html.includes('id="analyticsConsent"'), 'Consent or blocking notice must have a panel');
assert(pageScript.includes("blockedNoticeDismissed"), 'Blocked browsers must see an explanatory notice');
assert(pageScript.includes('consentAllow.disabled = blocked'), 'Blocked browsers cannot be forced to track');
for (const name of ['page_view', 'goods_detail', 'card_view', 'room_spot',
                    'diary_view', 'artwork_open', 'goods_filter', 'goods_search']) {
  assert((pageScript + script).includes(`'${name}'`), `Missing UI event: ${name}`);
  assert(sql.includes(`'${name}'`), `Missing schema event: ${name}`);
}
assert(sql.includes('enable row level security'));
assert(sql.includes('grant insert (session_id, event_type, page, item_slug, device_kind, source_kind)'));
assert(!/grant\s+select\s+on\s+public\.hm_view_events/i.test(sql));
assert(sql.includes('security_invoker = true'));
assert(sql.includes('hm_rollup_page_view_trigger'));

console.log('HAEMUNGI consent analytics: zero pre-consent events, 5 allowed events, dedupe, refusal, revocation, DNT, GPC, preview suppression, RLS checks PASS.');
