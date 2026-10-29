// Offline, opt-in language selector. Never sends text or browsing data to a translator.
(() => {
  'use strict';
  const rows = window.HAEMUNGI_TRANSLATIONS;
  if (!Array.isArray(rows)) return;
  const locales = ['ko', 'en', 'ja', 'zh'];
  const codes = { ko: 'KO', en: 'EN', ja: 'JA', zh: 'ZH' };
  const packs = { en: new Map(), ja: new Map(), zh: new Map() };
  const normalize = text => String(text).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== 4) continue;
    for (let i = 1; i < 4; i++) packs[locales[i]].set(normalize(row[0]), row[i]);
  }
  const STORAGE_KEY = 'hm_ui_language_v1';
  let locale = 'ko';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (locales.includes(stored)) locale = stored;
  } catch (_) { /* Language still works without local storage. */ }

  const selector = document.getElementById('languageSelector');
  const toggle = document.getElementById('languageToggle');
  const menu = document.getElementById('languageMenu');
  const current = document.getElementById('languageCurrent');
  if (!selector || !toggle || !menu || !current) return;

  const nodeSources = new WeakMap();
  const attributeSources = new WeakMap();
  const attributes = ['aria-label', 'placeholder', 'alt', 'title'];
  let scheduled = false;
  const isExcluded = el => Boolean(el?.closest('script,style,svg,noscript,textarea,[data-no-translate]'));

  function translateString(original, target = locale) {
    if (target === 'ko' || !packs[target] || typeof original !== 'string') return original;
    const key = normalize(original);
    if (!key) return original;
    let result = packs[target].get(key);
    if (result === undefined) {
      const pageTitleSuffix = ' | 헤뭉이의 작은 세계';
      if (key.endsWith(pageTitleSuffix)) {
        const baseTitle = key.slice(0, -pageTitleSuffix.length);
        result = `${translateString(baseTitle, target)} | ${translateString('헤뭉이의 작은 세계', target)}`;
      }
      const arrowLabel = key.match(/^(.+) (↗|→)$/);
      if (arrowLabel && packs[target].has(arrowLabel[1])) {
        result = `${translateString(arrowLabel[1], target)} ${arrowLabel[2]}`;
      }
      const count = key.match(/^(\d+)가지 콘셉트$/);
      if (count) result = target === 'en' ? `${count[1]} ${count[1] === '1' ? 'concept' : 'concepts'}`
        : target === 'ja' ? `${count[1]}種類のコンセプト` : `${count[1]}款概念商品`;
      const numberOfScene = key.match(/^(\d+)장으로 이동$/);
      if (numberOfScene) result = target === 'en' ? `Jump to card ${numberOfScene[1]}`
        : target === 'ja' ? `${numberOfScene[1]}枚目に移動` : `跳到第${numberOfScene[1]}张`;
      const sceneLabel = key.match(/^(\d+)장: (.+)$/);
      if (sceneLabel) result = target === 'en' ? `Card ${sceneLabel[1]}: ${translateString(sceneLabel[2], target)}`
        : target === 'ja' ? `${sceneLabel[1]}枚目：${translateString(sceneLabel[2], target)}`
          : `第${sceneLabel[1]}张：${translateString(sceneLabel[2], target)}`;
      const goodsTitle = key.match(/^(.+) · 제작 준비 중$/);
      if (goodsTitle) result = `${translateString(goodsTitle[1], target)} · ${translateString('제작 준비 중', target)}`;
      const goodsDescription = key.match(/^(.+) 실제 판매 상품은 아닙니다\.$/);
      if (goodsDescription) result = `${translateString(goodsDescription[1], target)} ${translateString('실제 판매 상품은 아닙니다.', target)}`;
      const storyAlt = key.match(/^(\d+)장: (.+) — 헤뭉이 공식 카드뉴스 삽화$/);
      if (storyAlt) result = `${translateString(`${storyAlt[1]}장: ${storyAlt[2]}`, target)} · HAEMUNGI story illustration`;
      const goodAlt = key.match(/^(.+) 디자인 시안$/);
      if (goodAlt) result = `${translateString(goodAlt[1], target)} · concept design`;
      const hotspotAlt = key.match(/^(.+) 살펴보기$/);
      if (hotspotAlt) result = `${translateString(hotspotAlt[1], target)} · explore`;
    }
    if (result === undefined) return original;
    const first = original.search(/\S/);
    if (first === -1) return original;
    const last = original.length - original.trimEnd().length;
    return original.slice(0, first) + result + (last ? original.slice(-last) : '');
  }

  function applyToText(node) {
    if (isExcluded(node.parentElement)) return;
    const actual = node.nodeValue;
    let source = nodeSources.get(node);
    if (!source || actual !== source.rendered) source = { original: actual, rendered: actual };
    const translated = translateString(source.original);
    source.rendered = translated;
    nodeSources.set(node, source);
    if (actual !== translated) node.nodeValue = translated;
  }

  function applyToAttributes(element) {
    if (isExcluded(element)) return;
    let saved = attributeSources.get(element) || {};
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      const actual = element.getAttribute(name);
      let source = saved[name];
      if (!source || actual !== source.rendered) source = { original: actual, rendered: actual };
      const translated = translateString(source.original);
      source.rendered = translated;
      saved[name] = source;
      if (actual !== translated) element.setAttribute(name, translated);
    }
    attributeSources.set(element, saved);
  }

  function applyLanguage() {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hans' : locale;
    current.textContent = codes[locale];
    menu.querySelectorAll('[data-lang]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.lang === locale));
    });
    const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) applyToText(walker.currentNode);
    document.querySelectorAll('[aria-label],[placeholder],[alt],[title]').forEach(applyToAttributes);
  }

  function scheduleTranslation() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyLanguage();
    });
  }
  const observer = new MutationObserver(scheduleTranslation);
  observer.observe(document.documentElement, {
    subtree: true, characterData: true, childList: true, attributes: true,
    attributeFilter: attributes
  });

  function closePicker(restoreFocus = false) {
    if (menu.hidden) return;
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (restoreFocus) toggle.focus();
  }
  function openPicker() {
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    menu.querySelector('[aria-pressed="true"]')?.focus();
  }
  function setLocale(nextLocale) {
    if (!locales.includes(nextLocale)) return;
    locale = nextLocale;
    try { localStorage.setItem(STORAGE_KEY, locale); } catch (_) { /* Optional preference. */ }
    applyLanguage();
    closePicker(true);
    // Keeps search results and the visible product counter coherent after switching.
    document.getElementById('goodsSearch')?.dispatchEvent(new Event('input', { bubbles: true }));
  }
  toggle.addEventListener('click', () => menu.hidden ? openPicker() : closePicker(true));
  menu.querySelectorAll('[data-lang]').forEach(button => button.addEventListener('click', () => {
    setLocale(button.dataset.lang);
  }));
  document.addEventListener('click', event => {
    if (!selector.contains(event.target)) closePicker();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closePicker(true);
  });
  applyLanguage();
  window.HM_I18N = Object.freeze({
    getLocale: () => locale,
    translateString,
    setLocale
  });
})();
