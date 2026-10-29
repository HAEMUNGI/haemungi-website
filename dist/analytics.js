// HAEMUNGI privacy-conscious, write-only view telemetry.
// The schema is installed separately with 003_haemungi_analytics.sql.
(() => {
  'use strict';
  const config = window.HAEMUNGI_CONTENT_CONFIG;
  const disabled = !config || !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.projectUrl || '') ||
    !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey || '') ||
    !location.protocol.startsWith('http') ||
    ['localhost', '127.0.0.1', 'terminal.local'].includes(location.hostname) ||
    navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true ||
    /bot|crawler|spider|lighthouse|headless/i.test(navigator.userAgent || '');

  const pages = new Set(['home', 'videos', 'cards', 'daily', 'goods', 'room', 'about']);
  const kinds = new Set([
    'page_view', 'goods_detail', 'card_view', 'room_spot', 'diary_view',
    'artwork_open', 'goods_filter', 'goods_search', 'music_toggle'
  ]);
  const recent = new Map();
  const SESSION_KEY = 'hm_anonymous_session_v1';
  const CONSENT_KEY = 'hm_analytics_consent_v1';
  const MAX_IDLE_MS = 30 * 60 * 1000;
  let sessionId = null;
  let sourceKind = 'direct';
  let consent = 'unset';
  try {
    const saved = localStorage.getItem(CONSENT_KEY);
    if (saved === 'yes' || saved === 'no') consent = saved;
  } catch (_) { /* Storage unavailable: consent must be obtained each visit. */ }
  const sources = new Set(['threads','instagram','youtube','naver','google',
    'facebook','kakao','tiktok','direct','other']);

  function detectSource() {
    const campaign = new URLSearchParams(location.search).get('utm_source')?.toLowerCase().trim();
    if (campaign && sources.has(campaign)) return campaign;
    if (campaign === 'ig') return 'instagram';
    if (campaign === 'yt') return 'youtube';
    if (campaign === 'fb') return 'facebook';
    try {
      if (!document.referrer) return 'direct';
      const hostname = new URL(document.referrer).hostname.toLowerCase();
      if (!hostname || hostname === location.hostname) return 'direct';
      const targets = [
        ['threads', /(^|\.)threads\.(net|com)$/],
        ['instagram', /(^|\.)instagram\.com$/],
        ['youtube', /(^|\.)(youtube\.com|youtu\.be)$/],
        ['naver', /(^|\.)naver\.com$/],
        ['google', /(^|\.)google\.[a-z.]+$/],
        ['facebook', /(^|\.)(facebook\.com|fb\.com)$/],
        ['kakao', /(^|\.)(kakao\.com|daum\.net)$/],
        ['tiktok', /(^|\.)tiktok\.com$/]
      ];
      return targets.find(([, re]) => re.test(hostname))?.[0] || 'other';
    } catch (_) { return 'other'; }
  }

  function getSessionId() {
    const now = Date.now();
    try {
      const old = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (old && /^[0-9a-f-]{36}$/i.test(old.id) &&
          now >= old.updated && now - old.updated < MAX_IDLE_MS) {
        sessionId = old.id;
        sourceKind = sources.has(old.source) ? old.source : 'direct';
      } else {
        sessionId = crypto.randomUUID();
        sourceKind = detectSource();
      }
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        id: sessionId, updated: now, source: sourceKind
      }));
    } catch (_) {
      sessionId = sessionId || crypto.randomUUID();
      sourceKind = detectSource();
    }
    return sessionId;
  }

  function deviceKind() {
    const width = window.innerWidth || 1024;
    return width < 768 ? 'mobile' : width < 1100 ? 'tablet' : 'desktop';
  }

  function track(eventType, page, itemSlug = null) {
    if (disabled || consent !== 'yes' || !kinds.has(eventType) || !pages.has(page)) return;
    if (itemSlug !== null &&
        (typeof itemSlug !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(itemSlug))) return;
    const key = `${eventType}|${page}|${itemSlug || ''}`;
    const now = Date.now();
    // Prevent duplicate content-load events and accidental rapid double taps.
    const minInterval = eventType === 'page_view' ? 1500 : 10000;
    if (now - (recent.get(key) || 0) < minInterval) return;
    recent.set(key, now);
    if (recent.size > 120) {
      for (const [oldKey, when] of recent) if (now - when > 60000) recent.delete(oldKey);
    }
    const endpoint = new URL('/rest/v1/hm_view_events', config.projectUrl);
    const payload = {
      session_id: getSessionId(),
      event_type: eventType,
      page,
      item_slug: itemSlug,
      device_kind: deviceKind(),
      source_kind: sourceKind
    };
    try {
      fetch(endpoint, {
        method: 'POST',
        headers: {
          apikey: config.publishableKey,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify(payload),
        keepalive: true,
        mode: 'cors'
      }).catch(() => {}); // Analytics must never block the website.
    } catch (_) { /* Browser disallows telemetry: site still works. */ }
  }

  const visibleDiaries = new WeakSet();
  const diaryObserver = 'IntersectionObserver' in window && new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !document.getElementById('page-daily').classList.contains('active')) continue;
      const index = Array.from(document.querySelectorAll('.diary-card')).indexOf(entry.target);
      if (index >= 0 && !visibleDiaries.has(entry.target)) {
        visibleDiaries.add(entry.target);
        track('diary_view', 'daily', `diary-${String(index + 1).padStart(2, '0')}`);
      }
      diaryObserver.unobserve(entry.target);
    }
  }, { threshold: 0.5 });

  function observeDiaries() {
    if (disabled || consent !== 'yes' || !diaryObserver) return;
    document.querySelectorAll('.diary-card').forEach(card => {
      if (!visibleDiaries.has(card) && !card.hidden) diaryObserver.observe(card);
    });
  }

  function getStatus() {
    return disabled ? 'unavailable' : consent;
  }

  function setConsent(allowed) {
    // Browser privacy controls always take precedence over visitor consent.
    if (disabled) return 'unavailable';
    consent = allowed ? 'yes' : 'no';
    try { localStorage.setItem(CONSENT_KEY, consent); } catch (_) { /* In-memory only. */ }
    if (!allowed) {
      recent.clear();
      sessionId = null;
      try { sessionStorage.removeItem(SESSION_KEY); } catch (_) { /* Optional storage. */ }
    }
    return consent;
  }

  window.HM_STATS = Object.freeze({ track, observeDiaries, getStatus, setConsent });
})();
