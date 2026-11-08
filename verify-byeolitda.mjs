import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';

const text = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const pages = {
  'dist/index.html': '별잇다',
  'dist/memorial.html': '<title>별잇다 |',
  'dist/memorial-walk.html': '기억의 산책길 | 별잇다',
  'dist/memorial-archive.html': '별들의 기록 | 별잇다',
  'dist/memorial-communal.html': '별잇다 공동 추모홀',
  'dist/memorial-adoption.html': '별잇다 추모공원',
  'dist/memorial-store.html': '별빛 펫 편의점 | 별잇다 추모공원',
  'dist/leo-room.html': '레오의 작은 일상 | 별잇다',
  'dist/memorial-privacy.html': '별잇다 · 개인정보',
  'dist/memorial-admin.html': '별잇다 관리실',
  'dist/admin.html': '별잇다 관리'
};
for (const [path, expected] of Object.entries(pages)) {
  assert(text(path).includes(expected), `Brand name missing from ${path}`);
}

const oldNames = [
  '별빛 추모관', '별빛 추모공원', '별빛 공동 추모홀',
  'STARLIGHT MEMORIAL', 'Starlight Memorial',
  'STARLIGHT COMMUNAL MEMORIAL', 'STARLIGHT MEMORY KIOSK', 'STARLIGHT MEMBERS'
];
const publicText = readdirSync(new URL('./dist/', import.meta.url))
  .filter(name => /\.(html|js|mjs|json|css|txt)$/.test(name));
for (const file of publicText) {
  const content = text('dist/' + file);
  for (const oldName of oldNames) {
    assert(!content.includes(oldName), `Old memorial brand still exposed: ${file}: ${oldName}`);
  }
}

const entry = text('dist/memorial.html');
const shop = text('dist/memorial-store.html');
const walk = text('dist/memorial-walk.html');
const passport = text('dist/world-passport.js');
const translations = text('dist/translations.js');
const communal = text('dist/memorial-communal.html');
assert(entry.includes('별빛 펫 편의점'), 'Pet store name must be preserved');
assert(shop.includes('✿ 별빛 펫 편의점'), 'Pet store signage must be preserved');
assert(shop.includes('STARLIGHT PET STORE'), 'Pet store English name must be preserved');
assert(walk.includes('별빛 펫 편의점'), 'Pet store journey label must be preserved');
assert(walk.includes('별빛 산책길'), 'Poetic walkway name must be preserved');
assert(passport.includes("['memorial','별잇다'"), 'Existing passport location id must be kept with new label');
assert(passport.includes("'/memorial.html'"), 'Passport memorial route must remain stable');
assert(entry.includes('href="/memorial-communal.html?tour=1"'), 'Communal hall route must remain stable');
assert(communal.includes('BYEOLITDA COMMUNAL MEMORIAL'), 'Communal hall English name must be updated');
assert(translations.includes('["별잇다","BYEOLITDA","BYEOLITDA","BYEOLITDA"]'), 'Four-language brand is inconsistent');
assert(text('dist/memorial-privacy.html').includes('별잇다는 등록된 반려동물'), 'Privacy disclosure must carry the new brand');

console.log(`PASS: BYEOLITDA branding on ${Object.keys(pages).length} screens, ${publicText.length} text files scanned, old names removed, pet store and journey preserved.`);
