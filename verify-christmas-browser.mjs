import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser = null;
for (const candidate of [process.env.CHROME_BIN, 'google-chrome', 'chromium', 'chromium-browser']) {
  if (!candidate) continue;
  try { browser = execFileSync('which', [candidate], {encoding:'utf8'}).trim(); break; } catch {}
}
if (!browser) throw new Error('Chrome/Chromium is required for real browser validation.');

const dataDir = mkdtempSync(join(tmpdir(), 'haemungi-chrome-'));
const port = 19381;
const chrome = spawn(browser, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*',
  '--remote-debugging-port=' + port, '--user-data-dir=' + dataDir, 'about:blank'
], { stdio: 'ignore' });

let ws;
const pending = new Map();
let serial = 0;
try {
  let pages;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:' + port + '/json');
      if (response.ok) {
        pages = await response.json();
        if (pages.some(p => p.type === 'page' && p.webSocketDebuggerUrl)) break;
      }
    } catch {}
    if (chrome.exitCode !== null) throw new Error('Chrome exited prematurely: ' + chrome.exitCode);
    await sleep(200);
  }
  const target = pages?.find(p => p.type === 'page' && p.webSocketDebuggerUrl);
  if (!target) throw new Error('Chrome DevTools endpoint was unavailable.');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, {once:true});
    ws.addEventListener('error', reject, {once:true});
  });
  ws.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (!msg.id) return;
    const job = pending.get(msg.id);
    if (!job) return;
    pending.delete(msg.id);
    msg.error ? job.reject(new Error(JSON.stringify(msg.error))) : job.resolve(msg.result);
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    pending.set(id, {resolve,reject});
    ws.send(JSON.stringify({id,method,params}));
  });
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Page.navigate', {url:'https://haemungi.pages.dev/christmas#map'});
  const ids = ['map','square','market','parade','sled','fishing','stage','garden'];
  for (const id of ids) {
    if (id !== 'map') {
      await cdp('Runtime.evaluate', {
        expression: 'location.hash = ' + JSON.stringify('#'+id)
      });
    }
    const expectPath = 'christmas-' + id + '.webp';
    let last;
    const deadline = Date.now() + 16000;
    while (Date.now() < deadline) {
      const result = await cdp('Runtime.evaluate', {
        expression: `(() => {
          const img = document.querySelector('#sceneImage');
          if (!img) return {state:'no-image',url:location.href};
          let rendered = false, pixelError = '';
          if (img.complete && img.naturalWidth > 0) {
            try {
              const canvas = document.createElement('canvas');
              canvas.width=2; canvas.height=2;
              canvas.getContext('2d').drawImage(img,0,0,2,2);
              canvas.getContext('2d').getImageData(0,0,1,1);
              rendered = true;
            } catch (error) { pixelError = String(error); }
          }
          return {
            hash:location.hash,src:img.currentSrc,complete:img.complete,
            naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,
            rendered,pixelError
          };
        })()`,
        returnByValue:true
      });
      last = result?.result?.value;
      if (last?.hash === '#'+id && last?.src?.endsWith('/assets/' + expectPath)
           && last.complete && last.naturalWidth >= 800 && last.naturalHeight >= 1200 && last.rendered) break;
      await sleep(350);
    }
    if (last?.hash !== '#'+id || !last?.src?.endsWith('/assets/' + expectPath)
        || !last?.complete || !(last.naturalWidth >= 800)
        || !(last.naturalHeight >= 1200) || !last.rendered) {
      throw new Error('Browser image QA FAIL for ' + id + ': ' + JSON.stringify(last));
    }
    console.log('Browser image QA PASS',id,last.naturalWidth + 'x' + last.naturalHeight);
  }
  console.log('All 8 Christmas Village pages rendered in Chromium.');
} finally {
  try { ws?.close(); } catch {}
  try { chrome.kill('SIGTERM'); } catch {}
  rmSync(dataDir, {recursive:true,force:true});
}
