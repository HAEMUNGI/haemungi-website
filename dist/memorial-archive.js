(() => {
  'use strict';
  const cfg=window.HAEMUNGI_CONTENT_CONFIG||{};
  const api=cfg.projectUrl||'',key=cfg.publishableKey||'';
  const ready=/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(api)&&/^sb_publishable_[\w-]+$/.test(key);
  const $=id=>document.getElementById(id);
  const PAGE_SIZE=24;
  let query='',cursors=[null],page=0,nextCursor=null,sequence=0;
  const approvedPhoto=path=>{
    if(path==='approved/65123d76-a511-47cb-8125-7d4863eac0ab.jpg')return '/memorial/leo-tribute.jpg';
    if(!/^approved\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/.test(path||''))return '';
    return api+'/storage/v1/object/public/hm-memorial-published/'+path;
  };
  const thumbnail=row=>{
    const path=row.thumbnail_path;
    if(/^thumbs\/[a-f0-9-]{36}\.webp$/.test(path||'')){
      return api+'/storage/v1/object/public/hm-memorial-published/'+path;
    }
    return approvedPhoto(row.photo_path);
  };
  const el=(tag,className,text)=>{
    const n=document.createElement(tag);
    if(className)n.className=className;
    if(text!==undefined)n.textContent=text;
    return n;
  };
  function cleanQuery(s){
    return String(s||'').trim().replace(/[^\p{L}\p{N} \-]/gu,'').slice(0,60);
  }
  function makePath(cursor){
    const params=new URLSearchParams();
    params.set('select','id,pet_name,born_on,passed_on,photo_path,thumbnail_path,published_at');
    params.set('order','published_at.desc,id.desc');
    params.set('limit',String(PAGE_SIZE+1));
    if(query)params.set('pet_name','ilike.*'+query+'*');
    if(cursor){
      params.set('or','(published_at.lt.'+cursor.published_at+
        ',and(published_at.eq.'+cursor.published_at+',id.lt.'+cursor.id+'))');
    }
    return api+'/rest/v1/hm_memorial_public?'+params.toString();
  }
  function render(rows){
    const grid=$('archiveGrid');
    grid.replaceChildren();
    if(!rows.length)grid.appendChild(el('p','archive-empty',query?'해당 이름의 공개된 기록을 찾지 못했습니다.':'아직 공개된 별이 없습니다. 첫 이야기를 기다립니다.'));
    for(const row of rows){
      const card=el('article','archive-card'),link=el('a');
      link.href='/memorial.html#story:'+row.id;
      link.setAttribute('aria-label',row.pet_name+'의 추억 읽기');
      const photo=el('div','archive-photo'),src=thumbnail(row);
      if(row.photo_path==='approved/65123d76-a511-47cb-8125-7d4863eac0ab.jpg')
        photo.className='archive-photo archive-tribute';
      if(src){
        const img=el('img');img.src=src;img.alt=row.pet_name+'의 추억 사진';
        img.loading='lazy';img.decoding='async';photo.appendChild(img);
      }else{photo.appendChild(el('span','archive-placeholder','✧'));}
      const body=el('div','archive-card-body');
      body.appendChild(el('h2','',row.pet_name));
      body.appendChild(el('p','archive-dates',[row.born_on,row.passed_on].filter(Boolean).join(' ~ ')||'함께한 시간을 기억합니다.'));
      body.appendChild(el('span','archive-open','추억 읽기 →'));
      link.append(photo,body);card.appendChild(link);grid.appendChild(card);
    }
  }
  async function load(){
    const seq=++sequence;
    $('archiveStatus').textContent='별들의 기록을 불러오고 있습니다…';
    $('archivePrev').disabled=true;$('archiveNext').disabled=true;
    try{
      if(!ready)throw new Error('추모관 데이터 연결 설정을 확인해주세요.');
      const r=await fetch(makePath(cursors[page]),{headers:{apikey:key,Accept:'application/json'}});
      if(!r.ok)throw new Error('공개 목록을 불러오지 못했습니다. ('+r.status+')');
      const data=await r.json();
      if(seq!==sequence)return;
      if(!Array.isArray(data))throw new Error('목록 응답을 확인할 수 없습니다.');
      const visible=data.slice(0,PAGE_SIZE);
      render(visible);
      nextCursor=data.length>PAGE_SIZE && visible.length
        ? {published_at:visible[visible.length-1].published_at,id:visible[visible.length-1].id} : null;
      $('archivePage').textContent=(page+1)+'쪽';
      $('archivePrev').disabled=page===0;
      $('archiveNext').disabled=!nextCursor;
      $('archiveStatus').textContent=query?'「'+query+'」 검색 결과 · '+visible.length+'명 표시':
        '공개된 친구 '+visible.length+'명을 이 페이지에 표시합니다.';
    }catch(err){
      if(seq!==sequence)return;
      render([]);$('archiveStatus').textContent=err.message;
      nextCursor=null;
      $('archivePrev').disabled=page===0;
    }
  }
  $('archiveSearch').addEventListener('submit',event=>{
    event.preventDefault();
    query=cleanQuery($('archiveQuery').value);$('archiveQuery').value=query;
    cursors=[null];page=0;nextCursor=null;load();
  });
  $('archiveClear').addEventListener('click',()=>{
    $('archiveQuery').value='';query='';cursors=[null];page=0;nextCursor=null;load();
  });
  $('archiveNext').addEventListener('click',()=>{
    if(!nextCursor)return;
    cursors[page+1]=nextCursor;
    cursors.length=page+2;
    page++;load();
  });
  $('archivePrev').addEventListener('click',()=>{
    if(page===0)return;
    page--;load();
  });
  load();
})();
