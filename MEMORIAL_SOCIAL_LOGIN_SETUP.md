# 별빛 추모관 · 카카오/Google 간편 로그인 운영 설정

## 구현된 기능

- `dist/memorial.html`: 기존 이메일·비밀번호 로그인 유지 + 카카오/Google 버튼 + 로그인된 계정의 추가 연결.
- `dist/memorial-registration.js`: Supabase Auth PKCE(S256) 인증·단일 코드 교환, 세션 유지, 회원 UID 일치 검증, URL의 인증 코드 제거.
- `GET /auth/v1/settings`에서 제공자 활성화가 확인되기 전까지 간편 로그인 버튼은 비활성화됩니다. 서비스 설정을 건너뛰는 가짜 로그인은 없습니다.
- 로그인 상태에서 `카카오 계정 연결`/`Google 계정 연결`을 사용하면 **기존 회원 UID를 유지**하도록 검증합니다. 서로 다른 UID가 반환되면 새 회원으로 전환하지 않습니다.
- 명패 신청·기존 무료 기록의 명패 승격에는 Supabase가 확인한 이메일이 필요합니다. 카카오에서 이메일 동의를 하지 않거나 계정 이메일을 제공하지 않으면 **로그인은 가능하지만 명패 신청은 제한**되며 안내 문구가 나옵니다.
- 무료 기록관은 이전과 같이 로그인 없이 이용할 수 있습니다.

## 실제 서비스 연동을 위해 운영자가 완료할 설정

1. **Supabase** `haemungi-world` 프로젝트 (ref `ayymgaddbsglwqxurlff`) → Authentication → URL Configuration에서 아래 주소를 Redirect URL 허용 목록에 추가합니다.

   `https://haemungi.pages.dev/memorial.html?memorial_oauth=1`

   추후 `memorial.bsbktv.com` 등 다른 도메인에서 서비스를 제공한다면 **그 도메인의 같은 주소도 별도로 등록**해야 합니다.

2. **Google Cloud Console**에서 별빛 추모관용 OAuth 앱/웹 클라이언트를 등록합니다. 승인된 리디렉션 URI는 다음과 같습니다.

   `https://ayymgaddbsglwqxurlff.supabase.co/auth/v1/callback`

   발급된 Client ID와 Client Secret을 **Supabase → Authentication → Sign In / Providers → Google** 설정에 직접 저장하고 Google 제공자를 켭니다.

3. **Kakao Developers**에서 별빛 추모관 앱을 만들고 카카오 로그인을 활성화합니다. REST API 키를 Client ID로 사용하고, 카카오 로그인용 Client Secret을 활성화한 후 **동일한 Supabase callback URI**를 Kakao Login Redirect URI에 입력합니다. Client ID와 Secret은 **Supabase → Authentication → Sign In / Providers → Kakao**에 직접 저장하고 Kakao 제공자를 켭니다.

4. Supabase Authentication 설정에서 **Enable Manual Linking**을 켭니다. 기존 이메일 계정에서 카카오/Google로 안전하게 연결하는 기능이 이 설정에 의존합니다.

5. 카카오에서 확인된 이메일이 제공될 수 있도록 필요한 **동의 항목 및 Kakao Biz App** 요건을 확인합니다. 이메일 제공은 항상 보장되지 않습니다. 사용자에게 불필요한 연락처/친구 목록 등의 추가 권한을 요청하지 않습니다.

6. **실제 환경 검증**: (a) 신규 카카오 및 Google 로그인, (b) 기존 이메일 회원의 각 제공자 연결, (c) 새로고침 후 세션 복구, (d) 이메일 미제공 카카오 계정에서 명패 신청 차단, (e) 기존 명패 신청/사진 소유권 유지, (f) 다른 계정/다른 기기에서 신청 기록 접근 차단을 직접 확인합니다. 별빛 추모관 관리자에게는 MFA 적용을 권장합니다.

> **주의:** Client Secret, Google/Kakao 계정 비밀번호, Supabase service role key를 GitHub 저장소나 `dist/`에 업로드하거나 사용자에게 공유해서는 안 됩니다. 공급자 비밀 키는 Supabase 설정 화면에서만 입력합니다.

## 공식 안내

- Google: https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- Kakao: https://supabase.com/docs/guides/auth/social-sign-in/auth-kakao
- 회원 계정 연결: https://supabase.com/docs/guides/auth/auth-identity-linking
- PKCE: https://supabase.com/docs/guides/auth/sessions/pkce-flow

자동검사: `node verify-memorial-social-auth.mjs`
