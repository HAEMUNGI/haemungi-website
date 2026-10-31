(() => {
  'use strict';
  const pages = new Set(['home', 'videos', 'cards', 'daily', 'goods', 'room', 'about', 'today', 'creator', 'emoticons']);
  const menu = document.getElementById('menu');
  const menuButton = document.getElementById('menuToggle');
  const musicButton = document.getElementById('musicButton');
  const musicCaption = musicButton.querySelector('.music-caption');
  const header = document.getElementById('header');
  const main = document.getElementById('main');
  const toast = document.getElementById('toast');
  let priorFocus = null;
  let toastTimer = null;
  let storyReady = false;

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('shown');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('shown'), 2600);
  }

  function closeMenu(restoreFocus = false) {
    if (!menu.classList.contains('open')) return;
    menu.classList.remove('open');
    menu.inert = true;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', '메뉴 열기');
    document.body.classList.remove('menu-open');
    if (restoreFocus) (priorFocus || menuButton).focus();
  }

  function openMenu() {
    priorFocus = document.activeElement;
    menu.inert = false;
    menu.classList.add('open');
    menuButton.setAttribute('aria-expanded', 'true');
    menuButton.setAttribute('aria-label', '메뉴 닫기');
    document.body.classList.add('menu-open');
    menu.querySelector('a')?.focus();
  }

  menuButton.addEventListener('click', () => {
    if (menu.classList.contains('open')) closeMenu(true);
    else openMenu();
  });

  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [menuButton, ...menu.querySelectorAll('a')];
    const i = focusable.indexOf(document.activeElement);
    if (event.shiftKey && i === 0) { event.preventDefault(); focusable.at(-1).focus(); }
    else if (!event.shiftKey && i === focusable.length - 1) { event.preventDefault(); focusable[0].focus(); }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('open')) closeMenu(true);
  });

  const revealObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) {
        e.target.classList.add('visible');
        revealObserver.unobserve(e.target);
      }
    }, { threshold: .12, rootMargin: '0px 0px 36px 0px' })
    : null;
  function animateReveals() {
    document.querySelectorAll('.page.active .reveal').forEach(el => {
      if (revealObserver) revealObserver.observe(el);
      else el.classList.add('visible');
    });
  }
  function routeTo(name, focusContent = false) {
    const target = pages.has(name) ? name : 'home';
    for (const page of document.querySelectorAll('.page')) {
      const active = page.dataset.view === target;
      page.hidden = !active;
      page.classList.toggle('active', active);
    }
    document.querySelectorAll('[data-page]').forEach(a => {
      if (a.dataset.page === target) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    closeMenu();
    document.title = target === 'home'
      ? '헤뭉이의 작은 세계 | HAEMUNGI'
      : ({
        videos: '헤뭉이 영상',
        cards: '헤뭉이 카드뉴스',
        daily: '헤뭉이 일상다반사',
        goods: '헤뭉이 굿즈',
        room: '헤뭉이의 방',
        about: '헤뭉이 소개',
        today: '헤뭉이의 오늘', creator: '캐릭터 제작자소개', emoticons: '헤뭉이 이모티콘'
      }[target]) + ' | 헤뭉이의 작은 세계';
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (focusContent) main.focus({ preventScroll: true });
    if (target === 'cards' && storyReady) renderStory();
    window.HM_STATS?.track('page_view', target);
    if (target === 'daily') window.HM_STATS?.observeDiaries();
    animateReveals();
  }
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-page]');
    if (!link) return;
    const target = link.dataset.page;
    if (!pages.has(target)) return;
    event.preventDefault();
    if (location.hash !== '#' + target) location.hash = target;
    else routeTo(target, true);
  });
  window.addEventListener('hashchange', () => routeTo(location.hash.slice(1), true));
  routeTo(location.hash.slice(1));

  const scrollHeader = () => header.classList.toggle('scrolled', window.scrollY > 15);
  scrollHeader();
  window.addEventListener('scroll', scrollHeader, { passive: true });

  document.querySelectorAll('.flip-card').forEach(card => {
    card.addEventListener('click', () => {
      const flipped = !card.classList.contains('flipped');
      card.classList.toggle('flipped', flipped);
      card.setAttribute('aria-pressed', String(flipped));
    });
  });

  document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
    const chosen = button.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach(chip => {
      const active = chip === button;
      chip.classList.toggle('active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll('[data-video-kind]').forEach(card => {
      card.hidden = card.dataset.hmDefaultHidden === 'true' ||
        (chosen !== 'all' && card.dataset.videoKind !== chosen);
    });
  }));

  // The nine renewed official card-news artworks, each a full-resolution independent image.
  let storyData = [
    { title: '어느 날, 머리카락 한 올이 눈을 떴다.', body: '햇살이 드는 방. 바닥에 떨어진 머리카락 한 올이 조용히 눈을 뜨기 시작했어요.' },
    { title: '눈을 뜬 헤뭉이.', body: '어느 날, 바닥에 떨어진 머리카락 한 올이 눈을 떴다.' },
    { title: '첫걸음.', body: '한 걸음. 세상은 생각보다 훨씬 넓었다.' },
    { title: '따뜻하네.', body: '헤뭉이가 처음 발견한 보물은 햇살 한 조각이었다.' },
    { title: '앗!', body: '바람은 인사도 없이 헤뭉이를 데리고 갔다.' },
    { title: '너는 누구야?', body: '처음으로 누군가 헤뭉이를 발견했다.' },
    { title: '헤뭉이.', body: '그날, 이름이 없던 작은 털뭉치에게 이름이 생겼다.' },
    { title: '돌아갈 자리.', body: '세상은 여전히 컸지만, 이제 무섭지 않았다. 헤뭉이에게도 돌아갈 자리가 생겼으니까.' },
    { title: '내일도, 또 다른 세상이야.', body: '아주 작지만, 매일 새로운 세상을 발견하는 작은 기적.' }
  ].map((scene, i) => ({
    ...scene, slug: `card-${String(i + 1).padStart(2, '0')}`,
    art: `assets/cardnews-01-${String(i + 1).padStart(2, '0')}.webp`
  }));
  let birthStoryData = storyData.map(scene => ({...scene}));
  const managedBirthCardImages = new Map();
  const managedStorySeries = new Map();
  let selectedStorySeries = 'birth';
  let storyPage = 0;
  const storyImage = document.getElementById('storyImage');
  const storyTitle = document.getElementById('storyTitle');
  const storyBody = document.getElementById('storyBody');
  const storyCounter = document.getElementById('storyCounter');
  const storyDots = document.getElementById('storyDots');
  const storyThumbs = document.getElementById('storyThumbs');
  const storyArt = document.getElementById('storyArt');
  const seriesSelect = document.getElementById('cardSeriesSelect');
  function selectStorySeries(id) {
    const source = id === 'birth' ? birthStoryData : managedStorySeries.get(id);
    if (!source?.length) return;
    selectedStorySeries = id;
    storyData = source.map(scene => ({...scene}));
    storyPage = 0;
    seriesSelect.value = id;
    thumbs = buildStoryControls();
    renderStory();
  }
  seriesSelect.addEventListener('change', () => selectStorySeries(seriesSelect.value));
  function buildStoryControls() {
    storyThumbs.replaceChildren();
    storyDots.replaceChildren();
    return storyData.map((scene, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'story-thumb';
    button.setAttribute('aria-label', `${i + 1}장: ${scene.title}`);
    button.setAttribute('aria-pressed', String(i === 0));
    const img = document.createElement('img');
    img.src = scene.art;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.draggable = false;
    const label = document.createElement('span');
    label.textContent = String(i + 1).padStart(2, '0');
    button.append(img, label);
    button.addEventListener('click', () => { storyPage = i; renderStory(); });
    storyThumbs.append(button);
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `${i + 1}장으로 이동`);
    dot.addEventListener('click', () => { storyPage = i; renderStory(); });
    storyDots.append(dot);
      return button;
    });
  }
  let thumbs = buildStoryControls();
  function renderStory() {
    const current = storyData[storyPage];
    if (location.hash === '#cards') window.HM_STATS?.track('card_view', 'cards', current.slug);
    if (storyImage.getAttribute('src') !== current.art) storyImage.src = current.art;
    storyImage.alt = `${storyPage + 1}장: ${current.title} — 헤뭉이 공식 카드뉴스 삽화`;
    storyTitle.textContent = current.title;
    storyBody.textContent = current.body;
    storyCounter.textContent = `${String(storyPage + 1).padStart(2, '0')} / ${String(storyData.length).padStart(2, '0')}`;
    thumbs.forEach((button, i) => {
      const active = i === storyPage;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
      const dot = storyDots.children[i];
      dot.classList.toggle('active', active);
      dot.setAttribute('aria-current', active ? 'step' : 'false');
    });
  }
  // Allow optional published CMS artwork to replace a card without losing the carousel.
  window.HM_MANAGED_SET_CARD = (slug, art) => {
    if (!/^card-\d{2}$/.test(slug) || !/^https:\/\//.test(art)) return;
    const item = birthStoryData.find(scene => scene.slug === slug);
    if (!item) return;
    managedBirthCardImages.set(slug, art);
    item.art = art;
    if (selectedStorySeries === 'birth') {
      const current = storyData.find(scene => scene.slug === slug);
      if (current) current.art = art;
      thumbs = buildStoryControls(); renderStory();
    }
  };
  window.HM_MANAGED_SET_SERIES = series => {
    managedStorySeries.clear();
    series.forEach(({id, pages}) => {
      if (!/^[a-z0-9]+$/.test(id) || !Array.isArray(pages) || !pages.length) return;
      managedStorySeries.set(id, pages);
    });
    seriesSelect.replaceChildren(new Option('첫 번째 이야기 · 헤뭉이의 탄생 (9장)', 'birth'));
    for (const [id, pages] of managedStorySeries) {
      const seriesName = pages[0]?.seriesTitle || pages[0]?.title || '새 이야기';
      seriesSelect.add(new Option(`${seriesName} (${pages.length}장)`, id));
    }
    if (selectedStorySeries !== 'birth' && !managedStorySeries.has(selectedStorySeries)) selectStorySeries('birth');
    else seriesSelect.value = selectedStorySeries;
  };
  const changeStory = (delta) => { storyPage = (storyPage + delta + storyData.length) % storyData.length; renderStory(); };
  document.getElementById('storyPrev').addEventListener('click', () => {
    changeStory(-1);
  });
  document.getElementById('storyNext').addEventListener('click', () => {
    changeStory(1);
  });
  let swipeStart = null;
  let ignoreNextArtClick = false;
  storyArt.addEventListener('touchstart', event => {
    if (event.touches.length === 1) swipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }, { passive: true });
  storyArt.addEventListener('touchend', event => {
    if (!swipeStart || !event.changedTouches.length) return;
    const dx = event.changedTouches[0].clientX - swipeStart.x;
    const dy = event.changedTouches[0].clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      ignoreNextArtClick = true;
      changeStory(dx < 0 ? 1 : -1);
      setTimeout(() => { ignoreNextArtClick = false; }, 500);
    }
  }, { passive: true });
  storyArt.addEventListener('click', () => {
    if (ignoreNextArtClick) { ignoreNextArtClick = false; return; }
    changeStory(1);
  });
  document.addEventListener('keydown', event => {
    if (location.hash !== '#cards' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); changeStory(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); changeStory(-1); }
  });
  storyReady = true;
  if (location.hash === '#cards') renderStory();

  // Actual product-like browsing and sorting, but deliberately no fictitious checkout.
  const goodsGrid = document.getElementById('goodsGrid');
  const goodsCards = Array.from(goodsGrid.querySelectorAll('.goods-item'));
  const goodsFallbackSlugs = ['shirt', 'cap', 'keyring', 'phonecase', 'mug',
    'coin', 'stickers', 'totebag', 'notebook', 'plush'];
  goodsCards.forEach((card, i) => { card.dataset.goodsSlug = goodsFallbackSlugs[i]; });
  const goodsSearch = document.getElementById('goodsSearch');
  const goodsSort = document.getElementById('goodsSort');
  let goodsCategory = 'all';
  const goodsOriginalOrder = new Map(goodsCards.map((card, i) => [card, i]));
  function renderGoods() {
    const query = goodsSearch.value.trim().toLocaleLowerCase('ko');
    const sort = goodsSort.value;
    const locale = window.HM_I18N?.getLocale?.() || 'ko';
    const translatedName = card => window.HM_I18N?.translateString?.(card.dataset.goodsName) || card.dataset.goodsName;
    const arranged = [...goodsCards].sort((a, b) => {
      if (sort === 'name') return translatedName(a).localeCompare(translatedName(b), locale);
      if (sort === 'kind') return a.dataset.goodsKind.localeCompare(b.dataset.goodsKind, 'ko');
      return goodsOriginalOrder.get(a) - goodsOriginalOrder.get(b);
    });
    goodsGrid.append(...arranged);
    let count = 0;
    arranged.forEach(card => {
      const shown = card.dataset.published !== 'false' &&
        (goodsCategory === 'all' || card.dataset.goodsKind === goodsCategory) &&
        (card.dataset.goodsName + ' ' + translatedName(card)).toLocaleLowerCase().includes(query);
      card.hidden = !shown;
      if (shown) count++;
    });
    document.getElementById('goodsCount').textContent = `${count}가지 콘셉트`;
    document.getElementById('goodsNoResults').hidden = count > 0;
  }
  window.HM_MANAGED_ADD_GOODS = products => {
    // Only remove products injected by the CMS; the original ten are permanent.
    goodsCards.filter(card => card.dataset.hmNewGoods).forEach(card => {
      goodsOriginalOrder.delete(card); card.remove();
    });
    for (let i = goodsCards.length - 1; i >= 0; i--) if (goodsCards[i].dataset.hmNewGoods) goodsCards.splice(i, 1);
    products.forEach(product => {
      if (!/^goods-new-[a-z0-9-]+$/.test(product.slot) || !/^https:\/\//.test(product.image)) return;
      const card = document.createElement('button'); card.type = 'button'; card.className = 'goods-item';
      card.dataset.hmNewGoods = product.slot;
      card.dataset.goodsKind = 'collectible'; card.dataset.goodsSlug = product.slot;
      card.dataset.goodsName = product.name; card.dataset.goodsDesc = product.description;
      card.dataset.goodsImg = product.image;
      const thumb = document.createElement('span'); thumb.className = 'goods-thumb protected-media';
      const img = document.createElement('img'); img.src = product.image; img.alt = product.alt || product.name;
      img.loading = 'lazy'; img.decoding = 'async';
      const badge = document.createElement('span'); badge.className = 'goods-badge'; badge.textContent = 'COMING SOON';
      thumb.append(img, badge);
      const kind = document.createElement('span'); kind.className = 'goods-category'; kind.textContent = 'NEW COLLECTION';
      const title = document.createElement('strong'); title.textContent = product.name;
      const action = document.createElement('span'); action.className = 'goods-bottom'; action.textContent = '상세 디자인 보기 ↗';
      card.append(thumb, kind, title, action);
      goodsCards.push(card); goodsOriginalOrder.set(card, goodsOriginalOrder.size);
      goodsGrid.append(card);
    });
    renderGoods();
  };
  document.querySelectorAll('[data-goods-filter]').forEach(button => button.addEventListener('click', () => {
    goodsCategory = button.dataset.goodsFilter;
    window.HM_STATS?.track('goods_filter', 'goods', goodsCategory);
    document.querySelectorAll('[data-goods-filter]').forEach(b => {
      const active = b === button;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    renderGoods();
  }));
  goodsSearch.addEventListener('input', renderGoods);
  goodsSearch.addEventListener('change', () => {
    if (goodsSearch.value.trim()) window.HM_STATS?.track('goods_search', 'goods');
  });
  goodsSort.addEventListener('change', renderGoods);
  renderGoods();

  const assetDialog = document.getElementById('assetDialog');
  const dialogImage = document.getElementById('dialogImage');
  const dialogTitle = document.getElementById('dialogTitle');
  const dialogDescription = document.getElementById('dialogDescription');
  function openAsset(src, title, description) {
    dialogImage.src = src;
    dialogImage.alt = title;
    dialogTitle.textContent = title;
    dialogDescription.textContent = description || '';
    if (!assetDialog.open) assetDialog.showModal();
  }
  document.querySelectorAll('[data-lightbox]').forEach(button => button.addEventListener('click', () => {
    const artIndex = Array.from(document.querySelectorAll('[data-lightbox]')).indexOf(button) + 1;
    window.HM_STATS?.track('artwork_open', 'daily', `daily-art-${String(artIndex).padStart(2, '0')}`);
    openAsset(button.dataset.lightbox, button.dataset.caption, '제공된 헤뭉이 원본 그림입니다.');
  }));
  goodsGrid.addEventListener('click', event => {
    const item = event.target.closest('.goods-item');
    if (!item) return;
    window.HM_STATS?.track('goods_detail', 'goods', item.dataset.goodsSlug);
    openAsset(item.dataset.goodsImg, item.dataset.goodsName + ' · 제작 준비 중', item.dataset.goodsDesc + ' 실제 판매 상품은 아닙니다.');
  });
  document.getElementById('dialogClose').addEventListener('click', () => assetDialog.close());
  assetDialog.addEventListener('click', event => {
    if (event.target === assetDialog) assetDialog.close();
  });

  const roomItems = {
    window: { icon: '☀', label: '햇살 드는 창문', desc: '헤뭉이는 따뜻한 자리를 가장 먼저 알아차려요. 창가에 앉아 아무것도 하지 않아도 괜찮답니다.', link: 'daily', button: '일상 이야기 보기' },
    bell: { icon: '♫', label: '조그만 방울', desc: '처음엔 낯선 소리가 무서웠지만, 작은 딸랑거림과 친구가 되었어요. 어떻게 만났는지 읽어볼까요?', link: 'cards', button: '방울 이야기 읽기' },
    haemungi: { icon: '♡', label: '낮잠 자는 헤뭉이', desc: '쉿, 지금은 낮잠 시간. 조금 느려도 괜찮다는 것을 헤뭉이에게 배워요.', link: 'about', button: '헤뭉이 알아보기' },
    frame: { icon: '✿', label: '작은 그림 액자', desc: '오늘 만난 순간을 이곳에 남겨요. 아무 뜻 없는 낙서도 헤뭉이에게는 소중한 기억이에요.', link: 'daily', button: '원화 감상하기' },
    books: { icon: '✧', label: '이야기가 잠든 책장', desc: '책에는 헤뭉이의 질문들이 살아요. 바람은 어디에서 올까? 작은 용기는 무슨 모양일까?', link: 'cards', button: '카드뉴스 넘기기' },
    mug: { icon: '☕', label: '따끈한 머그잔', desc: '따뜻한 것을 좋아하는 헤뭉이답죠? 머그컵도 작은 굿즈로 상상해 보았어요.', link: 'goods', button: '굿즈 진열장 보기' },
    shelf: { icon: '✦', label: '반짝이는 진열장', desc: '동전, 인형, 방울, 키링까지. 아직은 상상 속 소장품이지만 하나씩 차곡차곡 전시 중이에요.', link: 'goods', button: '굿즈 둘러보기' }
  };
  const roomPanel = {
    icon: document.getElementById('roomIcon'),
    eyebrow: document.getElementById('roomEyebrow'),
    title: document.getElementById('roomTitle'),
    description: document.getElementById('roomDescription'),
    link: document.getElementById('roomLink')
  };
  document.querySelectorAll('[data-room-item]').forEach(button => button.addEventListener('click', () => {
    const item = roomItems[button.dataset.roomItem];
    if (!item) return;
    window.HM_STATS?.track('room_spot', 'room', button.dataset.roomItem);
    document.querySelectorAll('[data-room-item]').forEach(b => b.classList.toggle('active', b === button));
    roomPanel.icon.textContent = item.icon;
    roomPanel.eyebrow.textContent = 'YOU FOUND A LITTLE STORY';
    roomPanel.title.textContent = item.label;
    roomPanel.description.textContent = item.desc;
    roomPanel.link.href = '#' + item.link;
    roomPanel.link.dataset.page = item.link;
    roomPanel.link.textContent = item.button + ' ↗';
    if (window.matchMedia('(max-width:760px)').matches) roomPanel.title.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }));
  document.getElementById('roomReset').addEventListener('click', () => {
    const viewport = document.getElementById('roomViewport');
    viewport.scrollTo({ left: 0, behavior: 'smooth' });
    document.querySelectorAll('[data-room-item]').forEach(b => b.classList.remove('active'));
    roomPanel.icon.textContent = '✿';
    roomPanel.eyebrow.textContent = 'TAP TO DISCOVER';
    roomPanel.title.textContent = '헤뭉이의 방에 오신 걸 환영해요.';
    roomPanel.description.textContent = '창문, 방울, 작은 친구, 액자, 책장, 찻잔, 진열장. 마음에 드는 물건을 골라보세요.';
    roomPanel.link.href = '#daily';
    roomPanel.link.dataset.page = 'daily';
    roomPanel.link.textContent = '이야기 만나기 ↗';
  });

  // Casual-capture deterrence only. The web cannot conceal shipped HTML or image bytes.
  document.addEventListener('contextmenu', event => {
    if (event.target.closest('.protected-media')) {
      event.preventDefault();
      notify('헤뭉이의 원화는 저작권으로 보호받고 있어요. ♡');
    }
  });
  document.addEventListener('dragstart', event => {
    if (event.target.closest('.protected-media')) event.preventDefault();
  });

  // A tiny original ambient melody. Sound starts only after a visitor gesture.
  let context = null;
  let master = null;
  let playing = false;
  let scheduler = null;
  let nextBeat = 0;
  let beatNumber = 0;
  const melody = [
    659.25, 0, 783.99, 0, 880, 783.99, 659.25, 0,
    587.33, 0, 659.25, 0, 523.25, 0, 587.33, 0,
    659.25, 0, 783.99, 0, 987.77, 880, 783.99, 0,
    698.46, 0, 659.25, 0, 587.33, 0, 523.25, 0
  ];
  const chords = [
    [261.63, 329.63, 392], [220, 261.63, 329.63],
    [174.61, 261.63, 349.23], [196, 293.66, 392]
  ];
  function playTone(frequency, when, duration, volume, wave = 'sine') {
    if (!context || !master || !frequency) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(frequency, when);
    gain.gain.setValueAtTime(.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, volume), when + .035);
    gain.gain.exponentialRampToValueAtTime(.0001, when + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(when);
    osc.stop(when + duration + .08);
  }
  function scheduleMusic() {
    if (!playing || !context) return;
    const beatLength = .42;
    while (nextBeat < context.currentTime + .2) {
      const n = beatNumber % melody.length;
      if (melody[n]) playTone(melody[n], nextBeat, .66, .11);
      if (n % 8 === 0) {
        const chord = chords[Math.floor(n / 8)];
        chord.forEach((freq, i) => playTone(freq / (i === 0 ? 2 : 1), nextBeat, 2.7, .025, 'sine'));
      }
      if (n % 4 === 2) playTone(1046.5, nextBeat + .13, .4, .018);
      nextBeat += beatLength;
      beatNumber++;
    }
  }
  async function toggleMusic() {
    if (typeof window.HM_MANAGED_AUDIO_TOGGLE === 'function') {
      if (playing && context) {
        playing = false;
        clearInterval(scheduler);
        await context.suspend();
      }
      return window.HM_MANAGED_AUDIO_TOGGLE();
    }
    try {
      if (!context) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) { notify('이 브라우저에서는 음악 재생을 지원하지 않아요.'); return; }
        context = new AudioCtx();
        master = context.createGain();
        master.gain.value = .32;
        master.connect(context.destination);
      }
      if (playing) {
        playing = false;
        clearInterval(scheduler);
        await context.suspend();
      } else {
        await context.resume();
        nextBeat = context.currentTime + .05;
        playing = true;
        scheduleMusic();
        scheduler = setInterval(scheduleMusic, 110);
      }
      musicButton.setAttribute('aria-pressed', String(playing));
      musicButton.setAttribute('aria-label', playing ? '배경 음악 끄기' : '배경 음악 켜기');
      musicCaption.textContent = playing ? '음악 끄기' : '음악 켜기';
      window.HM_STATS?.track('music_toggle',
        pages.has(location.hash.slice(1)) ? location.hash.slice(1) : 'home',
        playing ? 'on' : 'off');
      notify(playing ? '헤뭉이의 작은 음악이 흐르고 있어요 ♫' : '음악을 잠시 쉬게 했어요.');
    } catch {
      notify('음악을 재생할 수 없어요. 다시 눌러 주세요.');
    }
  }
  musicButton.addEventListener('click', toggleMusic);
  window.addEventListener('pagehide', () => {
    if (playing && context) context.suspend();
  });

  // Optional read-only Supabase catalog. Without the publishable key (or during
  // an API outage), every existing page and its original artwork still works.
  async function syncPublishedContent() {
    const config = window.HAEMUNGI_CONTENT_CONFIG;
    if (!config || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.projectUrl || '')) return;
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey || '')) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const read = async (table, order) => {
      const url = new URL(`/rest/v1/${table}`, config.projectUrl);
      url.searchParams.set('select', '*');
      url.searchParams.set('order', order);
      const response = await fetch(url, {
        headers: { apikey: config.publishableKey, Accept: 'application/json' },
        signal: controller.signal,
        cache: 'no-store'
      });
      if (!response.ok) throw new Error(`Catalog read ${table}: ${response.status}`);
      const result = await response.json();
      if (!Array.isArray(result)) throw new Error('Unexpected catalog response');
      return result;
    };
    try {
      const [assetsRows, goodsRows, storyRows, roomRows, settingRows] = await Promise.all([
        read('hm_assets', 'display_order.asc'),
        read('hm_goods', 'display_order.asc'),
        read('hm_stories', 'scene_number.asc'),
        read('hm_room_spots', 'display_order.asc'),
        read('hm_site_settings', 'key.asc')
      ]);
      // All paths are local site assets, never arbitrary URLs or HTML.
      const safePath = path => typeof path === 'string' &&
        /^assets\/[a-zA-Z0-9/_-]+\.(webp|png|jpg|jpeg)$/.test(path);
      const assetMap = new Map(assetsRows.filter(a => safePath(a.path)).map(a => [a.slug, a.path]));

      const cards = storyRows.filter(s => s.kind === 'cardnews' && s.series_slug === 'birth')
        .sort((a, b) => a.scene_number - b.scene_number)
        .map(s => ({
          slug: s.slug,
          title: s.title,
          body: s.body,
          art: assetMap.get(s.asset_slug)
        }))
        .filter(s => typeof s.title === 'string' && typeof s.body === 'string' && safePath(s.art));
      if (cards.length > 0) {
        birthStoryData = cards.map(scene => ({...scene, art:managedBirthCardImages.get(scene.slug) || scene.art}));
        if (selectedStorySeries === 'birth') {
          storyData = birthStoryData.map(scene => ({...scene}));
          storyPage = Math.min(storyPage, storyData.length - 1);
          thumbs = buildStoryControls(); renderStory();
        }
      }

      if (goodsRows.length > 0) {
        const byOrder = new Map(goodsRows.map(g => [Number(g.display_order), g]));
        goodsCards.filter(card => !card.dataset.hmNewGoods).forEach((card, index) => {
          const row = byOrder.get(index + 1);
          const art = row && assetMap.get(row.asset_slug);
          if (!row || !art || typeof row.name !== 'string' ||
            typeof row.description !== 'string') {
            card.dataset.published = 'false';
            return;
          }
          card.dataset.published = 'true';
          card.dataset.goodsKind = row.category_slug;
          card.dataset.goodsSlug = row.slug;
          card.dataset.goodsName = row.name;
          card.dataset.goodsDesc = row.description;
          card.dataset.goodsImg = art;
          card.querySelector('strong').textContent = row.name;
          const image = card.querySelector('img');
          image.src = art;
          image.alt = row.name + ' 디자인 시안';
        });
        renderGoods();
      }

      const diaries = storyRows.filter(s => s.kind === 'diary' && s.series_slug === 'little-days');
      if (diaries.length > 0) {
        const diaryByNumber = new Map(diaries.map(d => [Number(d.scene_number), d]));
        document.querySelectorAll('.diary-card').forEach((card, index) => {
          const entry = diaryByNumber.get(index + 1);
          if (!entry) { card.hidden = true; return; }
          card.hidden = false;
          card.querySelector('h3').textContent = entry.title;
          card.querySelector('p').textContent = entry.body;
          card.querySelector('.diary-art').textContent = entry.symbol || '✿';
          card.querySelector('.diary-mood').textContent = '오늘의 기분: ' + (entry.mood || '포근함') + ' ♡';
        });
      }

      if (roomRows.length > 0) {
        const bySlug = new Map(roomRows.map(r => [r.slug, r]));
        document.querySelectorAll('[data-room-item]').forEach(hotspot => {
          const row = bySlug.get(hotspot.dataset.roomItem);
          if (!row || !pages.has(row.link_page)) { hotspot.hidden = true; return; }
          hotspot.hidden = false;
          hotspot.style.setProperty('--x', row.x_percent + '%');
          hotspot.style.setProperty('--y', row.y_percent + '%');
          hotspot.setAttribute('aria-label', row.label + ' 살펴보기');
          roomItems[row.slug] = {
            icon: row.icon, label: row.label, desc: row.description,
            link: row.link_page, button: row.button_label
          };
        });
      }

      const profile = settingRows.find(s => s.key === 'character_profile')?.value;
      if (profile && typeof profile === 'object') {
        const fields = [null, 'birthplace', 'personality', 'likes', 'dislikes', 'features'];
        document.querySelectorAll('dl.profile > div').forEach((pair, index) => {
          const key = fields[index];
          if (key && typeof profile[key] === 'string') {
            pair.querySelector('dd').textContent = profile[key];
          }
        });
      }
    } catch (error) {
      // A catalog read must never prevent visitors from viewing the site.
      console.warn('헤뭉이 원본 콘텐츠를 유지합니다.', error.message);
    } finally {
      clearTimeout(timeout);
      window.HM_MANAGED_APPLY?.();
    }
  }
  syncPublishedContent();

  // Consent is optional. No analytics event is sent before the visitor opts in.
  // Browser-level tracking protection wins even if the visitor presses Allow.
  const consentPanel = document.getElementById('analyticsConsent');
  const consentLauncher = document.getElementById('analyticsLauncher');
  const consentTitle = document.getElementById('analyticsConsentTitle');
  const consentDescription = document.getElementById('analyticsConsentDescription');
  const consentStatus = document.getElementById('analyticsConsentStatus');
  const consentSettings = document.getElementById('analyticsSettings');
  const consentAllow = document.getElementById('analyticsAllow');
  const consentDeny = document.getElementById('analyticsDeny');
  const BLOCKED_NOTICE_KEY = 'hm_analytics_blocked_notice_v1';
  let blockedNoticeDismissed = false;
  try { blockedNoticeDismissed = sessionStorage.getItem(BLOCKED_NOTICE_KEY) === 'seen'; }
  catch (_) { /* Keep the privacy notice visible for this page load. */ }

  function statsStatus() {
    return window.HM_STATS?.getStatus?.() || 'unavailable';
  }

  function refreshConsentView() {
    const status = statsStatus();
    const blocked = status === 'unavailable';
    const isPreview = ['terminal.local', 'localhost', '127.0.0.1'].includes(location.hostname);
    consentTitle.textContent = blocked
      ? isPreview ? '미리보기에서는 방문 통계를 기록하지 않아요.'
        : '이 브라우저에서는 방문 통계가 작동하지 않아요.'
      : '작은 방문 기록을 남겨도 될까요?';
    consentDescription.textContent = blocked
      ? isPreview ? '미리보기의 시험 방문은 통계에 포함하지 않습니다. 실제 사이트에서 방문 기록을 허용하거나 거부할 수 있어요.'
        : '브라우저의 추적 차단 설정이나 통계 스크립트 로딩 문제로 조회 기록을 전송할 수 없습니다. 사이트의 모든 콘텐츠는 그대로 이용할 수 있어요.'
      : '허용하면 헤뭉이의 어떤 이야기가 사랑받는지 익명으로 집계합니다. 거부해도 모든 콘텐츠를 똑같이 이용할 수 있어요.';
    consentAllow.disabled = blocked;
    consentAllow.textContent = blocked ? '허용 불가' : '허용';
    consentDeny.textContent = blocked ? '알겠어요' : '거부';
    consentSettings.textContent = status === 'unavailable'
      ? '방문 통계 차단 중 · 자세히 보기'
      : status === 'yes' ? '통계 수집 허용 중 · 선택 변경'
      : status === 'no' ? '통계 수집 거부 중 · 선택 변경'
      : '통계 수집 선택 변경';
    consentStatus.textContent = blocked
      ? '차단된 상태를 우회하거나 동의 없이 통계를 수집하지 않습니다.'
      : status === 'yes'
      ? '현재 허용 중이에요. 거부하면 이후 기록이 중단됩니다.'
      : status === 'no' ? '현재 거부 중이에요. 언제든 선택을 바꿀 수 있습니다.'
      : '선택하기 전에는 조회 기록을 전송하지 않습니다.';
    consentPanel.hidden = !(status === 'unset' || consentPanel.dataset.open === 'true' ||
      (blocked && !blockedNoticeDismissed));
    consentLauncher.hidden = !consentPanel.hidden;
    consentLauncher.textContent = blocked ? '방문 통계 차단 중' : status === 'yes'
      ? '방문 통계 허용 중' : status === 'no' ? '방문 통계 거부 중' : '방문 통계 설정';
  }

  function changeConsent(allowed) {
    if (statsStatus() === 'unavailable') {
      blockedNoticeDismissed = true;
      try { sessionStorage.setItem(BLOCKED_NOTICE_KEY, 'seen'); } catch (_) { /* Optional preference. */ }
      consentPanel.dataset.open = 'false';
      refreshConsentView();
      return;
    }
    const result = window.HM_STATS?.setConsent?.(allowed);
    consentPanel.dataset.open = 'false';
    refreshConsentView();
    if (result !== 'yes') return;
    const current = pages.has(location.hash.slice(1)) ? location.hash.slice(1) : 'home';
    window.HM_STATS.track('page_view', current);
    if (current === 'cards') {
      const scene = storyData[storyPage];
      if (scene?.slug) window.HM_STATS.track('card_view', 'cards', scene.slug);
    }
    if (current === 'daily') window.HM_STATS.observeDiaries();
  }

  consentAllow.addEventListener('click', () => changeConsent(true));
  consentDeny.addEventListener('click', () => changeConsent(false));
  function openConsentPanel() {
    consentPanel.dataset.open = 'true';
    refreshConsentView();
    (consentAllow.disabled ? consentDeny : consentAllow).focus({ preventScroll: true });
  }
  consentSettings.addEventListener('click', openConsentPanel);
  consentLauncher.addEventListener('click', openConsentPanel);
  refreshConsentView();
})();
