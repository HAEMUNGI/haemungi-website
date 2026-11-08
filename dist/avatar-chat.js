import {rest,getUserId,hasAccount} from './community-client.mjs';
import {displayDate,makeAvatar} from './community-core.mjs';
import {createCommunityUi} from './community-ui.mjs';

// The existing public realtime channel carries ONLY a chat-changed hint.
// Actual chat text is fetched through Supabase Auth + RLS.
export function initAvatarChat({getRoom,onNewMessage=()=>{},notifyPeers=()=>{},sessionId}){
  const $=id=>document.getElementById(id);
  const chat=$('walkChat'),panel=$('walkChatPanel'),toggle=$('walkChatToggle');
  const list=$('walkChatMessages'),status=$('walkChatStatus'),form=$('walkChatForm');
  let currentRoom=null,lastSignature='',pending=false,interval=null,open=false,previousIds=new Set(),lastFetchAt=0;
  const ui=createCommunityUi({onChange:({signedIn,profile})=>{
    $('walkChatAccount').textContent=profile?.nickname||(signedIn?'닉네임 설정':'로그인');
    if(open)refreshRoom();
  }});
  function el(tag,cls,value){
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(value!==undefined)node.textContent=value;
    return node;
  }
  function placeholder(message){list.replaceChildren(el('p','walk-chat-empty',message));}
  function refreshRoom(){
    const room=getRoom();
    const changed=room!==currentRoom;
    if(changed){currentRoom=room;lastSignature='';previousIds.clear();}
    if(!open)return;
    $('walkChatRoom').textContent=room?'함께 걷는 길 '+String(room).padStart(2,'0'):'동행 대기';
    if(!room){
      form.querySelector('[type=submit]').disabled=true;
      placeholder('‘다른 방문자와 함께 걷기’를 누르면 그 길의 대화방이 열립니다.');
      status.textContent='혼자 걷는 동안에는 대화가 전송되지 않습니다.';return;
    }
    form.querySelector('[type=submit]').disabled=!hasAccount();
    if(!hasAccount()){
      placeholder('대화를 보려면 별잇다 이메일 계정으로 로그인해주세요.');
      status.textContent='아바타 위치와 별개로 채팅은 이메일 인증 이용자만 가능합니다.';return;
    }
    if(changed)placeholder('대화를 불러오는 중…');
    load();
  }
  async function load(force=false){
    if(pending||!open||!currentRoom||!hasAccount()||document.hidden)return;
    if(!force&&Date.now()-lastFetchAt<1400)return;
    lastFetchAt=Date.now();
    const wanted=currentRoom;pending=true;
    try{
      const data=await rest('hm_avatar_chat_messages',{
        select:'id,author_id,author_nickname,avatar_gender,body,created_at',
        room_no:'eq.'+wanted,order:'created_at.desc,id.desc',limit:45
      },{auth:true});
      if(wanted!==currentRoom||!open)return;
      const signature=data.map(row=>row.id).join('|');
      if(signature===lastSignature)return;
      const scrolledToEnd=list.scrollTop+list.clientHeight>=list.scrollHeight-85;
      const old=previousIds;previousIds=new Set(data.map(x=>x.id));
      const ordered=[...data].reverse();
      list.replaceChildren();
      if(!ordered.length)placeholder('아직 첫 대화가 없어요. 따뜻한 인사를 남겨보세요.');
      for(const entry of ordered){
        const mine=entry.author_id===getUserId();
        const item=el('article','walk-chat-message'+(mine?' is-mine':'')),body=el('div','walk-chat-message-body');
        const head=el('div','walk-chat-message-head');
        head.append(el('strong','',entry.author_nickname),el('time','',displayDate(entry.created_at)));
        body.append(head,el('p','',entry.body));
        const actions=el('div','walk-chat-message-actions');
        const report=el('button','','신고');report.type='button';
        report.addEventListener('click',()=>ui.openReport('chat',entry.id));actions.append(report);
        if(mine||ui.isAdmin){
          const remove=el('button','','삭제');remove.type='button';
          remove.addEventListener('click',async()=>{
            if(!confirm('이 메시지를 삭제할까요?'))return;
            try{await rest('hm_avatar_chat_messages',{id:'eq.'+entry.id},{method:'DELETE'});lastSignature='';load();}
            catch(err){status.textContent=err.message;}
          });actions.append(remove);
        }
        body.append(actions);item.append(makeAvatar(entry.avatar_gender,''),body);list.append(item);
      }
      if(scrolledToEnd||lastSignature==='')list.scrollTop=list.scrollHeight;
      lastSignature=signature;
      const latest=ordered.at(-1);
      if(latest&&!old.has(latest.id)&&old.size>0&&latest.author_id!==getUserId())
        onNewMessage({body:latest.body,author_nickname:latest.author_nickname});
      status.textContent='로그인된 이용자가 남긴 대화입니다. 개인정보와 광고성 메시지는 삼가주세요.';
    }catch(err){status.textContent=err.message;}
    finally{pending=false;}
  }
  toggle.addEventListener('click',()=>{
    open=!open;panel.hidden=!open;toggle.setAttribute('aria-expanded',String(open));
    toggle.textContent=open?'접기':'대화 열기';
    if(open){
      refreshRoom();
      interval=setInterval(()=>load(),5000);
    }else{clearInterval(interval);interval=null;}
  });
  $('walkChatAccount').addEventListener('click',()=>hasAccount()?ui.openProfile():ui.openLogin());
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const room=getRoom();if(!room)return;
    const profile=await ui.requireProfile();if(!profile)return;
    const input=form.elements.message,body=input.value.trim().slice(0,250),button=form.querySelector('[type=submit]');
    if(!body)return;
    button.disabled=true;status.textContent='보내는 중…';
    try{
      await rest('hm_avatar_chat_messages',{},{
        method:'POST',body:{room_no:room,avatar_session_id:sessionId,author_id:getUserId(),
          author_nickname:profile.nickname,avatar_gender:profile.avatar_gender,body}
      });
      input.value='';lastSignature='';
      onNewMessage({body,self:true});
      await load(true);notifyPeers(room);
    }catch(err){status.textContent=err.message;}
    finally{button.disabled=false;}
  });
  window.addEventListener('pagehide',()=>clearInterval(interval));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&open)refreshRoom();});
  chat.hidden=false;
  return {refreshRoom,onNotice(room){if(room===currentRoom)load();},get open(){return open;}};
}
