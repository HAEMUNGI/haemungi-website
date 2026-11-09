/* HAEMUNGI · 별잇다 추모관 이용안내 — 외부 AI 호출·DB 저장 없는 정적 안내 */
(function () {
  'use strict';
  if (document.getElementById('byeolitdaGuideButton')) return;

  const places = [
    {
      key: 'memorial', icon: '✧', title: '별잇다 추모관 · 우리 아이 기억하기',
      badge: '추모관 · 안식관', href: '/memorial.html',
      action: '별잇다 추모관으로 이동하기',
      intro: '소중한 반려동물을 기억하고 사진과 이야기를 남기는 공간입니다.',
      facts: ['헤뭉이 월드 여권의 14개 장소를 모두 방문합니다.',
        '이메일로 본인을 확인하고, 기록 공개에 동의합니다.',
        '필요한 조건을 충족하면 빈 안식관 명패를 자동 배정받을 수 있습니다.',
        '안식관·제례실·공동 추모홀과 별들의 기록을 둘러볼 수 있습니다.']
    },
    {
      key: 'walk', icon: '〰', title: '기억의 산책길과 바다 쉼터',
      badge: '함께 걷기', href: '/memorial-walk.html',
      action: '기억의 산책길로 이동하기',
      intro: '미니미 아바타와 꽃길을 걸으며 바다 쉼터까지 이어지는 풍경을 만납니다.',
      facts: ['길 위 원하는 곳을 누르거나 조이스틱으로 걸을 수 있습니다.',
        '바다 쉼터에서 해돋이·밤하늘을 감상하고 종이배를 띄울 수 있습니다.',
        '로그인하면 같은 산책길의 방문자와 채팅할 수 있습니다.']
    },
    {
      key: 'temple', icon: '❀', title: '파도가 들리는 법당',
      badge: '사찰 · 마음 쉼터', href: '/temple.html',
      action: '파도가 들리는 법당으로 이동하기',
      intro: '바다를 품은 사찰에서 조용히 머물며 마음을 돌보는 곳입니다.',
      facts: ['해수관음상 앞에서 두 손 모아 합장할 수 있습니다.',
        '대웅전에서 불교음악과 범종을 만나고, 법등마당에서 연꽃 법등을 밝힐 수 있습니다.',
        '발원당에 소원을 적고 바다 쉼터에서 종이배를 띄울 수 있습니다.']
    },
    {
      key: 'passport', icon: '▤', title: '헤뭉이 월드 여행 여권',
      badge: '14곳 순례', href: '/',
      action: '여행 여권 펼치기',
      intro: '헤뭉이 월드의 14개 장소를 방문하고 여권에 스탬프를 모아보세요.',
      facts: ['각 장소의 방문 기록이 여권에 표시됩니다.',
        '14개 장소를 완주하면 이메일 확인·공개 동의를 거쳐 명패 배정 절차를 진행할 수 있습니다.',
        '이 버튼을 누르면 현재 페이지에서 여권을 열거나, 여권을 열 수 있는 화면으로 안내합니다.']
    },
    {
      key: 'leo', icon: '♡', title: '001호 레오의 작은 일상',
      badge: '추억의 방', href: '/leo-room.html',
      action: '레오의 방 방문하기',
      intro: '별잇다 추모관의 첫 번째 친구, 레오를 기억하는 따뜻한 추억의 방입니다.',
      facts: ['레오가 움직이는 작은 공간을 둘러볼 수 있습니다.',
        '방 안의 놀이·돌봄 오브젝트를 눌러 상호작용해 보세요.']
    },
    {
      key: 'playground', icon: '✿', title: '헤뭉이 놀이터',
      badge: '키우고 놀기', href: '/playground.html',
      action: '헤뭉이 놀이터로 이동하기',
      intro: '헤뭉이와 놀고 돌보는 가벼운 일상 속 쉼터입니다.',
      facts: ['작은 친구에게 간식을 주고 쉬게 하거나 놀이를 즐겨보세요.',
        '타로·미니게임 등 다른 놀이도 둘러볼 수 있습니다.']
    },
    {
      key: 'community', icon: '✎', title: '커뮤니티 · 자유게시판 · 질문답변',
      badge: '함께 이야기하기', href: '/community.html',
      action: '커뮤니티로 이동하기',
      intro: '방문자들이 서로 이야기를 나누고 이용 방법을 알아보는 공간입니다.',
      facts: ['자유게시판과 Q&A, 공지, 이용안내를 볼 수 있습니다.',
        '글쓰기 등 회원 기능은 로그인이 필요할 수 있습니다.']
    }
  ];

  const button = document.createElement('button');
  button.id = 'byeolitdaGuideButton';
  button.type = 'button';
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'byeolitdaGuideDialog');
  button.setAttribute('aria-label', '별잇다 추모관 이용안내 열기');
  button.setAttribute('aria-expanded', 'false');
  button.innerHTML = '<span aria-hidden="true">✿</span><span>이용안내</span>';

  const dialog = document.createElement('dialog');
  dialog.id = 'byeolitdaGuideDialog';
  dialog.className = 'byeolitda-guide-dialog';
  dialog.setAttribute('aria-labelledby', 'byeolitdaGuideTitle');
  dialog.innerHTML =
    '<div class="bdg-shell">' +
      '<header class="bdg-header"><div><small>HAEMUNGI · BYEOLITDA</small>' +
      '<h2 id="byeolitdaGuideTitle">별잇다 추모관 이용안내</h2></div>' +
      '<button type="button" class="bdg-close" aria-label="이용안내 닫기">×</button></header>' +
      '<div class="bdg-content">' +
        '<section class="bdg-menu"><p class="bdg-intro">찾고 계신 장소가 있나요?<br>원하는 곳을 고르면 차근차근 안내해 드릴게요.</p>' +
        '<div class="bdg-choices" role="group" aria-label="안내할 장소"></div></section>' +
        '<section class="bdg-detail" hidden><button class="bdg-back" type="button">← 장소 목록으로</button>' +
        '<span class="bdg-badge"></span><h3></h3><p class="bdg-description"></p>' +
        '<ul class="bdg-facts"></ul><button type="button" class="bdg-go"></button></section>' +
      '</div>' +
      '<footer class="bdg-footer">일현 조성훈 · 헤뭉이의 작은 세계</footer>' +
    '</div>';

  const choiceArea = dialog.querySelector('.bdg-choices');
  const menu = dialog.querySelector('.bdg-menu');
  const detail = dialog.querySelector('.bdg-detail');
  const badge = detail.querySelector('.bdg-badge');
  const title = detail.querySelector('h3');
  const description = detail.querySelector('.bdg-description');
  const facts = detail.querySelector('.bdg-facts');
  const go = detail.querySelector('.bdg-go');
  const back = detail.querySelector('.bdg-back');
  const close = dialog.querySelector('.bdg-close');
  let selected = null;
  let lastChoice = null;
  let openingPassport = false;

  function showMenu(restoreFocus) {
    detail.hidden = true;
    menu.hidden = false;
    selected = null;
    if (restoreFocus) (lastChoice || choiceArea.querySelector('button') || close).focus();
  }

  function showDetail(place, chip) {
    selected = place;
    lastChoice = chip;
    menu.hidden = true;
    detail.hidden = false;
    badge.textContent = place.badge;
    title.textContent = place.title;
    description.textContent = place.intro;
    facts.replaceChildren();
    place.facts.forEach(function (line) {
      const li = document.createElement('li');
      li.textContent = line;
      facts.appendChild(li);
    });
    go.textContent = place.action + ' ↗';
    back.focus();
  }

  places.forEach(function (place) {
    const chip = document.createElement('button');
    chip.className = 'bdg-choice';
    chip.type = 'button';
    const icon = document.createElement('span');
    icon.className = 'bdg-choice-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = place.icon;
    const label = document.createElement('span');
    label.textContent = place.title;
    chip.append(icon, label);
    chip.addEventListener('click', function () { showDetail(place, chip); });
    choiceArea.appendChild(chip);
  });

  function closeDialog() {
    if (dialog.open) dialog.close();
  }
  button.addEventListener('click', function () {
    if (dialog.open) closeDialog();
    else {
      showMenu(false);
      dialog.showModal();
      button.setAttribute('aria-expanded', 'true');
      close.focus();
    }
  });
  close.addEventListener('click', closeDialog);
  back.addEventListener('click', function () { showMenu(true); });
  dialog.addEventListener('click', function (event) {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('close', function () {
    button.setAttribute('aria-expanded', 'false');
    if (!openingPassport) button.focus();
    openingPassport = false;
  });

  function launchPassport() {
    const launcher = document.getElementById('hmPassportLauncher');
    if (launcher) {
      openingPassport = true;
      closeDialog();
      launcher.click();
      return;
    }
    // 여권 버튼이 없는 방·산책길에서도 공식 여권을 열 수 있도록 홈으로 안내
    window.location.assign('/?open_passport=1');
  }

  go.addEventListener('click', function () {
    if (!selected) return;
    if (selected.key === 'passport') launchPassport();
    else window.location.assign(selected.href);
  });

  document.body.append(button, dialog);

  // 다른 페이지에서 여권을 요청해 돌아온 경우, DOM 생성이 끝난 뒤 한 번만 열기
  const params = new URLSearchParams(window.location.search);
  if (params.get('open_passport') === '1' && window.location.pathname === '/') {
    let attempts = 0;
    const opener = window.setInterval(function () {
      const launcher = document.getElementById('hmPassportLauncher');
      attempts += 1;
      if (launcher || attempts >= 30) {
        window.clearInterval(opener);
        const url = new URL(window.location.href);
        url.searchParams.delete('open_passport');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        if (launcher) launcher.click();
      }
    }, 100);
  }
})();
