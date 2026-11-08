import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const roomCss=file('dist/leo-room-fullscreen.css');
const roomJs=file('dist/leo-room.js');
const main=file('dist/main.js');
const stats=file('dist/analytics.js');
const walk=file('dist/memorial-walk.js');
const walkHtml=file('dist/memorial-walk.html');
const chat=file('dist/avatar-chat.js');
const bubbles=file('dist/avatar-chat.css');

// Fullscreen no longer letterboxes on landscape screens; portrait keeps
// horizontally scrollable proportions and Leo's interactive coordinate plane.
assert.match(roomCss,/\.room-viewport:is\(:fullscreen, \.is-expanded\) \.room-world\s*\{[^}]*width: 100vw;[^}]*height: 100dvh;[^}]*aspect-ratio: auto;/s);
assert.match(roomCss,/@media \(orientation: portrait\)[\s\S]*?width: max\(100vw, 177\.57dvh\)/);
assert.match(roomJs,/viewport\.scrollLeft=Math\.max\(0,\(viewport\.scrollWidth-viewport\.clientWidth\)\/2\)/);
assert.match(roomJs,/const x=\(event\.clientX-rect\.left\)\/rect\.width\*STAGE_W/);

// A blocked statistics script must not summon a large homepage overlay.
assert.match(main,/consentPanel\.hidden = consentPanel\.dataset\.open !== 'true';/);
assert.match(main,/consentLauncher\.hidden = true;/);
assert.doesNotMatch(main,/blockedNoticeDismissed|BLOCKED_NOTICE_KEY/);
assert.match(stats,/disabled \|\| consent !== 'yes'/);
assert.match(stats,/navigator\.globalPrivacyControl === true/);

// A single authenticated chat follows the group from the garden to shore.
assert.match(walkHtml,/id="shoreChatDock"/);
assert.match(walkHtml,/id="shoreChatJoin"/);
assert.match(walkHtml,/id="walkChatHome"/);
assert.match(walk,/if\(scene==='shore'\)[\s\S]*?chatDock\.append\(chatView\)/);
assert.match(walk,/chatHome\.append\(chatView\)/);
assert.match(walk,/\$\('shoreChatJoin'\)\.addEventListener\('click',\(\)=>\$\('walkJoin'\)\.click\(\)\)/);
assert.match(walk,/peerViews\.get\(item\.avatar_session_id\)/);
assert.match(chat,/select:'id,avatar_session_id,author_id/);
assert.match(chat,/load\(false,true\)/);
assert.match(chat,/hasBaseline=true/);
assert.match(bubbles,/\.walk-self-chat-bubble::after/);
assert.doesNotMatch(chat,/\.innerHTML/);

console.log('PASS: fullscreen Leo room coverage, portrait pan, opt-in stats without popups, seaside chat and remote avatar speech bubbles.');
