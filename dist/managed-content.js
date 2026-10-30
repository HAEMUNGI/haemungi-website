(() => {
  'use strict';
  // Optional administrator-managed media. A broken/offline CMS never hides original art.
  const config = window.HAEMUNGI_CONTENT_CONFIG || {};
  if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.projectUrl || '') ||
      !/^sb_publishable_[\w-]+$/.test(config.publishableKey || '')) return;

  const originalPaths = {
    hero: 'assets/haemungi-hero.webp',
    'character-sheet': 'assets/haemungi-sheet.webp',
    'character-mbti': 'assets/haemungi-mbti-portrait.webp',
    'room-main': 'assets/haemungi-room.webp',
    'goods-collection': 'assets/merch-collection.webp',
    'daily-first': 'assets/daily-first-encounter.webp',
    'daily-moments': 'assets/daily-little-moments.webp',
    ...Object.fromEntries(['shirt', 'cap', 'keyring', 'phonecase', 'mug', 'coin', 'stickers', 'totebag', 'notebook', 'plush']
      .map(name => [`goods-${name}`, `assets/merch-${name}.webp`])),
    ...Object.fromEntries(Array.from({length: 9}, (_, i) => {
      const n = String(i + 1).padStart(2, '0');
      return [`card-${n}`, `assets/cardnews-01-${n}.webp`];
    }))
  };
  const originalsBySlot = new Map(Object.entries(originalPaths));
  const safePath = path => /^(image|video|audio)\/[a-z0-9-]+\.(png|jpg|jpeg|webp|avif|mp4|webm|mp3|ogg|wav|m4a)$/.test(path || '');
  function secureExternal(input) {
    try {
      const url = new URL(input);
      return url.protocol === 'https:' && !url.username && !url.password;
    } catch (_) { return false; }
  }
  function urlFor(row) {
    if (row?.source_path && safePath(row.source_path))
      return `${config.projectUrl}/storage/v1/object/public/hm-media/${row.source_path}`;
    if (row?.source_url && secureExternal(row.source_url)) return row.source_url;
    return '';
  }
  function youtubeId(input) {
    try {
      const url = new URL(input);
      let id = '';
      if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
      if (['www.youtube.com', 'youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname))
        id = url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/') ? url.pathname.split('/')[2] : url.searchParams.get('v');
      return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : '';
    } catch (_) { return ''; }
  }
  let publishedRows = [];
  let audio = null;
  let audioURL = '';

  function applyImages(rows) {
    for (const row of rows) {
      if (row.kind !== 'image' || !originalsBySlot.has(row.slot)) continue;
      const uri = urlFor(row);
      if (!uri) continue;
      const old = originalsBySlot.get(row.slot);
      document.querySelectorAll('img').forEach(img => {
        if (img.getAttribute('src') === old || img.dataset.hmManagedSlot === row.slot) {
          if (img.getAttribute('src') !== uri) img.src = uri;
          if (row.alt_text) img.alt = row.alt_text;
          img.dataset.hmManagedSlot = row.slot;
        }
      });
      document.querySelectorAll('[data-lightbox]').forEach(item => {
        if (item.dataset.lightbox === old || item.dataset.hmManagedSlot === row.slot) {
          item.dataset.lightbox = uri;
          item.dataset.hmManagedSlot = row.slot;
        }
      });
      document.querySelectorAll('.goods-item').forEach(item => {
        if (item.dataset.goodsImg === old || item.dataset.hmManagedSlot === row.slot) {
          item.dataset.goodsImg = uri;
          if (row.title) item.dataset.goodsName = row.title;
          if (row.description) item.dataset.goodsDesc = row.description;
          item.dataset.hmManagedSlot = row.slot;
        }
      });
      if (/^card-\d{2}$/.test(row.slot)) window.HM_MANAGED_SET_CARD?.(row.slot, uri);
    }
  }
  function appendGallery(rows) {
    const grid = document.querySelector('#page-daily .manga-grid');
    if (!grid) return;
    grid.querySelectorAll('[data-hm-gallery]').forEach(el => el.remove());
    rows.filter(row => row.kind === 'image' && row.slot.startsWith('gallery-')).forEach((row, index) => {
      const uri = urlFor(row);
      if (!uri) return;
      const button = document.createElement('button');
      button.className = 'manga-item protected-media'; button.type = 'button';
      button.dataset.hmGallery = row.slot;
      const img = document.createElement('img'); img.src = uri; img.alt = row.alt_text || row.title || '헤뭉이 원화';
      img.loading = 'lazy'; img.decoding = 'async'; img.draggable = false;
      const over = document.createElement('span'); over.className = 'manga-overlay';
      const label = document.createElement('b'); label.textContent = row.title || `새로운 원화 ${index + 1}`;
      const more = document.createElement('small'); more.textContent = '원화 크게 보기 ↗';
      const mark = document.createElement('span'); mark.className = 'copyright-seal'; mark.textContent = '© HAEMUNGI · 일현 조성훈';
      over.append(label, more); button.append(img, over, mark);
      button.addEventListener('click', () => {
        const dialog = document.getElementById('assetDialog');
        document.getElementById('dialogImage').src = uri;
        document.getElementById('dialogImage').alt = img.alt;
        document.getElementById('dialogTitle').textContent = row.title || '헤뭉이 원화';
        document.getElementById('dialogDescription').textContent = row.description || '';
        if (dialog && !dialog.open) dialog.showModal();
      });
      grid.append(button);
    });
  }
  function showNewGallery(rows, prefix, gridId, emptyId) {
    const grid = document.getElementById(gridId);
    const empty = document.getElementById(emptyId);
    if (!grid || !empty) return;
    grid.replaceChildren();
    let count = 0;
    rows.filter(r => r.kind === 'image' && r.slot.startsWith(prefix)).forEach(row => {
      const uri = urlFor(row);
      if (!uri) return;
      count++;
      const article = document.createElement('article'); article.className = 'hm-special-card protected-media';
      const img = document.createElement('img'); img.src = uri; img.loading = 'lazy'; img.decoding = 'async'; img.alt = row.alt_text || row.title || '헤뭉이';
      const imageLink = document.createElement('a');
      imageLink.className = 'hm-special-image-link';
      imageLink.href = uri;
      imageLink.target = '_blank';
      imageLink.rel = 'noopener noreferrer';
      imageLink.setAttribute('aria-label', `${row.title || '헤뭉이'} 원본 크게 보기`);
      imageLink.append(img);
      const copy = document.createElement('div'); copy.className = 'hm-special-card-copy';
      const title = document.createElement('h3'); title.textContent = row.title || '헤뭉이';
      const description = document.createElement('p'); description.textContent = row.description || '';
      copy.append(title, description); article.append(imageLink, copy); grid.append(article);
    });
    empty.hidden = count > 0;
  }
  function addVideos(rows) {
    const grid = document.querySelector('#page-videos .videos-grid');
    if (!grid) return;
    grid.querySelectorAll('[data-hm-video]').forEach(el => el.remove());
    const videos = rows.filter(row => row.kind === 'video');
    grid.querySelectorAll('.video-tile:not([data-hm-video])').forEach(tile => {
      tile.hidden = videos.length > 0;
      tile.dataset.hmDefaultHidden = videos.length > 0 ? 'true' : 'false';
    });
    videos.forEach(row => {
      const uri = urlFor(row);
      if (!uri) return;
      const card = document.createElement('article');
      card.className = 'video-tile hm-live-video'; card.dataset.hmVideo = row.slot;
      card.dataset.videoKind = 'short';
      const activeFilter = document.querySelector('[data-filter].active')?.dataset.filter || 'all';
      card.hidden = activeFilter !== 'all' && card.dataset.videoKind !== activeFilter;
      const media = document.createElement('div'); media.className = 'hm-video-frame';
      const id = youtubeId(uri);
      if (id) {
        const button = document.createElement('button'); button.className = 'hm-video-play'; button.type = 'button';
        button.textContent = '▶ 동영상 재생';
        button.addEventListener('click', () => {
          const frame = document.createElement('iframe');
          frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1`;
          frame.title = row.title || '헤뭉이 영상'; frame.allow = 'accelerometer; autoplay; encrypted-media; picture-in-picture';
          frame.allowFullscreen = true;
          media.replaceChildren(frame);
        });
        media.append(button);
      } else if (/\.(mp4|webm)(\?|#|$)/i.test(uri)) {
        const video = document.createElement('video');
        video.controls = true; video.preload = 'metadata'; video.playsInline = true; video.src = uri;
        media.append(video);
      } else {
        const a = document.createElement('a'); a.href = uri; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = '영상 보기 ↗';
        media.append(a);
      }
      const label = document.createElement('small'); label.textContent = 'HAEMUNGI FILM';
      const title = document.createElement('h3'); title.textContent = row.title || '헤뭉이 영상';
      const desc = document.createElement('p'); desc.textContent = row.description || '';
      card.append(media, label, title, desc); grid.prepend(card);
    });
  }
  function setupMusic(rows) {
    const row = rows.find(row => row.kind === 'audio' && row.slot === 'music-main');
    const uri = urlFor(row);
    if (!uri) {
      if (audio) audio.pause();
      window.HM_MANAGED_AUDIO_TOGGLE = null;
      return;
    }
    if (audioURL !== uri) {
      if (audio) audio.pause();
      audio = new Audio(uri); audio.loop = true; audio.volume = 0.35; audio.preload = 'none';
      audioURL = uri;
    }
    window.HM_MANAGED_AUDIO_TOGGLE = async () => {
      const button = document.getElementById('musicButton');
      if (!audio || !button) return;
      try {
        if (audio.paused) await audio.play(); else audio.pause();
        const playing = !audio.paused;
        button.setAttribute('aria-pressed', String(playing));
        button.setAttribute('aria-label', playing ? '배경 음악 끄기' : '배경 음악 켜기');
        button.querySelector('.music-caption').textContent = playing ? '음악 끄기' : '음악 켜기';
        window.HM_STATS?.track('music_toggle', 'home', playing ? 'on' : 'off');
      } catch (_) { console.warn('배경음악 재생을 허용하지 않는 브라우저입니다.'); }
    };
    window.addEventListener('pagehide', () => audio?.pause(), {once: true});
  }
  window.HM_MANAGED_APPLY = () => {
    if (publishedRows.length === 0) return;
    applyImages(publishedRows);
    appendGallery(publishedRows);
    showNewGallery(publishedRows, 'today-', 'hmTodayGrid', 'hmTodayEmpty');
    showNewGallery(publishedRows, 'emoticon-', 'hmEmoticonGrid', 'hmEmoticonEmpty');
    addVideos(publishedRows);
    setupMusic(publishedRows);
  };

  async function loadPublished() {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch(`${config.projectUrl}/rest/v1/hm_media_public?select=slot,kind,title,description,alt_text,source_path,source_url&is_published=eq.true`, {
        headers: {apikey: config.publishableKey, Accept: 'application/json'},
        signal: controller.signal, cache: 'no-store'
      });
      if (!response.ok) return;
      const result = await response.json();
      if (!Array.isArray(result)) return;
      publishedRows = result.filter(row => typeof row.slot === 'string' &&
        ['image','video','audio'].includes(row.kind) && urlFor(row));
      window.HM_MANAGED_APPLY();
    } catch (_) { /* Keep the approved built-in original assets. */ }
    finally { clearTimeout(timeout); }
  }
  loadPublished();
})();
