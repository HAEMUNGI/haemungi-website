import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const file = name => readFileSync(new URL(name, import.meta.url), 'utf8');
const html = file('dist/admin.html');
const admin = file('dist/admin.js');
const publicJS = file('dist/managed-content.js');
const sql = file('admin-setup.sql');
const site = file('dist/index.html');
const main = file('dist/main.js');
const telemetry = file('dist/analytics.js');
const publishedVideo = file('dist/managed-content.js');
const stats = file('dist/admin-stats.js');
const reportGrants = file('005_haemungi_owner_analytics.sql');

for (const [name, script] of [['admin.js', admin], ['managed-content.js', publicJS], ['main.js', main], ['admin-stats.js', stats]]) {
  assert.doesNotThrow(() => new Script(script, {filename: name}));
}
for (const [, name] of admin.matchAll(/\$\('([\w-]+)'\)/g)) {
  assert.match(html, new RegExp(`id="${name}"`), `Missing administrator UI element #${name}`);
}
for (const [, name] of stats.matchAll(/\$\('([\w-]+)'\)/g)) {
  assert.match(html, new RegExp(`id="${name}"`), `Missing analytics UI element #${name}`);
}
assert.match(html, /autocomplete="current-password"/);
assert.match(html, /name="source" value="file"/);
assert.match(html, /name="source" value="link"/);
assert.match(html, /src="\/admin\.js"/);
assert.match(html, /src="\/admin-stats\.js"/);
assert.match(html, /id="analyticsView"/);
assert.match(html, /id="openAnalytics"/);
assert.match(html, /href="\/admin\.css"/);
assert.match(site, /managed-content\.js/);
assert.match(site, /managed-content\.css/);
assert.match(main, /HM_MANAGED_SET_CARD/);
assert.match(main, /HM_MANAGED_APPLY/);
assert.match(main, /HM_MANAGED_AUDIO_TOGGLE/);
for (const table of ['hm_admins', 'hm_media_public', 'hm_media_drafts']) {
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`));
}
assert.match(sql, /hm_media_public_read[\s\S]+?is_published or exists/);
assert.match(sql, /hm_media_drafts_select[\s\S]+?hm_admins/);
assert.match(sql, /hm_media_storage_insert[\s\S]+?bucket_id = 'hm-media' and exists/);
assert.match(sql, /create policy hm_admins_self/);
assert.doesNotMatch(sql + admin + publicJS + html, /service_role|sb_secret_[\w-]+/i,
  'Never expose privileged API credentials.');
assert.match(reportGrants, /create policy hm_events_owner_read/);
assert.match(reportGrants, /select 1 from public\.hm_admins/);
assert.match(reportGrants, /grant select on[\s\S]*public\.hm_stats_dashboard/);
assert.match(reportGrants, /from anon/);
assert.match(admin, /HM_ADMIN_REPORT_QUERY/);
assert.match(telemetry, /'video_play'/);
assert.match(publishedVideo, /track\('video_play', 'videos', row\.slot\)/);
assert.match(reportGrants, /hm_view_events_event_type_check/);
assert.match(reportGrants, /'video_play'/);
assert.match(stats, /aVideoRank/);
assert.match(publicJS, /is_published=eq.true/);
assert.match(publicJS, /if \(!response\.ok\) return;/);
assert.match(publicJS, /Keep the approved built-in original assets/);
console.log('PASS: content & analytics admin markup, JS syntax, owner-only RLS reports, safe original artwork fallback.');
