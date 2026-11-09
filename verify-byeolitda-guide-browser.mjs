import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dist = resolve(import.meta.dirname, 'dist');
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml',
  '.mp4':'video/mp4', '.json':'application/json'};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  const name = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).slice(1);
  const file = resolve(dist, name);
  if (file !== dist && !file.startsWith(dist + sep)) { response.writeHead(403).end(); return; }
  try {
    const contents = await readFile(file);
    response.writeHead(200, {'content-type': mime[extname(file)] || 'application/octet-stream'});
    response.end(contents);
  } catch { response.writeHead(404).end('Not found'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = 'http://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({headless: true, args:['--no-sandbox']});
const errors = [];

try {
  const pages = ['/','/memorial.html','/temple.html','/memorial-walk.html',
    '/leo-room.html','/playground.html','/community.html','/memorial-archive.html',
    '/memorial-communal.html','/memorial-store.html','/memorial-adoption.html'];
  const page = await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror', err => {if (err.stack?.includes('byeolitda-guide')) errors.push(err.message);});
  for (const path of pages) {
    await page.goto(base + path, {waitUntil:'domcontentloaded'});
    await page.locator('#byeolitdaGuideButton').waitFor();
    assert.equal(await page.locator('#byeolitdaGuideButton').count(), 1, path + ' guide duplicated');
    await page.locator('#byeolitdaGuideButton').click();
    assert.equal(await page.locator('#byeolitdaGuideDialog').evaluate(el=>el.open), true, path);
    assert.equal(await page.locator('#byeolitdaGuideDialog .bdg-choice').count(), 7);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#byeolitdaGuideDialog').evaluate(el=>el.open), false, path);
    assert.equal(await page.evaluate(()=>document.activeElement.id), 'byeolitdaGuideButton', path + ' focus');
  }
  console.log('PASS guide mounted, seven routes, native dialog Escape/focus on ' + pages.length + ' pages');

  for (const viewport of [{width:390,height:844},{width:320,height:480},{width:320,height:420}]) {
    await page.setViewportSize(viewport);
    await page.goto(base + '/memorial.html', {waitUntil:'domcontentloaded'});
    await page.locator('#byeolitdaGuideButton').click();
    const boundary = await page.locator('#byeolitdaGuideDialog').boundingBox();
    assert(boundary && boundary.x >= 0 && boundary.y >= 0, 'Dialog top-left clipped');
    assert(boundary.x + boundary.width <= viewport.width + 1, 'Dialog right clipped');
    assert(boundary.y + boundary.height <= viewport.height + 1, 'Dialog bottom clipped');
    await page.locator('.bdg-choice').first().click();
    await page.locator('.bdg-back').click();
    assert.equal(await page.evaluate(()=>document.activeElement?.classList.contains('bdg-choice')),true);
    await page.keyboard.press('Escape');
    console.log('PASS viewport ' + viewport.width + 'x' + viewport.height + ' dialog fit, back focus');
  }

  await page.setViewportSize({width:390,height:844});
  await page.goto(base + '/memorial.html', {waitUntil:'domcontentloaded'});
  await page.locator('#byeolitdaGuideButton').click();
  await page.locator('.bdg-choice').nth(3).click();
  await page.locator('.bdg-go').click();
  await page.locator('#hmPassportDialog[open]').waitFor({timeout:5000});
  assert.equal(await page.locator('#byeolitdaGuideDialog').evaluate(el=>el.open), false);
  console.log('PASS passport opened from memorial');

  await page.goto(base + '/leo-room.html', {waitUntil:'domcontentloaded'});
  await page.locator('#byeolitdaGuideButton').click();
  await page.locator('.bdg-choice').nth(3).click();
  await page.locator('.bdg-go').click();
  await page.locator('#hmPassportDialog[open]').waitFor({timeout:8000});
  assert(!new URL(page.url()).searchParams.has('open_passport'), 'passport query cleanup failed');
  console.log('PASS cross-page passport opened from Leo room and query cleaned');

  await page.goto(base + '/', {waitUntil:'domcontentloaded'});
  await page.locator('#menuToggle').click();
  assert(await page.getByRole('link', {name:/별잇다 추모관/}).count() >= 1);
  console.log('PASS homepage clear memorial navigation label');
  assert.equal(errors.length,0,'guide JS runtime errors: '+errors.join(' | '));
  console.log('PASS all guide integration scenarios');
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
}
