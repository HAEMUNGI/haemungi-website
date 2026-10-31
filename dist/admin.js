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
  const originalSlots = new Set(slots.map(([slot]) => slot));
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
  let batchFiles = [];
  let batchSeries = '';
  let batchLocked = false;
  const batchPaths = new Map();
  const batchCaptions = new Map();
  const batchObjectUrls = new Map();
  const groupTitles = {cardnews:'카드뉴스', webtoon:'일상다반사 웹툰', today:'헤뭉이의 오늘', goods:'굿즈', emoticon:'이모티콘', gallery:'원화 갤러리', video:'영상', base:'기본 화면·음악'};
  function category(slot) {
    if (slot.startsWith('cardnews-') || /^card-\d{2}$/.test(slot)) return 'cardnews';
    if (slot.startsWith('webtoon-') || slot.startsWith('daily-')) return 'webtoon';
    if (slot.startsWith('today-')) return 'today';
    if (slot.startsWith('goods-')) return 'goods';
    if (slot.startsWith('emoticon-')) return 'emoticon';
    if (slot.startsWith('gallery-')) return 'gallery';
    if (slot.startsWith('video-')) return 'video';
    return 'base';
  }
  const cardSeriesId = slot => /^cardnews-([a-z0-9]+)-\d{2}$/.exec(slot)?.[1] || '';
  function contentName(slot) {
    const row = drafts.find(item => item.slot === slot) || live.find(item => item.slot === slot);
    return row?.title || labels.get(slot) || slot;
  }

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
    // Selection belongs to the searchable library. Never show the huge native mobile menu.
    select.replaceChildren(new Option('보관함에서 콘텐츠를 골라 주세요', ''));
    if (current) select.add(new Option(`${groupTitles[category(current)]} · ${contentName(current)}`, current));
    select.value = current;
  }
  function contentItem(slot) {
    const old = live.find(row => row.slot === slot);
    const pending = drafts.find(row => row.slot === slot);
    const row = document.createElement('button'); row.type = 'button'; row.className = 'item';
    row.classList.toggle('active', current === slot);
    const sign = document.createElement('span'); sign.className = 'item-icon';
    const media = pending || old;
    const preview = sourceUrl(media);
    if (media?.kind === 'image' && preview) {
      const img = document.createElement('img'); img.src = preview; img.alt = ''; img.loading = 'lazy'; sign.append(img);
    } else sign.textContent = icon[mediaType(slot)];
    const info = document.createElement('span'); info.className = 'item-text';
    const title = document.createElement('strong'); title.textContent = contentName(slot);
    const detail = document.createElement('small'); detail.textContent = slot;
    info.append(title, detail);
    const state = document.createElement('span');
    state.className = 'item-pill' + (pending ? ' draft' : old?.is_published ? ' live' : '');
    state.textContent = pending ? '작업 중' : old?.is_published ? '공개 중' : '기본 원화';
    row.append(sign, info, state); row.addEventListener('click', () => { closeBatch(); selectSlot(slot); });
    return row;
  }
  function renderList() {
    const term = $('search').value.trim().toLowerCase();
    const filter = $('filter').value;
    $('list').replaceChildren();
    const visible = allSlots().filter(slot => {
      if (filter !== 'all' && category(slot) !== filter) return false;
      if (originalSlots.has(slot) && !$('showBase').checked && filter !== 'base' &&
          !live.some(row => row.slot === slot) && !drafts.some(row => row.slot === slot)) return false;
      return `${slot} ${contentName(slot)} ${groupTitles[category(slot)]}`.toLowerCase().includes(term);
    });
    const grouped = new Map();
    for (const slot of visible) {
      const series = cardSeriesId(slot);
      const legacyGoods = originalSlots.has(slot) && slot.startsWith('goods-') && slot !== 'goods-collection';
      const key = series ? `cardnews-${series}` : /^card-\d{2}$/.test(slot) ? 'legacy-cards'
        : legacyGoods ? 'legacy-goods' : `single-${slot}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(slot);
    }
    const ordered = [...grouped.entries()].sort((a, b) => {
      const aBase = originalSlots.has(a[1][0]); const bBase = originalSlots.has(b[1][0]);
      const latest = members => Math.max(0, ...members.map(slot => Date.parse(
        (drafts.find(row => row.slot === slot) || live.find(row => row.slot === slot))?.updated_at || '') || 0));
      return Number(aBase) - Number(bBase) || latest(b[1]) - latest(a[1]) || b[0].localeCompare(a[0], 'ko');
    });
    for (const [key, members] of ordered) {
      if (members.length === 1 && !cardSeriesId(members[0])) { $('list').append(contentItem(members[0])); continue; }
      const details = document.createElement('details'); details.className = 'series-group';
      details.open = members.includes(current) || !!term;
      const summary = document.createElement('summary');
      const sample = key === 'legacy-cards' ? '첫 카드뉴스 · 기본 9장'
        : key === 'legacy-goods' ? '기존 굿즈 디자인'
          : contentName(members[0]).split(' · ')[0];
      const published = members.filter(slot => live.some(row => row.slot === slot && row.is_published)).length;
      const pending = members.filter(slot => drafts.some(row => row.slot === slot)).length;
      summary.textContent = `▧ ${sample} · ${members.length}장 (공개 ${published} / 작업 ${pending})`;
      details.append(summary);
      const seriesActions = document.createElement('div'); seriesActions.className = 'series-actions';
      if (pending) {
        const publish = document.createElement('button'); publish.type = 'button'; publish.textContent = '묶음 공개';
        publish.addEventListener('click', () => publishSeries(members)); seriesActions.append(publish);
      }
      if (published) {
        const hide = document.createElement('button'); hide.type = 'button'; hide.textContent = '묶음 숨기기';
        hide.addEventListener('click', () => hideSeries(members)); seriesActions.append(hide);
      }
      details.append(seriesActions);
      members.sort().forEach(slot => details.append(contentItem(slot)));
      $('list').append(details);
    }
    if (!visible.length) {
      const empty = document.createElement('p'); empty.className = 'catalog-empty';
      empty.textContent = '등록된 콘텐츠가 없습니다. 위에서 새 이야기를 추가하거나 기본 원화 보기를 켜세요.';
      $('list').append(empty);
    }
    $('countLive').textContent = String(live.filter(row => row.is_published).length);
    $('countDraft').textContent = String(drafts.length);
    $('countAll').textContent = String(new Set([...live.map(row => row.slot), ...drafts.map(row => row.slot)]).size);
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
    if (current === 'daily-moments' &&
      !confirm('이 위치는 기존 웹툰 고정 전시칸입니다. 새 회차는 반드시 ‘＋ 새 일상다반사 웹툰’으로 추가하세요. 그래도 이 고정 전시칸을 수정하시겠습니까?')) return;
    const replacingPublishedWebtoon = current.startsWith('webtoon-') &&
      published && ($('file').files.length > 0 || changedDraftImage);
    if (replacingPublishedWebtoon && !confirm('이 회차의 공개 이미지를 교체하시겠습니까? 새 회차는 ‘＋ 새 일상다반사 웹툰’으로 추가하세요.')) return;
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
  async function publishSeries(members) {
    const rows = drafts.filter(row => members.includes(row.slot));
    if (!rows.length) return notice('공개할 작업본이 없습니다.', true);
    if (!confirm(`${rows.length}장의 작업본을 공개하시겠습니까? 기존 공개본은 삭제하지 않습니다.`)) return;
    try {
      await request(rest('hm_media_public', '?on_conflict=slot'), {
        method: 'POST', headers: {Prefer: 'resolution=merge-duplicates,return=representation'},
        body: JSON.stringify(rows.map(row => ({
          slot: row.slot, kind: row.kind, title: row.title, description: row.description,
          alt_text: row.alt_text, source_path: row.source_path, source_url: row.source_url,
          is_published: true, updated_at: new Date().toISOString()
        })))
      });
      await request(rest('hm_media_drafts', `?slot=in.(${rows.map(row => row.slot).join(',')})`), {method:'DELETE'});
      await loadAll(); notice(`${rows.length}장을 한 번에 공개했습니다.`);
    } catch (error) { notice(`묶음 공개 확인이 필요합니다: ${error.message}`, true); await loadAll().catch(() => {}); }
  }
  async function hideSeries(members) {
    const slotsToHide = members.filter(slot => live.some(row => row.slot === slot && row.is_published));
    if (!slotsToHide.length || !confirm(`${slotsToHide.length}장을 모두 숨기시겠습니까? 파일과 임시 저장본은 남습니다.`)) return;
    try {
      await request(rest('hm_media_public', `?slot=in.(${slotsToHide.join(',')})`), {
        method: 'PATCH', body: JSON.stringify({is_published:false, updated_at:new Date().toISOString()})
      });
      await loadAll(); notice('시리즈 공개를 숨겼습니다. 원본은 보존됩니다.');
    } catch (error) { notice(error.message, true); }
  }
  function openBatch() {
    $('batchView').hidden = false;
    $('editorLayout').hidden = true;
    $('batchTitle').focus();
  }
  function closeBatch() {
    $('batchView').hidden = true;
    $('editorLayout').hidden = false;
  }
  function resetBatch() {
    for (const url of batchObjectUrls.values()) URL.revokeObjectURL(url);
    batchObjectUrls.clear(); batchPaths.clear(); batchCaptions.clear();
    batchFiles = []; batchSeries = ''; batchLocked = false;
    $('batchFiles').disabled = false; $('batchFiles').value = '';
    $('batchTitle').value = ''; $('batchDescription').value = '';
    $('batchStatus').textContent = ''; renderBatchPages();
  }
  function renderBatchPages() {
    $('batchPages').replaceChildren();
    batchFiles.forEach((file, index) => {
      if (!batchObjectUrls.has(file)) batchObjectUrls.set(file, URL.createObjectURL(file));
      const row = document.createElement('div'); row.className = 'batch-page';
      const img = document.createElement('img'); img.src = batchObjectUrls.get(file); img.alt = `카드 ${index + 1} 미리보기`;
      const info = document.createElement('div'); info.className = 'batch-page-info';
      const title = document.createElement('strong'); title.textContent = `${index + 1}장 · ${file.name}`;
      const caption = document.createElement('input'); caption.type = 'text'; caption.maxLength = 80;
      caption.placeholder = `${index + 1}장 제목 (선택)`; caption.value = batchCaptions.get(file) || '';
      caption.disabled = batchLocked;
      caption.addEventListener('input', () => batchCaptions.set(file, caption.value));
      const actions = document.createElement('div'); actions.className = 'batch-page-actions';
      for (const [symbol, next] of [['↑', index - 1], ['↓', index + 1]]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = symbol;
        button.setAttribute('aria-label', `${index + 1}장을 ${symbol === '↑' ? '앞으로' : '뒤로'} 이동`);
        button.disabled = batchLocked || next < 0 || next >= batchFiles.length;
        button.addEventListener('click', () => {
          [batchFiles[index], batchFiles[next]] = [batchFiles[next], batchFiles[index]];
          renderBatchPages();
        });
        actions.append(button);
      }
      info.append(title, caption); row.append(img, info, actions); $('batchPages').append(row);
    });
    $('batchDraft').disabled = $('batchPublish').disabled = !batchFiles.length;
  }
  async function saveBatch(publish) {
    const title = $('batchTitle').value.trim();
    const desc = $('batchDescription').value.trim();
    if (!title) return notice('시리즈 제목을 입력해 주세요.', true);
    if (!batchFiles.length) return notice('카드 이미지부터 선택해 주세요.', true);
    if (batchFiles.length > 20) return notice('한 시리즈에 최대 20장까지 등록할 수 있습니다.', true);
    try { batchFiles.forEach(file => validateFile(file, 'image')); }
    catch (error) { return notice(error.message, true); }
    // Once upload starts, fix ordering so an interrupted upload can resume safely.
    batchLocked = true;
    batchSeries ||= `${Date.now().toString(36)}${crypto.randomUUID().slice(0, 6)}`.replace(/-/g, '');
    $('batchFiles').disabled = $('batchDraft').disabled = $('batchPublish').disabled = true;
    renderBatchPages();
    $('batchDraft').disabled = $('batchPublish').disabled = true;
    const entries = [];
    try {
      for (const [index, file] of batchFiles.entries()) {
        $('batchStatus').textContent = `${index + 1} / ${batchFiles.length}장 업로드 중…`;
        let path = batchPaths.get(file);
        if (!path) { path = await upload(file, 'image'); batchPaths.set(file, path); }
        const number = String(index + 1).padStart(2, '0');
        const pageTitle = batchCaptions.get(file)?.trim() || `${index + 1}장`;
        entries.push({slot:`cardnews-${batchSeries}-${number}`, kind:'image',
          title:`${title} · ${pageTitle}`, description:desc, alt_text:`${title} ${index + 1}장`,
          source_path:path, source_url:null, updated_at:new Date().toISOString()});
      }
      await request(rest('hm_media_drafts', '?on_conflict=slot'), {
        method:'POST', headers:{Prefer:'resolution=merge-duplicates,return=representation'}, body:JSON.stringify(entries)
      });
      if (publish) {
        $('batchStatus').textContent = '전체 공개 반영 중…';
        await request(rest('hm_media_public', '?on_conflict=slot'), {
          method:'POST', headers:{Prefer:'resolution=merge-duplicates,return=representation'},
          body:JSON.stringify(entries.map(row => ({...row, is_published:true})))
        });
        await request(rest('hm_media_drafts', `?slot=in.(${entries.map(row => row.slot).join(',')})`), {method:'DELETE'});
      }
      const first = entries[0].slot;
      await loadAll();
      if (publish) {
        resetBatch(); closeBatch(); selectSlot(first);
        notice(`${entries.length}장의 새 카드뉴스를 공개했습니다. 기존 시리즈는 그대로입니다.`);
      } else {
        $('batchStatus').textContent = `${entries.length}장 임시 저장 완료. ‘전체 공개 반영’으로 한 번에 게시할 수 있습니다.`;
        notice('카드뉴스 전체를 임시 저장했습니다. 아직 방문자에게 보이지 않습니다.');
      }
    } catch (error) {
      $('batchStatus').textContent = `중단됨 · ${error.message}. 같은 화면에서 다시 시도하면 업로드한 파일을 재사용합니다.`;
      notice(error.message, true);
      await loadAll().catch(() => {});
    } finally {
      $('batchDraft').disabled = $('batchPublish').disabled = false;
    }
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
    const prefix = {video:'video',image:'gallery',today:'today',emoticon:'emoticon',webtoon:'webtoon',goods:'goods-new'}[kind];
    if (!prefix) return;
    const slug = kind === 'webtoon'
      ? `webtoon-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 8)}`
      : `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
    labels.set(slug, {video:'새 영상',image:'새 갤러리 이미지',today:'헤뭉이의 오늘',emoticon:'새 이모티콘',webtoon:'새 일상다반사 웹툰',goods:'새 굿즈 상품'}[kind]);
    closeBatch(); renderSelector(); selectSlot(slug);
    $('title').focus();
  }

  $('loginForm').addEventListener('submit', login);
  $('logout').addEventListener('click', logout);
  $('reload').addEventListener('click', () => loadAll().then(() => notice('최신 정보를 불러왔습니다.')).catch(error => notice(error.message, true)));
  $('search').addEventListener('input', renderList);
  $('filter').addEventListener('change', renderList);
  $('showBase').addEventListener('change', () => { renderSelector(); renderList(); });
  $('slot').addEventListener('change', event => selectSlot(event.target.value));
  $('openCardBatch').addEventListener('click', () => { resetBatch(); openBatch(); });
  $('closeBatch').addEventListener('click', closeBatch);
  $('batchFiles').addEventListener('change', () => {
    if (batchLocked) return;
    for (const url of batchObjectUrls.values()) URL.revokeObjectURL(url);
    batchObjectUrls.clear(); batchCaptions.clear();
    batchFiles = [...$('batchFiles').files];
    if (batchFiles.length > 20) { notice('한 시리즈에 최대 20장까지 등록할 수 있습니다.', true); batchFiles = []; $('batchFiles').value = ''; }
    renderBatchPages();
  });
  $('batchDraft').addEventListener('click', () => saveBatch(false));
  $('batchPublish').addEventListener('click', () => saveBatch(true));
  $('quickWebtoon').addEventListener('click', () => createSlot('webtoon'));
  $('quickToday').addEventListener('click', () => createSlot('today'));
  $('quickGoods').addEventListener('click', () => createSlot('goods'));
  $('quickEmoticon').addEventListener('click', () => createSlot('emoticon'));
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
