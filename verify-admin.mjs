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

for (const [name, script] of [['admin.js', admin], ['managed-content.js', publicJS], ['main.js', main]]) {
  assert.doesNotThrow(() => new Script(script, {filename: name}));
}
for (const [, name] of admin.matchAll(/\$\('([\w-]+)'\)/g)) {
  assert.match(html, new RegExp(`id="${name}"`), `Missing administrator UI element #${name}`);
}
assert.match(html, /autocomplete="current-password"/);
assert.match(html, /name="source" value="file"/);
assert.match(html, /name="source" value="link"/);
assert.match(html, /src="\/admin\.js"/);
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
assert.match(publicJS, /is_published=eq.true/);
assert.match(publicJS, /if \(!response\.ok\) return;/);
assert.match(publicJS, /Keep the approved built-in original assets/);
console.log('PASS: admin markup bindings, JS syntax, site hooks, owner RLS policies, storage permissions and original artwork fallback.');
