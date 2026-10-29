import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('./dist/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('./dist/i18n.js', import.meta.url), 'utf8');
const main = readFileSync(new URL('./dist/main.js', import.meta.url), 'utf8');
const ctx = { window: {} };
vm.runInNewContext(readFileSync(new URL('./dist/translations.js', import.meta.url), 'utf8'), ctx);
const rows = ctx.window.HAEMUNGI_TRANSLATIONS;
const normalize = value => value.replace(/&nbsp;/g, ' ').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const source = new Set();
assert(rows.length >= 300, 'Language pack must cover the whole site, not only its menu');
for (const row of rows) {
  assert.equal(row.length, 4, 'Each entry must include Korean, English, Japanese and Chinese');
  assert(row.every(part => typeof part === 'string' && part.trim()), 'No blank translations');
  const key = normalize(row[0]);
  assert(!source.has(key), `Duplicate original phrase: ${key}`);
  source.add(key);
}
const visibleAndAccessible = [
  ...html.matchAll(/>([^<>]+)</g),
  ...html.matchAll(/(?:aria-label|alt|placeholder|title)="([^"]+)"/g)
].map(match => normalize(match[1])).filter(text => /[가-힣]/.test(text));
const exempt = new Set([
  '© HAEMUNGI · 일현 조성훈', '© 2026 HAEMUNGI · 일현 조성훈'
]);
const missing = [...new Set(visibleAndAccessible)].filter(text => !source.has(text) && !exempt.has(text));
assert.deepEqual(missing, [], `Untranslated page text: ${missing.join(' | ')}`);
const position = name => html.indexOf(name);
assert(position('id="languageSelector"') < position('id="musicButton"'), 'Language control must be left of music');
assert(position('src="main.js"') < position('src="translations.js"'));
assert(position('src="translations.js"') < position('src="i18n.js"'));
for (const lang of ['ko', 'en', 'ja', 'zh']) {
  assert(html.includes(`data-lang="${lang}"`));
}
for (const phrase of ['어느 날, 머리카락 한 올이 눈을 떴다.',
  '햇살 드는 창문', '헤뭉이 포근한 인형', '방문 통계 안내']) assert(source.has(phrase));
assert(script.includes('MutationObserver'), 'Dynamic Supabase and story updates need localization');
assert(script.includes('localStorage.setItem(STORAGE_KEY'), 'Visitor choice must persist');
assert(main.includes('const translatedName'), 'Translated product names must be searchable');
assert(!/translate\.google|translate\.googleapis|paid.translation|fetch\(/i.test(script),
  'Translations must work offline without exposing content to an external translator');
console.log(`PASS: 4 languages, ${rows.length} phrases, ${new Set(visibleAndAccessible).size} static text/alt/label values covered, dynamic updates, search and control order.`);
