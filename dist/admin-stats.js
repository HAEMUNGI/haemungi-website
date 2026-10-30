(function analyticsDashboard() {
  'use strict';
  const $ = id => document.getElementById(id);
  const n = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const count = value => n(value).toLocaleString('ko-KR');
  const pageNames = {home:'첫 화면',videos:'영상관',cards:'카드뉴스',daily:'일상다반사',goods:'굿즈 전시관',room:'헤뭉이의 방',about:'소개',today:'헤뭉이의 오늘',creator:'제작자 소개',emoticons:'이모티콘'};
  const sources = {direct:'직접 방문',threads:'스레드',instagram:'인스타그램',youtube:'유튜브',naver:'네이버',google:'구글',facebook:'페이스북',kakao:'카카오',tiktok:'틱톡',other:'기타'};
  const deviceNames = {mobile:'모바일 화면',tablet:'태블릿 화면',desktop:'PC 화면'};
  const knownTypes = {artwork_open:'원화 확대',goods_filter:'굿즈 분류 변경',goods_search:'굿즈 검색',music_toggle:'음악 재생·중지',diary_view:'일상 이야기 노출'};
  const views = ['hm_stats_dashboard','hm_stats_daily','hm_stats_pages','hm_stats_content','hm_stats_sources','hm_stats_devices','hm_stats_hours','hm_goods','hm_stories','hm_room_spots'];
  let cache = null;
  let fetching = null;
  let lastFetchAt = 0;

  function element(name, klass, value) {
    const node = document.createElement(name);
    if (klass) node.className = klass;
    if (value !== undefined && value !== null) node.textContent = String(value);
    return node;
  }
  function empty(id, message) {
    const box = $(id);
    box.replaceChildren(element('div', 'analytics-empty', message));
  }
  function list(id, rows, key, valueKey, opts = {}) {
    const box = $(id);
    box.replaceChildren();
    const sorted = [...rows].sort((a,b) => n(b[valueKey])-n(a[valueKey]));
    const filtered = opts.onlyPositive ? sorted.filter(row => n(row[valueKey]) > 0) : sorted;
    const selected = filtered.slice(0, opts.limit || 12);
    if (!selected.length) { empty(id, opts.emptyMessage || '집계된 기록이 없습니다.'); return; }
    const max = Math.max(1, ...selected.map(row => n(row[valueKey])));
    const wrap = element('div', 'analytics-list');
    for (const item of selected) {
      const row = element('div', 'analytics-rank');
      const label = element('span', 'analytics-rank-label', key(item));
      const number = element('span', 'analytics-rank-num', count(item[valueKey]));
      const track = element('div', 'analytics-meter');
      const fill = element('span');
      fill.style.width = (100*n(item[valueKey])/max).toFixed(1)+'%';
      track.append(fill);
      row.append(label, number, track);
      wrap.append(row);
    }
    box.append(wrap);
  }
  function sumItems(rows, event) {
    return rows.filter(row => row.event_type === event).reduce((total,row) => total+n(row.views_or_actions), 0);
  }
  function renderKPIs(overview) {
    const mapping = {
      aToday:'today_page_views', aTotal:'total_page_views', aSessions:'total_sessions_estimate',
      aWeek:'last7_page_views', aMonth:'last30_page_views', aGoods:'goods_opens',
      aCards:'card_views', aRoom:'room_discoveries'
    };
    for (const [id,key] of Object.entries(mapping)) $(id).textContent = count(overview[key]);
  }
  function datesForLastMonth() {
    const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const todayUtc = Date.parse(today+'T00:00:00Z');
    return Array.from({length:30}, (_,index) => new Date(todayUtc-(29-index)*86400000).toISOString().slice(0,10));
  }
  function renderDaily(rows) {
    const indexed = new Map(rows.map(item => [item.day_kst,n(item.page_views)]));
    const days = datesForLastMonth().map(day => ({day,views:indexed.get(day)||0}));
    const max = Math.max(1,...days.map(item=>item.views));
    const box=$('aDailyChart');
    box.replaceChildren();
    days.forEach((entry,index)=>{
      const col=element('div','analytics-daily-bar');
      col.title = entry.day+' · '+count(entry.views)+'회';
      col.setAttribute('aria-label',col.title);
      col.setAttribute('tabindex','0');
      const bar=element('span');
      bar.style.height=Math.max(2,(entry.views/max)*100).toFixed(1)+'%';
      col.append(bar);
      if(index===0 || index===14 || index===29) col.append(element('small','',entry.day.slice(5)));
      box.append(col);
    });
    const table=$('aDailyTable');
    table.replaceChildren();
    const t=element('table');
    const head=element('thead'), tr=element('tr');
    tr.append(element('th','', '날짜'), element('th','', '페이지 조회'), element('th','', '세션 추정'));
    head.append(tr);t.append(head);
    const bodies=element('tbody');
    days.slice().reverse().forEach(entry=>{
      const match=rows.find(row=>row.day_kst===entry.day);
      const r=element('tr');
      r.append(element('td','',entry.day),element('td','',count(entry.views)),element('td','',count(match?.sessions_estimate)));
      bodies.append(r);
    });
    t.append(bodies);table.append(t);
  }
  function renderHours(rows) {
    const lookup=new Map(rows.map(row=>[Number(row.hour_kst),n(row.page_views)]));
    const max=Math.max(1,...Array.from(lookup.values()));
    const wrap=$('aHours');
    wrap.replaceChildren();
    for(let hour=0;hour<24;hour++){
      const entry=element('div','analytics-hour-item');
      entry.title=String(hour).padStart(2,'0')+'시 · '+count(lookup.get(hour))+'회';
      entry.setAttribute('aria-label',entry.title);
      const bar=element('span');
      bar.style.height=Math.max(2,100*(lookup.get(hour)||0)/max).toFixed(1)+'%';
      entry.append(bar);
      wrap.append(entry);
    }
  }
  function renderContent(content, goods, stories, spots, daily) {
    const lookup=new Map();
    for(const row of content) lookup.set(row.event_type+':'+row.item_slug,n(row.views_or_actions));
    list('aGoodsRank',goods.map(row=>({label:row.name,views:lookup.get('goods_detail:'+row.slug)||0})),r=>r.label,'views',{limit:10});
    list('aCardsRank',stories.filter(r=>r.kind==='cardnews').map(row=>({label:row.title,views:lookup.get('card_view:'+row.slug)||0})),r=>r.label,'views',{limit:9});
    list('aRoomRank',spots.map(row=>({label:row.label,views:lookup.get('room_spot:'+row.slug)||0})),r=>r.label,'views',{limit:7});
    list('aDiaryRank',stories.filter(r=>r.kind==='diary').map(row=>({label:row.title,views:lookup.get('diary_view:'+row.slug)||0})),r=>r.label,'views',{limit:3});
    const searches=daily.reduce((acc,row)=>acc+n(row.goods_searches),0);
    list('aEngagement',[
      {label:'원화 확대',views:sumItems(content,'artwork_open')},
      {label:'굿즈 분류 변경',views:sumItems(content,'goods_filter')},
      {label:'굿즈 검색',views:searches},
      {label:'음악 켜기',views:n(lookup.get('music_toggle:on'))},
      {label:'음악 끄기',views:n(lookup.get('music_toggle:off'))},
      {label:'일상 이야기 노출',views:sumItems(content,'diary_view')}
    ],r=>r.label,'views',{limit:6});
  }
  function renderAll(record) {
    const [head,daily,pages,content,source,devices,hours,goods,stories,spots]=record;
    renderKPIs(head[0]||{});
    renderDaily(daily);
    list('aPages',Object.keys(pageNames).map(page=>({label:pageNames[page],views:n(pages.find(row=>row.page===page)?.page_views)})),r=>r.label,'views',{limit:10});
    list('aSources',Object.keys(sources).map(kind=>({label:sources[kind],views:n(source.find(row=>row.source_kind===kind)?.page_views)})),r=>r.label,'views',{limit:10});
    list('aDevices',Object.keys(deviceNames).map(kind=>({label:deviceNames[kind],views:n(devices.find(row=>row.device_kind===kind)?.page_views)})),r=>r.label,'views',{limit:3});
    renderHours(hours);
    renderContent(content,goods,stories,spots,daily);
  }
  async function refresh(force=false) {
    if (fetching) return fetching;
    if (!force && cache && Date.now()-lastFetchAt<60000) return;
    const query=window.HM_ADMIN_REPORT_QUERY;
    if (typeof query!=='function') { $('analyticsStatus').textContent='통계 인증 연결을 확인할 수 없습니다.';return; }
    $('refreshAnalytics').disabled=true;
    $('analyticsStatus').textContent='최신 통계를 불러오는 중…';
    $('analyticsStatus').classList.remove('error');
    fetching=(async()=>{
      try {
        const result=await Promise.all(views.map(view=>query(view)));
        if(result.some(data=>!Array.isArray(data))) throw new Error('통계 응답 형식을 확인해 주세요.');
        cache=result;lastFetchAt=Date.now();
        renderAll(result);
        $('analyticsStatus').textContent='마지막 갱신: '+new Date().toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})+' · 수집 동의가 있는 방문만';
      } catch(error) {
        $('analyticsStatus').textContent='통계를 불러오지 못했습니다: '+(error?.message||'알 수 없는 오류');
        $('analyticsStatus').classList.add('error');
      } finally { $('refreshAnalytics').disabled=false; }
    })().finally(()=>{fetching=null});
    return fetching;
  }
  function csvSafe(value) {
    const str=String(value??'');
    const safe=/^[=+\-@\t\r]/.test(str)?"'"+str:str;
    return '"'+safe.replace(/"/g,'""')+'"';
  }
  function exportCSV() {
    if(!cache){ $('analyticsStatus').textContent='통계를 먼저 불러와 주세요.';return; }
    const [head,daily,pages,content,source,devices,hours,goods,stories,spots]=cache;
    const lines=[['구분','항목','조회/동작','세션 추정','설명']];
    const write=(group,label,views,sessions,desc='')=>lines.push([group,label,n(views),n(sessions),desc]);
    for(const [label,key] of [['오늘 조회','today_page_views'],['누적 조회','total_page_views'],['누적 세션','total_sessions_estimate'],['7일 조회','last7_page_views'],['30일 조회','last30_page_views']]) write('요약',label,head[0]?.[key],0);
    for(const row of daily) write('일별',row.day_kst,row.page_views,row.sessions_estimate);
    for(const row of pages) write('페이지',pageNames[row.page]||row.page,row.page_views,row.sessions_estimate);
    for(const row of source) write('유입',sources[row.source_kind]||row.source_kind,row.page_views,row.sessions_estimate);
    for(const row of devices) write('기기',deviceNames[row.device_kind]||row.device_kind,row.page_views,row.sessions_estimate);
    for(const row of hours) write('시간대',row.hour_kst+'시',row.page_views,0);
    const labels=new Map([
      ...goods.map(r=>['goods_detail:'+r.slug,r.name]),
      ...stories.map(r=>[(r.kind==='cardnews'?'card_view:':'diary_view:')+r.slug,r.title]),
      ...spots.map(r=>['room_spot:'+r.slug,r.label])
    ]);
    for(const row of content) write('콘텐츠',labels.get(row.event_type+':'+row.item_slug)||((knownTypes[row.event_type]||row.event_type)+' · '+row.item_slug),row.views_or_actions,row.sessions_estimate,row.page);
    const csv='\ufeff'+lines.map(row=>row.map(csvSafe).join(',')).join('\r\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;
    link.download='haemungi_stats_'+new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'}).replace(/-/g,'')+'.csv';
    document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  $('openAnalytics').addEventListener('click',()=>{
    $('studioView').hidden=true;$('analyticsView').hidden=false;
    window.scrollTo({top:0,behavior:'instant'});
    refresh();
  });
  $('backContent').addEventListener('click',()=>{
    $('analyticsView').hidden=true;$('studioView').hidden=false;
    window.scrollTo({top:0,behavior:'instant'});
  });
  $('refreshAnalytics').addEventListener('click',()=>refresh(true));
  $('downloadAnalytics').addEventListener('click',exportCSV);
})();