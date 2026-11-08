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
    if(reset)list.replaceChildren();
    for(const post of data.slice(0,LIMIT))list.append(postRow(post));
    offset=at+Math.min(LIMIT,data.length);
    $('cmOlderPosts').hidden=data.length<=LIMIT;
    if(!list.children.length)list.append(node('p','cm-empty',current==='guide'?
      '이용안내 게시글을 준비하고 있습니다. 아래 기본 이용 방법을 먼저 확인해주세요.':
      current==='notice'?'아직 등록된 공지가 없습니다.':'아직 글이 없어요. 첫 이야기를 남겨주세요.'));
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
