import {BOARD_NAMES,safeBoard,displayDate,makeAvatar,maxLength} from './community-core.mjs';
import {rest,getUserId,hasAccount} from './community-client.mjs';
import {createCommunityUi} from './community-ui.mjs';

const $=id=>document.getElementById(id);
let board=safeBoard(new URLSearchParams(location.search).get('board')||'free'),offset=0,loading=false,pendingReload=false;
const LIMIT=15;
const ui=createCommunityUi({onChange:({signedIn,profile,isAdmin})=>{
  $('cmAccountButton').textContent=profile?.nickname|| (signedIn?'내 프로필':'로그인');
  $('cmAccountStatus').textContent=profile?'✧ '+profile.nickname+'님':signedIn?'닉네임을 설정해주세요':'비회원 · 읽기 가능';
  $('cmAdminArea').hidden=!isAdmin;
}});
$('cmAccountButton').addEventListener('click',()=>hasAccount()?ui.openProfile():ui.openLogin());
const descriptions={
  free:'헤뭉이의 작은 세계에서 자유롭게 이야기를 나눠요.',
  qna:'방문 방법과 기능에 관한 질문을 남겨주세요. 아는 분은 댓글로 도와주세요.',
  notice:'운영자가 전하는 새로운 소식입니다.',
  guide:'여권·아바타·커뮤니티·별잇다 이용 방법을 안내합니다.'
};
function drawBoard(){
  for(const button of document.querySelectorAll('[data-board]')){
    button.setAttribute('aria-pressed',String(button.dataset.board===board));
  }
  $('cmBoardDescription').textContent=descriptions[board];
  $('cmNewPost').textContent=board==='qna'?'질문하기':board==='notice'?'공지 작성':board==='guide'?'안내 작성':'글쓰기';
}
function node(tag,className,text){
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
}
function postRow(post){
  const row=node('article','cm-post-row'),a=makeAvatar(post.avatar_gender,'');
  const content=node('div','cm-post-content'),link=node('a','cm-post-title',post.title);
  link.href='/community-post.html?id='+encodeURIComponent(post.id);
  const excerpt=node('p','cm-post-excerpt',String(post.body||'').replace(/\s+/g,' ').slice(0,125));
  const meta=node('div','cm-post-meta');
  meta.append(node('span','cm-label',BOARD_NAMES[post.board]||'게시글'),
    node('span','',post.author_nickname),node('time','',displayDate(post.created_at)));
  content.append(link,excerpt,meta);row.append(a,content);return row;
}
const starterContent={
  guide:[
    ['처음 오셨나요? 헤뭉이의 작은 세계 이용 방법','헤뭉이 놀이터와 별잇다 추모 공간을 둘러보는 것은 로그인 없이 가능합니다. 게시글 작성, 댓글, 아바타 채팅 등 참여 기능은 이메일 인증과 닉네임 설정이 필요할 수 있습니다.','/playground.html','놀이터 둘러보기'],
    ['커뮤니티 게시판 이용안내','자유게시판은 이야기 나눔, Q&A는 질문과 답변, 공지는 운영 소식, 이용안내는 서비스 사용법을 확인하는 공간입니다. 개인정보·연락처·타인의 사진은 동의 없이 게시하지 마세요.','/community.html?board=qna','질문 게시판'],
    ['헤뭉이 월드 여권과 스탬프','여권에 표시된 방문 장소를 찾아가 스탬프를 모으는 탐험 콘텐츠입니다. 스탬프가 기록되지 않으면 로그인 상태와 해당 장소의 완료 조건을 확인한 뒤 Q&A로 문의해 주세요.','/playground.html','헤뭉이 놀이터'],
    ['별잇다 추모 공간 이용안내','별잇다는 반려동물을 기억하는 공간입니다. 공개 명패와 추억의 기록은 서비스별 신청·확인·동의 절차에 따라 처리됩니다. 다른 가족의 사진과 이야기를 존중해 주세요.','/memorial.html','별잇다 둘러보기']
  ],
  notice:[
    ['커뮤니티 운영 안내','이곳은 헤뭉이와 별잇다 방문자가 서로 이야기하고 질문하는 공간입니다. 자유게시판과 Q&A는 방문자 참여 공간이며, 공지와 이용안내의 실제 게시글은 운영 권한에 따라 작성됩니다.'],
    ['안전하고 따뜻한 대화를 위한 안내','욕설, 괴롭힘, 도배, 사칭, 광고성 게시물 및 동의 없는 개인정보 공개를 삼가 주세요. 문제가 있는 게시물은 운영자에게 알려주세요.'],
    ['서비스 이용 전 확인해 주세요','일부 참여 기능에는 이메일 인증과 닉네임 설정이 필요합니다. 기능별 운영 상태와 이용 조건은 변경될 수 있으며, 중요한 사항은 공식 공지 게시글로 안내합니다.']
  ],
  qna:[
    ['로그인 없이 이용할 수 있나요?','공개된 공간과 게시글은 로그인 없이 둘러볼 수 있습니다. 글쓰기·댓글·아바타 채팅 등은 이메일 인증과 닉네임 설정이 필요할 수 있습니다.'],
    ['질문은 어디에 남기나요?','Q&A 탭에서 ‘질문하기’를 누르세요. 참여 조건을 충족하면 질문을 등록할 수 있습니다. 다른 방문자의 질문에도 예의를 지켜 답변해 주세요.'],
    ['여권 스탬프가 찍히지 않아요.','로그인 상태와 장소 방문 완료 조건을 먼저 확인해 주세요. 계속 문제가 발생하면 장소 이름, 발생 시각, 사용 기기를 적어 Q&A에 남겨주세요. 비밀번호나 인증 코드는 올리지 마세요.'],
    ['반려동물 명패는 어떻게 등록하나요?','별잇다에서 제공하는 등록 절차를 확인해 주세요. 공개 명패는 필요한 확인과 공개 동의 절차를 거쳐야 하며, 단순 기록과 공개 명패의 조건은 다를 수 있습니다.']
  ]
};
function showStarterContent(target,current){
  const entries=starterContent[current];
  if(!entries)return;
  const intro=node('p','cm-feedback',current==='qna'?'자주 묻는 질문 · 아래 안내는 참고용이며, 실제 질문은 질문하기로 등록하세요.':current==='notice'?'기본 운영 안내 · 공식 공지 게시글과 구분됩니다.':'처음 방문자를 위한 기본 이용안내');
  target.append(intro);
  for(const [title,body,url,linkLabel] of entries){
    const article=node('article','cm-post-row cm-starter-row');
    article.style.cssText='display:block;padding:18px 4px;border-bottom:1px solid #eee5da;';
    const heading=node('h3','cm-post-title',title);
    heading.style.cssText='margin:0 0 9px;font-size:1rem;';
    const content=node('p','cm-post-excerpt',body);
    content.style.cssText='white-space:pre-line;line-height:1.8;margin:0;';
    article.append(heading,content);
    if(url){const link=node('a','cm-label',linkLabel+' →');link.href=url;link.style.cssText='display:inline-block;margin-top:10px;text-decoration:underline;text-underline-offset:3px;';article.append(link);}
    target.append(article);
  }
}
async function loadPosts(reset=true){
  if(loading){if(reset)pendingReload=true;return;}
  loading=true;
  const list=$('cmPostList'),current=board,at=reset?0:offset;
  $('cmOlderPosts').disabled=true;
  if(reset){offset=0;list.replaceChildren(node('p','cm-empty','글을 불러오는 중입니다…'));}
  try{
    const data=await rest('hm_community_posts',{
      select:'id,board,title,body,author_nickname,avatar_gender,created_at',
      board:'eq.'+current,order:'created_at.desc,id.desc',limit:LIMIT+1,offset:at
    });
    if(current!==board)return;
    if(reset){
      list.replaceChildren();
      // Permanent onboarding guidance remains visible even after real posts arrive.
      if(starterContent[current])showStarterContent(list,current);
    }
    for(const post of data.slice(0,LIMIT))list.append(postRow(post));
    offset=at+Math.min(LIMIT,data.length);
    $('cmOlderPosts').hidden=data.length<=LIMIT;
    if(!list.children.length)list.append(node('p','cm-empty','아직 글이 없어요. 첫 이야기를 남겨주세요.'));
  }catch(err){
    if(reset)list.replaceChildren(node('p','cm-empty',err.message));
    else list.append(node('p','cm-feedback',err.message));
    $('cmOlderPosts').hidden=true;
  }finally{
    loading=false;$('cmOlderPosts').disabled=false;
    if(pendingReload){pendingReload=false;loadPosts(true);}
  }
}
for(const button of document.querySelectorAll('[data-board]')){
  button.addEventListener('click',()=>{
    board=button.dataset.board;history.replaceState({},'',location.pathname+'?board='+board);
    $('cmCompose').hidden=true;drawBoard();loadPosts();
  });
}
$('cmOlderPosts').addEventListener('click',()=>loadPosts(false));
$('cmNewPost').addEventListener('click',async()=>{
  const profile=await ui.requireProfile();
  if(!profile)return;
  if(['notice','guide'].includes(board)&&!ui.isAdmin){
    $('cmBoardDescription').textContent='이 게시판은 관리자만 작성할 수 있습니다.';return;
  }
  $('cmCompose').hidden=false;
  $('cmComposeTitle').textContent=BOARD_NAMES[board]+' 새 글';
  $('cmCompose').scrollIntoView({behavior:'smooth',block:'start'});
  $('cmCompose').elements.title.focus();
});
$('cmCancelPost').addEventListener('click',()=>{$('cmCompose').hidden=true;});
$('cmCompose').addEventListener('submit',async event=>{
  event.preventDefault();
  const profile=await ui.requireProfile();if(!profile)return;
  if(['notice','guide'].includes(board)&&!ui.isAdmin)return;
  const form=event.currentTarget,submit=form.querySelector('[type=submit]');
  submit.disabled=true;$('cmComposeStatus').textContent='공개 글을 등록하는 중…';
  try{
    const posted=await rest('hm_community_posts',{},{
      method:'POST',returnRepresentation:true,body:{board,title:maxLength(form.elements.title.value,120),
        body:maxLength(form.elements.body.value,6000),author_id:getUserId(),
        author_nickname:profile.nickname,avatar_gender:profile.avatar_gender}
    });
    form.reset();form.hidden=true;
    if(posted?.[0]?.id)location.href='/community-post.html?id='+encodeURIComponent(posted[0].id);
    else await loadPosts();
  }catch(err){$('cmComposeStatus').textContent=err.message;}
  finally{submit.disabled=false;}
});
async function loadReports(){
  if(!ui.isAdmin)return;
  const list=$('cmReports');list.replaceChildren(node('p','cm-empty','신고를 불러오는 중…'));
  try{
    const reports=await rest('hm_community_reports',{
      select:'id,target_kind,target_id,reason,created_at',order:'created_at.desc',limit:60
    },{auth:true});
    list.replaceChildren();
    if(!reports.length)list.append(node('p','cm-empty','대기 중인 신고가 없습니다.'));
    for(const item of reports){
      const row=node('div','cm-report-row');
      const description=node('div','',item.target_kind+' · '+displayDate(item.created_at)+' · '+item.reason);
      const actions=node('div','cm-dialog-actions');
      const clear=node('button','cm-button secondary','신고 정리');clear.type='button';
      clear.addEventListener('click',async()=>{
        try{await rest('hm_community_reports',{id:'eq.'+item.id},{method:'DELETE'});row.remove();}
        catch(err){description.textContent=err.message;}
      });
      const remove=node('button','cm-button','해당 글 삭제');remove.type='button';
      remove.addEventListener('click',async()=>{
        if(!confirm('해당 내용을 삭제할까요? 삭제하면 복원할 수 없습니다.'))return;
        const table={post:'hm_community_posts',comment:'hm_community_comments',chat:'hm_avatar_chat_messages'}[item.target_kind];
        if(!table)return;
        try{
          await rest(table,{id:'eq.'+item.target_id},{method:'DELETE'});
          await rest('hm_community_reports',{id:'eq.'+item.id},{method:'DELETE'});
          row.remove();
        }catch(err){description.textContent=err.message;}
      });
      actions.append(clear,remove);row.append(description,actions);list.append(row);
    }
  }catch(err){list.replaceChildren(node('p','cm-feedback',err.message));}
}
$('cmLoadReports').addEventListener('click',loadReports);
drawBoard();loadPosts();
if(location.hash==='#login')ui.openLogin();
