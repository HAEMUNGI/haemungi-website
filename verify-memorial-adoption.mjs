import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';

const html=readFileSync('dist/memorial-adoption.html','utf8');
const css=readFileSync('dist/memorial-adoption.css','utf8');
const entry=readFileSync('dist/memorial.html','utf8');
const workflow=readFileSync('.github/workflows/cloudflare-pages.yml','utf8');
const artPath='dist/memorial/adoption-board-hall-20261106.jpg';
const artwork=readFileSync(artPath);
const expectedLinks=[
  'https://www.animal.go.kr/',
  'https://pawinhand.kr/',
  'https://www.daejeon.go.kr/ani/index.do',
  'https://www.jeju.go.kr/shelter/index.htm',
  'https://www.gyeongju.go.kr/animallove/index.do',
  'https://dima.tools/gov_links/animal-shelter-search/',
  'tel:15770954'
];

assert.match(entry,/href="\/memorial-adoption\.html"/,'Memorial chooser must open the new hall');
assert.match(html,/src="\/memorial\/adoption-board-hall-20261106\.jpg"/);
assert.match(html,/width="864" height="1536"/,'Preserve original 9:16 artwork dimensions');
assert.match(css,/\.artwork>img\{[^}]*width:100%;height:auto/,'Do not crop the illustration');
assert.match(css,/\.board-hotspot\{[^}]*position:absolute/);
assert.match(workflow,/node verify-memorial-adoption\.mjs/);
assert.ok(statSync(artPath).size>300_000,'The full illustration must be present');
assert.equal(createHash('sha256').update(artwork).digest('hex'),
  '9965d0c2bb09fdc8c276addd02b4510dd60bc2f45d515ab63d1133fc5bb7802a',
  'The original user-approved board illustration must remain unedited');

const hotspots=[...html.matchAll(/<a class="board-hotspot" style="--top:([\d.]+)%;--height:([\d.]+)%" href="([^"]+)"([^>]*)>/g)];
assert.equal(hotspots.length,7,'All six site plaques and the call plaque need hotspots');
for(const [index,hit] of hotspots.entries()){
  const top=Number(hit[1]),height=Number(hit[2]),href=hit[3],attrs=hit[4];
  assert.equal(href,expectedLinks[index],`Wrong destination for plaque ${index+1}`);
  assert.ok(top>35&&height>=4&&top+height<75,`Invalid hit area for plaque ${index+1}`);
  if(index<hotspots.length-1)assert.ok(top+height<=Number(hotspots[index+1][1]),'Plaque hotspots must not overlap');
  if(index<6){
    assert.match(attrs,/target="_blank"/);
    assert.match(attrs,/rel="noopener noreferrer"/);
  }else{
    assert.doesNotMatch(attrs,/target="_blank"/,'Telephone must use a dial link');
  }
  assert.equal(html.split(`href="${href}"`).length-1,2,`Art hotspot and readable list must use the same URL: ${href}`);
}
assert.match(html,/민간 정보 사이트/,'Clarify that the directory is not a government website');
assert.match(html,/<details class="link-directory">/,'Provide accessible full-sized links on mobile');
console.log('PASS adoption board: 7 accurate actions, original painting unchanged, no hotspot overlaps, safe external tabs, tel link and accessible directory.');
