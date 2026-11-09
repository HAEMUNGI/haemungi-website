import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const passport = read('./dist/world-passport.css');
const guide = read('./dist/byeolitda-guide.css');
const passportJs = read('./dist/world-passport.js');
const left = passport.match(/\.hm-passport-launcher\s*\{([^}]+)\}/)?.[1] ?? '';
const right = guide.match(/#byeolitdaGuideButton\s*\{([^}]+)\}/)?.[1] ?? '';

for (const [label, css] of [['여권', left], ['이용안내', right]]) {
  assert(css, label + ' 버튼 스타일 없음');
  for (const property of ['width', 'min-width', 'max-width']) {
    assert(new RegExp(property + '\\s*:\\s*106px').test(css), label + ' 너비 ' + property);
  }
  for (const property of ['height', 'min-height', 'max-height']) {
    assert(new RegExp(property + '\\s*:\\s*48px').test(css), label + ' 높이 ' + property);
  }
  assert(/gap\s*:\s*7px/.test(css), label + ' 아이콘 간격');
  assert(/border-radius\s*:\s*999px/.test(css), label + ' 모서리');
  assert(/background\s*:\s*#fffdfa/.test(css), label + ' 배경');
  assert(/bottom\s*:\s*max\(16px,\s*env\(safe-area-inset-bottom\)\)/.test(css), label + ' 하단 간격');
}
assert(left.includes('left:max(16px,env(safe-area-inset-left))'), '여권은 왼쪽 정렬');
assert(right.includes('right: max(16px, env(safe-area-inset-right))'), '안내는 오른쪽 정렬');
assert(passport.includes('left:max(12px,env(safe-area-inset-left))'), '여권 모바일 좌측 여백');
assert(guide.includes('right: max(12px, env(safe-area-inset-right))'), '안내 모바일 우측 여백');
assert(passportJs.includes('class="hm-passport-launcher-icon"'), '여권 아이콘 별도 정렬');
assert(guide.includes('#byeolitdaGuideButton span:first-child'), '안내 아이콘 별도 정렬');

const guidePages = ['index', 'memorial', 'temple', 'playground', 'memorial-walk',
  'leo-room', 'community', 'memorial-archive', 'memorial-communal', 'memorial-store',
  'memorial-adoption'];
for (const page of guidePages) {
  assert(read('./dist/' + page + '.html').includes('/byeolitda-guide.css?v=20261109-controls-v1'),
    page + ' 안내 버튼 스타일 캐시 갱신');
}
for (const page of ['index', 'memorial', 'temple', 'playground', 'christmas']) {
  const html = read('./dist/' + page + '.html');
  assert(html.includes('/world-passport.css?v=20261109-controls-v1'), page + ' 여권 스타일 캐시 갱신');
  assert(html.includes('/world-passport.js?v=20261109-controls-v1'), page + ' 여권 아이콘 캐시 갱신');
}
console.log('PASS floating buttons: identical 106×48px, icon gap/shape, mirrored safe-area positions and 11 guide/5 passport cache references.');
