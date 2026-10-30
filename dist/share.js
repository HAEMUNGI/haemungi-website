(() => {
  'use strict';
  const originalTitle = '헤뭉이의 작은 세계';
  function currentUrl() {
    const url = new URL(location.pathname, location.origin);
    const page = location.hash.slice(1);
    if (['home','videos','cards','daily','goods','room','about','today','creator','emoticons'].includes(page)) url.hash = page;
    return url.toString();
  }
  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('shown');
    setTimeout(() => node.classList.remove('shown'), 2700);
  }
  async function copyLink() {
    const url = currentUrl();
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(url); toast('링크를 복사했어요.'); return; }
    } catch (_) { /* Clipboard permission may be unavailable. */ }
    const input = document.createElement('textarea');
    input.value = url; input.readOnly = true; input.style.position = 'fixed'; input.style.opacity = '0';
    document.body.append(input); input.select();
    const success = document.execCommand?.('copy'); input.remove();
    toast(success ? '링크를 복사했어요.' : '공유 주소를 복사할 수 없습니다.');
  }
  document.addEventListener('click', async event => {
    const action = event.target.closest('[data-hm-share],[data-hm-copy],[data-hm-threads]');
    if (!action) return;
    const url = currentUrl();
    if (action.hasAttribute('data-hm-copy')) return copyLink();
    if (action.hasAttribute('data-hm-threads')) {
      window.open('https://www.threads.net/intent/post?text=' + encodeURIComponent(originalTitle + ' ' + url), '_blank', 'noopener,noreferrer');
      return;
    }
    if (typeof navigator.share === 'function') {
      try { await navigator.share({title: originalTitle, text:'작고 따뜻한 헤뭉이의 세계를 만나보세요.', url}); }
      catch (error) { if (error?.name !== 'AbortError') await copyLink(); }
    } else await copyLink();
  });
})();
