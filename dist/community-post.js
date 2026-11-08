import {BOARD_NAMES,displayDate,makeAvatar} from './community-core.mjs';
import {rest,getUserId,hasAccount} from './community-client.mjs';
import {createCommunityUi} from './community-ui.mjs';

const $=id=>document.getElementById(id);
const id=new URLSearchParams(location.search).get('id');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let post=null;
const ui=createCommunityUi({onChange:({signedIn,profile})=>{
  $('cmAccountButton').textContent=profile?.nickname||(signedIn?'내 프로필':'로그인');
  $('cmAccountStatus').textContent=profile?'✧ '+profile.nickname+'님':signedIn?'프로필을 설정해주세요':'로그인 후 댓글 등록';
}});
$('cmAccountButton').addEventListener('click',()=>hasAccount()?ui.openProfile():ui.openLogin());
const el=(tag,className,content)=>{
  const node=document.createElement(tag);if(className)node.className=className;
  if(content!==undefined)node.textContent=content;return node;
};
function action(label,handler){
  const button=el('button','',label);button.type='button';button.addEventListener('click',handler);return button;
}
async function removeContent(kind,rowId){
  if(!confirm('정말 삭제하시겠어요? 삭제된 내용은 복구할 수 없습니다.'))return;
  try{
    const name=kind==='post'?'hm_community_posts':'hm_community_comments';
    await rest(name,{id:'eq.'+rowId},{method:'DELETE'});
    if(kind==='post')location.href='/community.html?board='+post.board;
    else loadComments();
  }catch(err){$('cmCommentStatus').textContent=err.message;}
}
async function loadPost(){
  if(!UUID.test(id||'')){
    $('cmPost').replaceChildren(el('p','cm-empty','올바른 게시글 링크가 아닙니다.'));return;
  }
  try{
    const data=await rest('hm_community_posts',{select:'*',id:'eq.'+id,limit:1});
    if(!Array.isArray(data)||!data.length)throw new Error('게시글을 찾을 수 없습니다.');
    post=data[0];document.title=post.title+' | 헤뭉이 커뮤니티';
    const paper=$('cmPost'),category=el('span','cm-label',BOARD_NAMES[post.board]);
    const heading=el('h1','',post.title),author=el('div','cm-detail-author');
    const info=el('div','');
    info.append(el('strong','',post.author_nickname),el('p','cm-meta',displayDate(post.created_at)));
    author.append(makeAvatar(post.avatar_gender,''),info);
    const body=el('div','cm-detail-text',post.body);
    const tools=el('div','cm-detail-tools');
    tools.append(action('신고하기',()=>ui.openReport('post',post.id)));
    if(post.author_id===getUserId()||ui.isAdmin)tools.append(action('글 삭제',()=>removeContent('post',post.id)));
    paper.replaceChildren(category,heading,author,body,tools);
    loadComments();
  }catch(err){$('cmPost').replaceChildren(el('p','cm-empty',err.message));}
}
async function loadComments(){
  if(!post)return;
  const list=$('cmCommentsList');
  try{
    const rows=await rest('hm_community_comments',{
      select:'id,author_id,author_nickname,avatar_gender,body,created_at',
      post_id:'eq.'+post.id,order:'created_at.asc,id.asc',limit:150
    });
    list.replaceChildren();
    if(!rows.length)list.append(el('p','cm-empty','아직 댓글이 없어요. 첫 인사를 남겨주세요.'));
    for(const item of rows){
      const row=el('article','cm-comment-item'),main=el('div','cm-comment-main');
      const head=el('div',''),tools=el('div','cm-comment-tools');
      head.append(el('span','cm-comment-name',item.author_nickname),
        el('time','cm-comment-meta',displayDate(item.created_at)));
      main.append(head,el('p','',item.body));
      tools.append(action('신고',()=>ui.openReport('comment',item.id)));
      if(item.author_id===getUserId()||ui.isAdmin)
        tools.append(action('삭제',()=>removeContent('comment',item.id)));
      main.append(tools);row.append(makeAvatar(item.avatar_gender,''),main);list.append(row);
    }
  }catch(err){list.replaceChildren(el('p','cm-feedback',err.message));}
}
$('cmCommentForm').addEventListener('submit',async event=>{
  event.preventDefault();if(!post)return;
  const profile=await ui.requireProfile();if(!profile)return;
  const button=event.currentTarget.querySelector('[type=submit]');
  button.disabled=true;$('cmCommentStatus').textContent='댓글을 등록하는 중…';
  try{
    const body=event.currentTarget.elements.body.value.trim().slice(0,1500);
    await rest('hm_community_comments',{},{
      method:'POST',body:{post_id:post.id,author_id:getUserId(),author_nickname:profile.nickname,
        avatar_gender:profile.avatar_gender,body}
    });
    event.currentTarget.reset();$('cmCommentStatus').textContent='댓글을 등록했습니다.';
    await loadComments();
  }catch(err){$('cmCommentStatus').textContent=err.message;}
  finally{button.disabled=false;}
});
loadPost();
