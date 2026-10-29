import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('.', import.meta.url).pathname;
const index = readFileSync(join(root, 'dist/index.html'), 'utf8');
const js = readFileSync(join(root, 'dist/main.js'), 'utf8');
const sql = readFileSync(join(root, '001_haemungi_world.sql'), 'utf8');
const config = readFileSync(join(root, 'dist/content-config.js'), 'utf8');
const instances = (body, regex) => [...body.matchAll(regex)];

assert.equal(instances(index, /class="goods-item"/g).length, 10, 'goods cards');
assert.equal(instances(index, /data-room-item="/g).length, 7, 'room hotspots');
assert.equal(instances(js.slice(js.indexOf('let storyData = ['), js.indexOf('].map((scene')), /\{ title:/g).length, 9, 'card-news stories');
assert.equal(instances(index, /class="diary-card"/g).length, 3, 'diary cards');

const sqlTables = instances(sql, /create table if not exists public\.(hm_[a-z_]+)/g).map(m => m[1]);
assert.equal(sqlTables.length, 8, 'database tables');
for (const table of sqlTables) {
  assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security;`), `${table}: RLS`);
}
for (const name of ['hm_daily_metrics', 'hm_social_drafts']) {
  assert.ok(!sql.includes(`create policy ${name}_read`), `${name}: no public read policy`);
}
assert.match(config, /publishableKey: 'sb_publishable_[a-zA-Z0-9_-]+'/, 'public Data API configured');
assert.ok(!config.includes('sb_secret_'), 'never ship a secret key to a browser');

const assetPaths = new Set(instances(sql, /assets\/[a-zA-Z0-9/_-]+\.(?:webp|png|jpg|jpeg)/g).map(m => m[0]));
for (const path of assetPaths) {
  assert.ok(existsSync(join(root, 'dist', path)), `missing asset: ${path}`);
}
assert.equal(assetPaths.size, 26, 'seeded asset registry');

console.log('PASS: 10 goods, 7 hotspots, 9 cards, 3 diaries, 8 RLS tables, 26 local media files.');
console.log('NOTE: local checks do not prove Supabase migration was executed or live REST reads work.');
