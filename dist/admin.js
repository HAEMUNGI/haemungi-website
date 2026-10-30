(() => {
  'use strict';
  const config = window.HAEMUNGI_CONTENT_CONFIG || {};
  const $ = id => document.getElementById(id);
  const slots = [
    ['hero', '첫 화면 대표 원화'], ['character-sheet', '캐릭터 설정화'],
    ['character-mbti', 'MBTI 캐릭터 초상'], ['room-main', '헤뭉이의 방 배경'],
    ['goods-collection', '굿즈 전체 모음'],
    ...['shirt', 'cap', 'keyring', 'phonecase', 'mug', 'coin', 'stickers', 'totebag', 'notebook', 'plush'].map((name, i) =>
      [`goods-${name}`, `${i + 1}번 굿즈 · ${name}`]),
    ['daily-first', '첫 만남 웹툰'], ['daily-moments', '일상다반사 웹툰 · 기존 회차 수정'],
    ...Array.from({length: 9}, (_, i) => [`card-${String(i + 1).padStart(2, '0')}`, `카드뉴스 ${i + 1}장`]),
    ['music-main', '배경음악']
  ];
  const labels = new Map(slots);
  const icon = {image: '▧', video: '▶', audio: '♫'};
  const safeSlot = value => /^[a-z0-9][a-z0-9-]{0,79}$/.test(value || '');
  const mediaType = slot => slot === 'music-main' ? 'audio' : slot.startsWith('video-') ? 'video' : 'image';
  const fileTypes = {
    'image/png': ['image', 'png'], 'image/jpeg': ['image', 'jpg'],
    'image/webp': ['image', 'webp'], 'image/avif': ['image', 'avif'],
    'video/mp4': ['video', 'mp4'], 'video/webm': ['video', 'webm'],
    'audio/mpeg': ['audio', 'mp3'], 'audio/ogg': ['audio', 'ogg'],
    'audio/wav': ['audio', 'wav'], 'audio/mp4': ['audio', 'm4a']
  };
  let session = null;
  let refreshing = null;
  let live = [];
  let drafts = [];
  let current = '';
  let filePreviewUrl = null;
  let noticeTimer = null;

  function notice(message, isError = false) {
    const el = $('notice');
    el.textContent = message;
    el.classList.toggle('error', isError);
    el.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { el.hidden = true; }, 6500);
  }
  const apiConfigOK = /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.projectUrl || '') &&
    /^sb_publishable_[\w-]+$/.test(config.publishableKey || '');
  function headers(token, extra = {}) {
    return {apikey: config.publishableKey, ...(token ? {Authorization: `Bearer ${token}`} : {}), ...extra};
  }
  function persist() {
    try { if (session) sessionStorage.setItem('hm-owner-session-v1', JSON.stringify(session));
      else sessionStorage.removeItem('hm-owner-session-v1'); } catch (_) { /* Session-only storage. */ }
  }
  async function refreshSession() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      if (!session?.refresh_token) throw new Error('세션이 만료되었습니다. 다시 로그인하세요.');
      const response = await fetch(`${config.projectUrl}/auth/v1/token?grant_type=refresh_token`, {
        method: 'POST', headers: headers(null, {'Content-Type': 'application/json'}),
        body: JSON.stringify({refresh_token: session.refresh_token})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token) throw new Error('관리자 인증이 만료되었습니다. 다시 로그인하세요.');
      session = {...data, user: data.user || session.user, expires_at: Math.floor(Date.now() / 1000) + data.expires_in};
      persist();
      return session.access_token;
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  async function accessToken() {
    if (!session?.access_token) throw new Error('관리자 로그인이 필요합니다.');
    if (!session.expires_at || session.expires_at < Date.now() / 1000 + 70) return refreshSession();
    return session.access_token;
  }
  async function request(path, options = {}) {
    const token = await accessToken();
    const response = await fetch(config.projectUrl + path, {
      ...options,
      headers: headers(token, {'Content-Type': 'application/json', ...(options.headers || {})}),
      cache: 'no-store'
    });
    if (response.status === 401) throw new Error('로그인 유효기간이 지났습니다. 다시 로그인하세요.');
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.error_description || `서버 응답 오류: ${response.status}`);
    }
    return response.status === 204 ? null : response.json().catch(() => null);
  }
  const rest = (table, query = '') => `/rest/v1/${table}${query}`;
  const reportTables = new Set(['hm_stats_dashboard','hm_stats_daily','hm_stats_pages','hm_stats_content','hm_stats_sources','hm_stats_devices','hm_stats_hours','hm_goods','hm_stories','hm_room_spots']);
  window.HM_ADMIN_REPORT_QUERY = (table, query = '?select=*') => {
    if (!reportTables.has(table) || !/^\?select=\*$/.test(query)) throw new Error('통계 접근 요청이 올바르지 않습니다.');
    return request(rest(table, query));
  };
  const publicUrl = path => path && /^(image|video|audio)\/[a-z0-9-]+\.[a-z0-9]+$/.test(path)
    ? `${config.projectUrl}/storage/v1/object/public/hm-media/${path}` : '';
  function sourceUrl(row) {
    if (!row) return '';
    return row.source_path ? publicUrl(row.source_path) : (isSecureURL(row.source_url) ? row.source_url : '');
  }
  function isSecureURL(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
    catch (_) { return false; }
  }
  function youtubeId(url) {
    try {
      const u = new URL(url);
      if (u.hostname === 'youtu.be') return /^[\w-]{11}$/.test(u.pathname.slice(1)) ? u.pathname.slice(1) : '';
      if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(u.hostname)) {
        const id = u.pathname.startsWith('/shorts/') || u.pathname.startsWith('/embed/') ? u.pathname.split('/')[2] : u.searchParams.get('v');
        return /^[\w-]{11}$/.test(id || '') ? id : '';
      }
    } catch (_) { /* Not a URL. */ }
    return '';
  }
  function addPreview(container, row, localUrl = '') {
    container.replaceChildren();
    const url = localUrl || sourceUrl(row);
    if (!row || !url) { container.textContent = '등록된 콘텐츠 없음'; return; }
    let element;
    if (row.kind === 'image') {
      element = document.createElement('img'); element.src = url; element.alt = row.alt_text || row.title || '';
    } else if (row.kind === 'audio') {
      element = document.createElement('audio'); element.controls = true; element.preload = 'none'; element.src = url;
    } else if (youtubeId(url)) {
      element = document.createElement('a'); element.textContent = '유튜브 영상 열기 ↗';
      element.href = url; element.target = '_blank'; element.rel = 'noopener noreferrer';
    } else if (/\.(mp4|webm)(\?|#|$)/i.test(url) || localUrl) {
      element = document.createElement('video'); element.controls = true; element.preload = 'none'; element.src = url;
    } else {
      element = document.createElement('a'); element.textContent = '원본 주소 확인 ↗';
      element.href = url; element.target = '_blank'; element.rel = 'noopener noreferrer';
    }
    container.append(element);
  }
  function releasePreview() {
    if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    filePreviewUrl = null;
  }
  function allSlots() {
    return [...new Set([...labels.keys(), ...live.map(x => x.slot), ...drafts.map(x => x.slot)])];
  }
  function renderSelector() {
    const select = $('slot');
    select.replaceChildren(new Option('위치를 선택하세요', ''));
    allSlots().forEach(slot => select.add(new Option(labels.get(slot) || slot, slot)));
    select.value = current;
  }
  function renderList() {
    const term = $('search').value.trim().toLowerCase();
    const filter = $('filter').value;
    $('list').replaceChildren();
    allSlots().filter(slot => (filter === 'all' || mediaType(slot) === filter) &&
      `${slot} ${labels.get(slot) || ''}`.toLowerCase().includes(term)).forEach(slot => {
      const old = live.find(row => row.slot === slot);
      const pending = drafts.find(row => row.slot === slot);
      const row = document.createElement('button'); row.type = 'button'; row.className = 'item';
      row.classList.toggle('active', current === slot);
      const sign = document.createElement('span'); sign.className = 'item-icon'; sign.textContent = icon[mediaType(slot)];
      const info = document.createElement('span'); info.className = 'item-text';
      const title = document.createElement('strong'); title.textContent = labels.get(slot) || pending?.title || old?.title || slot;
      const detail = document.createElement('small'); detail.textContent = slot;
      info.append(title, detail);
      const state = document.createElement('span');
      state.className = 'item-pill' + (pending ? ' draft' : old?.is_published ? ' live' : '');
      state.textContent = pending ? '작업 중' : old?.is_published ? '공개 중' : '기본 원화';
      row.append(sign, info, state); row.addEventListener('click', () => selectSlot(slot)); $('list').append(row);
    });
    $('countLive').textContent = String(live.filter(row => row.is_published).length);
    $('countDraft').textContent = String(drafts.length);
    $('countAll').textContent = String(allSlots().length);
  }
  function selectSlot(slot) {
    if (slot && !safeSlot(slot)) return;
    releasePreview();
    $('file').value = '';
    $('filename').textContent = '파일을 선택하세요 · 이미지 10MB / 영상 40MB / 음악 15MB';
    current = slot;
    $('webtoonReplaceHint').hidden = slot !== 'daily-moments';
    renderSelector(); renderList();
    const old = live.find(x => x.slot === slot);
    const pending = drafts.find(x => x.slot === slot);
    const row = pending || old;
    $('title').value = row?.title || (labels.get(slot) || '');
    $('description').value = row?.description || '';
    $('alt').value = row?.alt_text || '';
    $('externalUrl').value = row?.source_url || '';
    document.querySelector(`input[name="source"][value="${row?.source_url ? 'link' : 'file'}"]`).checked = true;
    toggleSource();
    $('entryStatus').textContent = pending ? '작업 중' : old?.is_published ? '공개 중' : '미등록';
    $('save').disabled = $('publish').disabled = !slot;
    $('hide').disabled = !old?.is_published;
    addPreview($('draftPreview'), pending || old);
    addPreview($('livePreview'), old?.is_published ? old : null);
  }
  function toggleSource() {
    const link = document.querySelector('input[name="source"]:checked')?.value === 'link';
    $('filePanel').hidden = link;
    $('linkPanel').hidden = !link;
    $('externalUrl').disabled = !link;
    $('file').disabled = link;
    if (current && mediaType(current) === 'image' && link) {
      $('sourceFile').checked = true;
      $('sourceLink').checked = false;
      $('filePanel').hidden = false;
      $('linkPanel').hidden = true;
      $('externalUrl').disabled = true;
      $('file').disabled = false;
      notice('이미지는 파일 업로드로 등록해 주세요.', true);
    }
  }
  async function loadAll() {
    const [l, d] = await Promise.all([
      request(rest('hm_media_public', '?select=*&order=slot.asc')),
      request(rest('hm_media_drafts', '?select=*&order=slot.asc'))
    ]);
    live = Array.isArray(l) ? l : [];
    drafts = Array.isArray(d) ? d : [];
    renderSelector(); renderList(); selectSlot(current && allSlots().includes(current) ? current : '');
  }
  function setBusy(busy) {
    ['save', 'publish', 'hide', 'reload'].forEach(id => {
      $(id).disabled = busy || (id !== 'reload' && !current) ||
        (id === 'hide' && !live.some(row => row.slot === current && row.is_published));
    });
    $('save').textContent = busy ? '처리 중…' : '임시 저장';
  }
  function validateFile(file, kind) {
    const format = fileTypes[file.type];
    if (!format || format[0] !== kind) throw new Error('이 위치에 맞는 파일 형식이 아닙니다.');
    const limit = {image: 10, video: 40, audio: 15}[kind] * 1024 * 1024;
    if (file.size === 0 || file.size > limit) throw new Error(`파일 크기 제한: ${Math.round(limit / 1048576)}MB 이하`);
    return format[1];
  }
  async function upload(file, kind) {
    const extension = validateFile(file, kind);
    const path = `${kind}/${crypto.randomUUID()}.${extension}`;
    const token = await accessToken();
    $('progressWrap').hidden = false;
    $('progress').value = 0; $('progressText').textContent = '0%';
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${config.projectUrl}/storage/v1/object/hm-media/${path}`);
      xhr.setRequestHeader('apikey', config.publishableKey);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = ev => {
        if (ev.lengthComputable) {
          const pct = Math.round(ev.loaded / ev.total * 100);
          $('progress').value = pct; $('progressText').textContent = pct + '%';
        }
      };
      xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`파일 업로드 실패 (${xhr.status})`));
      xhr.onerror = () => reject(new Error('업로드 연결이 끊어졌습니다.'));
      xhr.ontimeout = () => reject(new Error('업로드 시간이 초과되었습니다.'));
      xhr.timeout = 240000;
      xhr.send(file);
    });
    $('progressWrap').hidden = true;
    return path;
  }
  async function saveDraft() {
    if (!current || !safeSlot(current)) throw new Error('먼저 위치를 선택하세요.');
    const kind = mediaType(current);
    const before = drafts.find(x => x.slot === current) || live.find(x => x.slot === current);
    const linkSelected = $('sourceLink').checked;
    let source_path = null;
    let source_url = null;
    if (linkSelected) {
      if (kind === 'image') throw new Error('이미지는 파일로 올려주세요.');
      const input = $('externalUrl').value.trim();
      if (!isSecureURL(input)) throw new Error('HTTPS 주소를 입력해 주세요.');
      source_url = input;
    } else if ($('file').files.length > 0) {
      source_path = await upload($('file').files[0], kind);
    } else if (before?.source_path) {
      source_path = before.source_path;
    } else {
      throw new Error('파일을 선택하거나 연결 주소를 입력하세요.');
    }
    const row = {
      slot: current, kind, title: $('title').value.trim(), description: $('description').value.trim(),
      alt_text: $('alt').value.trim(), source_path, source_url, updated_at: new Date().toISOString()
    };
    await request(rest('hm_media_drafts', '?on_conflict=slot'), {
      method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=representation'}, body: JSON.stringify(row)
    });
    return row;
  }
  async function saveClicked(event) {
    event?.preventDefault();
    setBusy(true);
    try { await saveDraft(); await loadAll(); notice('임시 저장했습니다. 공개 사이트는 아직 바뀌지 않았습니다.'); }
    catch (error) { notice(error.message, true); }
    finally { setBusy(false); }
  }
  async function publishClicked() {
    if (!current) return;
    const published = live.find(row => row.slot === current && row.is_published);
    const pending = drafts.find(row => row.slot === current);
    const changedDraftImage = pending && published &&
      (pending.source_path !== published.source_path || pending.source_url !== published.source_url);
    const replacingPublishedWebtoon = (current === 'daily-moments' || current.startsWith('webtoon-')) &&
      published && ($('file').files.length > 0 || changedDraftImage);
    if (replacingPublishedWebtoon && !confirm('기존 웹툰 이미지가 교체됩니다. 새 회차는 ‘＋ 새 일상다반사 웹툰’으로 추가하세요. 이 회차의 이미지를 교체하시겠습니까?')) return;
    setBusy(true);
    try {
      const row = await saveDraft();
      await request(rest('hm_media_public', '?on_conflict=slot'), {
        method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify({...row, is_published: true})
      });
      await request(rest('hm_media_drafts', `?slot=eq.${encodeURIComponent(current)}`), {method: 'DELETE'});
      await loadAll();
      notice('공개 반영되었습니다. 방문자가 새로 열면 변경된 콘텐츠가 보입니다.');
    } catch (error) { notice(error.message, true); }
    finally { setBusy(false); }
  }
  async function hideClicked() {
    if (!current) return;
    if (!confirm('이 콘텐츠를 공개 사이트에서 숨기시겠습니까? 원본 파일은 삭제되지 않습니다.')) return;
    setBusy(true);
    try {
      await request(rest('hm_media_public', `?slot=eq.${encodeURIComponent(current)}`), {
        method: 'PATCH', body: JSON.stringify({is_published: false, updated_at: new Date().toISOString()})
      });
      await loadAll(); notice('공개를 숨겼습니다. 원본 콘텐츠는 유지됩니다.');
    } catch (error) { notice(error.message, true); }
    finally { setBusy(false); }
  }
  async function login(event) {
    event.preventDefault();
    if (!apiConfigOK) return notice('헤뭉이 Supabase 연결 설정을 확인해 주세요.', true);
    const button = $('loginForm').querySelector('button'); button.disabled = true;
    try {
      const response = await fetch(`${config.projectUrl}/auth/v1/token?grant_type=password`, {
        method: 'POST', headers: headers(null, {'Content-Type': 'application/json'}),
        body: JSON.stringify({email: $('email').value.trim(), password: $('password').value})
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token || !data.user?.id) throw new Error('이메일 또는 비밀번호를 확인해 주세요.');
      session = {...data, expires_at: Math.floor(Date.now() / 1000) + data.expires_in};
      const admins = await request(rest('hm_admins', `?select=user_id&user_id=eq.${data.user.id}`));
      if (!Array.isArray(admins) || admins.length !== 1) throw new Error('헤뭉이 관리자 권한이 없는 계정입니다.');
      persist(); $('password').value = '';
      await enterStudio();
    } catch (error) { session = null; persist(); notice(error.message, true); }
    finally { button.disabled = false; }
  }
  async function enterStudio() {
    await loadAll();
    $('loginView').hidden = true; $('studioView').hidden = false; $('analyticsView').hidden = true; $('logout').hidden = false;
  }
  async function logout() {
    try { if (session) await request('/auth/v1/logout', {method: 'POST'}); } catch (_) { /* Revoke locally even if network is down. */ }
    session = null; persist(); live = []; drafts = [];
    $('studioView').hidden = true; $('analyticsView').hidden = true; $('loginView').hidden = false; $('logout').hidden = true;
    $('password').value = ''; notice('로그아웃했습니다.');
  }
  function createSlot(kind) {
    const prefix = {video:'video',image:'gallery',today:'today',emoticon:'emoticon',webtoon:'webtoon'}[kind];
    if (!prefix) return;
    const slug = kind === 'webtoon'
      ? `webtoon-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`
      : `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
    labels.set(slug, {video:'새 영상',image:'새 갤러리 이미지',today:'헤뭉이의 오늘',emoticon:'새 이모티콘',webtoon:'새 일상다반사 웹툰'}[kind]);
    renderSelector(); selectSlot(slug);
  }

  $('loginForm').addEventListener('submit', login);
  $('logout').addEventListener('click', logout);
  $('reload').addEventListener('click', () => loadAll().then(() => notice('최신 정보를 불러왔습니다.')).catch(error => notice(error.message, true)));
  $('search').addEventListener('input', renderList);
  $('filter').addEventListener('change', renderList);
  $('slot').addEventListener('change', event => selectSlot(event.target.value));
  $('addImage').addEventListener('click', () => createSlot('image'));
  $('addVideo').addEventListener('click', () => createSlot('video'));
  $('addToday').addEventListener('click', () => createSlot('today'));
  $('addWebtoon').addEventListener('click', () => createSlot('webtoon'));
  $('addEmoticon').addEventListener('click', () => createSlot('emoticon'));
  document.querySelectorAll('input[name="source"]').forEach(radio => radio.addEventListener('change', toggleSource));
  $('file').addEventListener('change', () => {
    releasePreview();
    const file = $('file').files[0];
    if (!file) return;
    try {
      validateFile(file, mediaType(current));
      $('filename').textContent = `${file.name} · ${(file.size / 1048576).toFixed(1)}MB`;
      filePreviewUrl = URL.createObjectURL(file);
      addPreview($('draftPreview'), {kind: mediaType(current)}, filePreviewUrl);
    } catch (error) { $('file').value = ''; notice(error.message, true); }
  });
  $('editorForm').addEventListener('submit', saveClicked);
  $('publish').addEventListener('click', publishClicked);
  $('hide').addEventListener('click', hideClicked);

  $('save').disabled = $('publish').disabled = $('hide').disabled = true;
  if (!apiConfigOK) notice('관리자 연결 설정이 없습니다. 사이트 관리자가 구성을 확인해야 합니다.', true);
  try { session = JSON.parse(sessionStorage.getItem('hm-owner-session-v1') || 'null'); }
  catch (_) { session = null; }
  if (session?.access_token) {
    (async () => {
      try {
        const id = session.user?.id;
        if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error('관리자 인증 정보가 유효하지 않습니다.');
        const admins = await request(rest('hm_admins', `?select=user_id&user_id=eq.${id}`));
        if (!Array.isArray(admins) || admins.length !== 1) throw new Error('관리자 권한을 확인할 수 없습니다.');
        await enterStudio();
      } catch (error) { session = null; persist(); notice(error.message, true); }
    })();
  }
})();
