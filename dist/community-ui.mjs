import {getSession,hasAccount,signIn,signUp,signOut,getProfile,saveProfile,adminStatus,report}
  from './community-client.mjs';
import {readWalkIdentity,TERMS_VERSION} from './community-core.mjs';

// Shared account and reporting dialogs. Only these fixed strings use innerHTML;
// visitor content everywhere else uses textContent.
export function createCommunityUi({onChange=()=>{}}={}){
  let profile=null,isAdmin=false,pendingReport=null;
  const root=document.createElement('div');
  root.innerHTML=[
    '<dialog class="cm-dialog" id="cmLoginDialog" aria-labelledby="cmLoginTitle">',
      '<form id="cmLoginForm"><h2 id="cmLoginTitle">헤뭉이 계정</h2>',
      '<p>별잇다에서 쓰는 이메일 계정으로 함께 이용합니다.</p>',
      '<label>이메일<input id="cmEmail" type="email" autocomplete="email" required></label>',
      '<label>비밀번호<input id="cmPassword" type="password" autocomplete="current-password" minlength="8" required></label>',
      '<p id="cmLoginFeedback" class="cm-feedback" role="status"></p>',
      '<div class="cm-dialog-actions"><button class="cm-button" type="submit">로그인</button>',
      '<button class="cm-button secondary" type="button" id="cmSignUp">계정 만들기</button>',
      '<button class="cm-button quiet" type="button" id="cmLoginClose">닫기</button></div>',
      '<p class="cm-small">계정 만들기 후 이메일 확인 링크를 눌러주세요. 기존 추모 기록은 변경되지 않습니다.</p>',
      '</form></dialog>',
    '<dialog class="cm-dialog" id="cmProfileDialog" aria-labelledby="cmProfileTitle">',
      '<form id="cmProfileForm"><h2 id="cmProfileTitle">커뮤니티 아바타 이름</h2>',
      '<p>다른 방문자에게는 닉네임과 미니미 모습만 보입니다. 이메일은 공개하지 않습니다.</p>',
      '<label>닉네임<input id="cmNickname" maxlength="14" minlength="2" autocomplete="off" required></label>',
      '<fieldset class="cm-avatar-choice"><legend>아바타</legend>',
      '<label><input name="cmGender" type="radio" value="male" required>',
      '<img src="/assets/avatars/felt-male-idle.webp" alt="남성 양모펠트 미니미"> 남성 미니미</label>',
      '<label><input name="cmGender" type="radio" value="female" required>',
      '<img src="/assets/avatars/felt-female-idle.webp" alt="여성 양모펠트 미니미"> 여성 미니미</label>',
      '</fieldset>',
      '<label id="cmConsentRow" class="cm-consent"><input id="cmConsent" type="checkbox">',
      '<span><a href="/terms.html" target="_blank" rel="noopener">이용약관</a> 및 ',
      '<a href="/privacy.html" target="_blank" rel="noopener">개인정보처리방침</a>을 확인하고 ',
      '커뮤니티 참여에 동의하며 만 14세 이상입니다. ('+TERMS_VERSION+')</span></label>',
      '<p id="cmProfileFeedback" class="cm-feedback" role="status"></p>',
      '<div class="cm-dialog-actions"><button class="cm-button" type="submit">저장하고 참여하기</button>',
      '<button class="cm-button secondary" type="button" id="cmProfileClose">나중에</button>',
      '<button class="cm-button quiet" type="button" id="cmLogout">로그아웃</button></div>',
      '</form></dialog>',
    '<dialog class="cm-dialog" id="cmReportDialog" aria-labelledby="cmReportTitle">',
      '<form id="cmReportForm"><h2 id="cmReportTitle">신고하기</h2>',
      '<p>타인의 개인정보, 광고·도배, 공격적인 내용 등을 알려주세요.</p>',
      '<label>신고 사유<textarea id="cmReportReason" maxlength="300" minlength="2" rows="4" required ',
      'placeholder="사유를 2자 이상 작성해주세요."></textarea></label>',
      '<p id="cmReportFeedback" class="cm-feedback" role="status"></p>',
      '<div class="cm-dialog-actions"><button class="cm-button" type="submit">신고 보내기</button>',
      '<button class="cm-button secondary" type="button" id="cmReportClose">취소</button></div>',
      '</form></dialog>'
  ].join('');
  document.body.append(...root.childNodes);
  const $=id=>document.getElementById(id);
  const login=$('cmLoginDialog'),profileDialog=$('cmProfileDialog'),reportDialog=$('cmReportDialog');
  const feedback=(id,message)=>{$(id).textContent=message;};
  async function refresh(){
    try{
      if(hasAccount()){
        [profile,isAdmin]=await Promise.all([getProfile(),adminStatus()]);
      }else{profile=null;isAdmin=false;}
    }catch{profile=null;isAdmin=false;}
    onChange({signedIn:hasAccount(),profile,isAdmin,email:getSession()?.user?.email||''});
    return profile;
  }
  function openLogin(){if(!login.open)login.showModal();}
  function openProfile(){
    if(!hasAccount()){openLogin();return;}
    const walk=readWalkIdentity();
    $('cmNickname').value=profile?.nickname||walk?.nickname||'';
    const gender=profile?.avatar_gender||walk?.gender||'male';
    for(const radio of document.querySelectorAll('input[name=cmGender]'))radio.checked=radio.value===gender;
    $('cmConsentRow').hidden=Boolean(profile);
    $('cmConsent').checked=Boolean(profile);
    feedback('cmProfileFeedback','');
    if(!profileDialog.open)profileDialog.showModal();
  }
  async function requireProfile(){
    if(!hasAccount()){openLogin();return null;}
    if(!profile)await refresh();
    if(!profile){openProfile();return null;}
    return profile;
  }
  $('cmLoginClose').addEventListener('click',()=>login.close());
  $('cmProfileClose').addEventListener('click',()=>profileDialog.close());
  $('cmLogout').addEventListener('click',async()=>{profileDialog.close();await signOut();await refresh();});
  $('cmReportClose').addEventListener('click',()=>reportDialog.close());
  $('cmLoginForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const email=$('cmEmail').value.trim().toLowerCase(),password=$('cmPassword').value;
    feedback('cmLoginFeedback','로그인하는 중…');
    try{await signIn(email,password);$('cmPassword').value='';login.close();await refresh();}
    catch(err){feedback('cmLoginFeedback',err.message);}
  });
  $('cmSignUp').addEventListener('click',async()=>{
    const email=$('cmEmail').value.trim().toLowerCase(),password=$('cmPassword').value;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||password.length<8){
      feedback('cmLoginFeedback','이메일 주소와 8자 이상의 비밀번호를 입력해주세요.');return;
    }
    feedback('cmLoginFeedback','이메일 인증 안내를 보내는 중…');
    try{await signUp(email,password);feedback('cmLoginFeedback','확인 메일을 보냈습니다. 인증 후 로그인해주세요.');}
    catch(err){feedback('cmLoginFeedback',err.message);}
  });
  $('cmProfileForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const checked=document.querySelector('input[name=cmGender]:checked');
    if(!profile&&!$('cmConsent').checked){feedback('cmProfileFeedback','약관과 개인정보처리방침을 먼저 확인하고 동의해주세요.');return;}
    feedback('cmProfileFeedback','프로필을 저장하는 중…');
    try{
      await saveProfile($('cmNickname').value,checked?.value,Boolean(profile));
      profileDialog.close();await refresh();
    }catch(err){
      feedback('cmProfileFeedback',err.code==='23505'?'이미 사용 중인 닉네임입니다. 다른 이름을 선택해주세요.':err.message);
    }
  });
  function openReport(kind,id){
    if(!hasAccount()){openLogin();return;}
    if(!['post','comment','chat'].includes(kind)||!id)return;
    pendingReport={kind,id};$('cmReportReason').value='';
    feedback('cmReportFeedback','');reportDialog.showModal();
  }
  $('cmReportForm').addEventListener('submit',async event=>{
    event.preventDefault();
    if(!pendingReport)return;
    feedback('cmReportFeedback','신고를 접수하는 중…');
    try{
      await report(pendingReport.kind,pendingReport.id,$('cmReportReason').value);
      pendingReport=null;reportDialog.close();
      window.dispatchEvent(new CustomEvent('haemungi:reported'));
    }catch(err){feedback('cmReportFeedback',err.message);}
  });
  async function logout(){await signOut();await refresh();}
  refresh();
  window.addEventListener('haemungi:visitor',()=>{refresh();});
  return {refresh,openLogin,openProfile,requireProfile,openReport,logout,
    get profile(){return profile;},get isAdmin(){return isAdmin;}};
}
