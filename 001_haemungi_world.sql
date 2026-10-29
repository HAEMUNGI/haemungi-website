-- HAEMUNGI: run ONLY in the separate HAEMUNGI / haemungi-world project.
-- Public catalog is read-only to site visitors. Stats and Threads drafts remain private.
-- Re-running keeps any edits to existing records (ON CONFLICT DO NOTHING).
begin;

create table if not exists public.hm_categories (
 slug text primary key, name text not null, display_order int not null,
 is_published boolean not null default true
);
create table if not exists public.hm_assets (
 slug text primary key, kind text not null check (kind in ('character','cardnews','daily','goods','room')),
 path text not null check (path ~ '^assets/[a-zA-Z0-9/_-]+\.(webp|png|jpg|jpeg)$'),
 alt_text text not null default '', display_order int not null default 0,
 is_published boolean not null default true
);
create table if not exists public.hm_goods (
 slug text primary key, category_slug text not null references public.hm_categories(slug),
 name text not null, description text not null, asset_slug text not null references public.hm_assets(slug),
 display_order int not null, sale_status text not null default 'concept'
 check (sale_status in ('concept','planned')),
 is_published boolean not null default true
);
create table if not exists public.hm_stories (
 slug text primary key, kind text not null check (kind in ('cardnews','diary')),
 series_slug text not null, scene_number int not null check (scene_number > 0),
 title text not null, body text not null, asset_slug text references public.hm_assets(slug),
 mood text, symbol text, is_published boolean not null default true,
 unique (kind,series_slug,scene_number)
);
create table if not exists public.hm_room_spots (
 slug text primary key, icon text not null, label text not null, description text not null,
 link_page text not null check (link_page in ('home','videos','cards','daily','goods','room','about')),
 button_label text not null, x_percent numeric(5,2) not null check (x_percent between 0 and 100),
 y_percent numeric(5,2) not null check (y_percent between 0 and 100),
 display_order int not null, is_published boolean not null default true
);
create table if not exists public.hm_site_settings (
 key text primary key, value jsonb not null, is_published boolean not null default true
);
-- These are private, without public read/write policies.
create table if not exists public.hm_daily_metrics (
 day date not null, page text not null check (page in ('home','videos','cards','daily','goods','room','about')),
 page_views bigint not null default 0 check (page_views >= 0), primary key(day,page)
);
create table if not exists public.hm_social_drafts (
 id uuid primary key default gen_random_uuid(),
 platform text not null default 'threads' check (platform = 'threads'),
 body text not null,
 status text not null default 'draft' check (status in ('draft','review','approved','published','cancelled')),
 scheduled_at timestamptz, published_at timestamptz, external_post_id text,
 created_at timestamptz not null default now()
);
create index if not exists hm_assets_public_idx on public.hm_assets(kind,display_order) where is_published;
create index if not exists hm_goods_public_idx on public.hm_goods(category_slug,display_order) where is_published;
create index if not exists hm_stories_public_idx on public.hm_stories(kind,series_slug,scene_number) where is_published;
create index if not exists hm_room_public_idx on public.hm_room_spots(display_order) where is_published;

alter table public.hm_categories enable row level security;
alter table public.hm_assets enable row level security;
alter table public.hm_goods enable row level security;
alter table public.hm_stories enable row level security;
alter table public.hm_room_spots enable row level security;
alter table public.hm_site_settings enable row level security;
alter table public.hm_daily_metrics enable row level security;
alter table public.hm_social_drafts enable row level security;

-- Do not rely on Supabase's evolving automatic API grant defaults.
revoke all on public.hm_categories,public.hm_assets,public.hm_goods,public.hm_stories,
 public.hm_room_spots,public.hm_site_settings,public.hm_daily_metrics,public.hm_social_drafts
 from public,anon,authenticated;
grant select on public.hm_categories,public.hm_assets,public.hm_goods,public.hm_stories,
 public.hm_room_spots,public.hm_site_settings to anon,authenticated;

drop policy if exists hm_categories_read on public.hm_categories;
create policy hm_categories_read on public.hm_categories for select to anon,authenticated using (is_published);
drop policy if exists hm_assets_read on public.hm_assets;
create policy hm_assets_read on public.hm_assets for select to anon,authenticated using (is_published);
drop policy if exists hm_goods_read on public.hm_goods;
create policy hm_goods_read on public.hm_goods for select to anon,authenticated using (is_published);
drop policy if exists hm_stories_read on public.hm_stories;
create policy hm_stories_read on public.hm_stories for select to anon,authenticated using (is_published);
drop policy if exists hm_room_read on public.hm_room_spots;
create policy hm_room_read on public.hm_room_spots for select to anon,authenticated using (is_published);
drop policy if exists hm_settings_read on public.hm_site_settings;
create policy hm_settings_read on public.hm_site_settings for select to anon,authenticated using (is_published);

insert into public.hm_categories(slug,name,display_order) values
 ('fashion','패션·잡화',1),('living','리빙',2),('collectible','컬렉션',3),('stationery','문구',4)
on conflict(slug) do nothing;

-- Media files are still bundled within the website; no Storage upload is implied.
insert into public.hm_assets(slug,kind,path,alt_text,display_order) values
 ('character-hero','character','assets/haemungi-hero.webp','헤뭉이 공식 대표 원화',1),
 ('character-sheet','character','assets/haemungi-sheet.webp','헤뭉이 공식 캐릭터 설정화',2),
 ('character-mbti','character','assets/haemungi-mbti-portrait.webp','헤뭉이 MBTI 초상',3),
 ('room-main','room','assets/haemungi-room.webp','헤뭉이의 방',1),
 ('goods-collection','goods','assets/merch-collection.webp','헤뭉이 굿즈 라인업',0),
 ('goods-shirt','goods','assets/merch-tshirt.webp','티셔츠 시안',1),
 ('goods-cap','goods','assets/merch-cap.webp','모자 시안',2),
 ('goods-keyring','goods','assets/merch-keyring.webp','키링 시안',3),
 ('goods-phonecase','goods','assets/merch-phonecase.webp','휴대전화 케이스 시안',4),
 ('goods-mug','goods','assets/merch-mug.webp','머그컵 시안',5),
 ('goods-coin','goods','assets/merch-coin.webp','소장용 코인 시안',6),
 ('goods-stickers','goods','assets/merch-stickers.webp','스티커 시안',7),
 ('goods-totebag','goods','assets/merch-totebag.webp','에코백 시안',8),
 ('goods-notebook','goods','assets/merch-notebook.webp','노트 시안',9),
 ('goods-plush','goods','assets/merch-plush.webp','인형 시안',10),
 ('daily-first','daily','assets/daily-first-encounter.webp','첫 만남 웹툰',1),
 ('daily-moments','daily','assets/daily-little-moments.webp','일상다반사 웹툰',2),
 ('card-01','cardnews','assets/cardnews-01-01.webp','카드뉴스 1장',1),
 ('card-02','cardnews','assets/cardnews-01-02.webp','카드뉴스 2장',2),
 ('card-03','cardnews','assets/cardnews-01-03.webp','카드뉴스 3장',3),
 ('card-04','cardnews','assets/cardnews-01-04.webp','카드뉴스 4장',4),
 ('card-05','cardnews','assets/cardnews-01-05.webp','카드뉴스 5장',5),
 ('card-06','cardnews','assets/cardnews-01-06.webp','카드뉴스 6장',6),
 ('card-07','cardnews','assets/cardnews-01-07.webp','카드뉴스 7장',7),
 ('card-08','cardnews','assets/cardnews-01-08.webp','카드뉴스 8장',8),
 ('card-09','cardnews','assets/cardnews-01-09.webp','카드뉴스 9장',9)
on conflict(slug) do nothing;

insert into public.hm_goods(slug,category_slug,name,description,asset_slug,display_order) values
 ('shirt','fashion','헤뭉이 티셔츠','아이보리·블랙·핑크에 헤뭉이의 낮과 밤을 담은 티셔츠 디자인입니다.','goods-shirt',1),
 ('cap','fashion','헤뭉이 모자','아이보리·핑크·블랙·베이지 컬러에 헤뭉이를 자수로 표현한 모자 디자인입니다.','goods-cap',2),
 ('keyring','collectible','헤뭉이 키링','나비·달·꽃·물음표와 함께하는 여섯 가지 헤뭉이 키링 콘셉트입니다.','goods-keyring',3),
 ('phonecase','fashion','헤뭉이 휴대전화 케이스','아이보리·핑크·스카이블루·블랙 등 여섯 가지 헤뭉이 휴대전화 케이스 디자인입니다.','goods-phonecase',4),
 ('mug','living','헤뭉이 머그컵','햇살을 닮은 아이보리, 달빛 핑크, 스카이블루의 머그컵 디자인입니다.','goods-mug',5),
 ('coin','collectible','헤뭉이 기념 코인','헤뭉이 캐릭터를 양각으로 표현한 소장용 기념 코인 디자인입니다. 통화나 가상자산이 아닙니다.','goods-coin',6),
 ('stickers','stationery','헤뭉이 스티커 세트','일상·달빛 잠옷·꽃과 함께하는 헤뭉이의 다양한 표정을 담은 스티커 세트입니다.','goods-stickers',7),
 ('totebag','fashion','헤뭉이 에코백','따뜻한 아이보리부터 핑크·스카이블루·블랙까지 헤뭉이 에코백 디자인입니다.','goods-totebag',8),
 ('notebook','stationery','헤뭉이 노트','컬러별 표지에 먼슬리·위클리·라인·도트 페이지를 담은 노트 디자인입니다.','goods-notebook',9),
 ('plush','living','헤뭉이 포근한 인형','잠옷·베레모·꽃 장식 등 여섯 가지 헤뭉이 인형 콘셉트를 만날 수 있어요.','goods-plush',10)
on conflict(slug) do nothing;

insert into public.hm_stories(slug,kind,series_slug,scene_number,title,body,asset_slug,symbol,mood) values
 ('card-01','cardnews','birth',1,'어느 날, 머리카락 한 올이 눈을 떴다.','햇살이 드는 방. 바닥에 떨어진 머리카락 한 올이 조용히 눈을 뜨기 시작했어요.','card-01',null,null),
 ('card-02','cardnews','birth',2,'눈을 뜬 헤뭉이.','어느 날, 바닥에 떨어진 머리카락 한 올이 눈을 떴다.','card-02',null,null),
 ('card-03','cardnews','birth',3,'첫걸음.','한 걸음. 세상은 생각보다 훨씬 넓었다.','card-03',null,null),
 ('card-04','cardnews','birth',4,'따뜻하네.','헤뭉이가 처음 발견한 보물은 햇살 한 조각이었다.','card-04',null,null),
 ('card-05','cardnews','birth',5,'앗!','바람은 인사도 없이 헤뭉이를 데리고 갔다.','card-05',null,null),
 ('card-06','cardnews','birth',6,'너는 누구야?','처음으로 누군가 헤뭉이를 발견했다.','card-06',null,null),
 ('card-07','cardnews','birth',7,'헤뭉이.','그날, 이름이 없던 작은 털뭉치에게 이름이 생겼다.','card-07',null,null),
 ('card-08','cardnews','birth',8,'돌아갈 자리.','세상은 여전히 컸지만, 이제 무섭지 않았다. 헤뭉이에게도 돌아갈 자리가 생겼으니까.','card-08',null,null),
 ('card-09','cardnews','birth',9,'내일도, 또 다른 세상이야.','아주 작지만, 매일 새로운 세상을 발견하는 작은 기적.','card-09',null,null),
 ('diary-01','diary','little-days',1,'햇살을 발견한 날','창가의 햇살이 바닥에 동그랗게 내려앉았다. 헤뭉이는 그 안에 발끝을 넣고, 조금 오래 가만히 있었다.',null,'☀','포근함'),
 ('diary-02','diary','little-days',2,'바람이 지나간 자리','커튼이 살짝 흔들렸다. 헤뭉이의 머리카락도 한 박자 늦게, 살랑 하고 인사했다.',null,'〰','간지러움'),
 ('diary-03','diary','little-days',3,'아무것도 하지 않은 오후','놀라운 일은 없었다. 그런데 이상하게도 참 좋은 하루였다고, 헤뭉이는 생각했다.',null,'☾','나른함')
on conflict(slug) do nothing;

insert into public.hm_room_spots(slug,icon,label,description,link_page,button_label,x_percent,y_percent,display_order) values
 ('window','☀','햇살 드는 창문','헤뭉이는 따뜻한 자리를 가장 먼저 알아차려요. 창가에 앉아 아무것도 하지 않아도 괜찮답니다.','daily','일상 이야기 보기',20,40,1),
 ('bell','♫','조그만 방울','처음엔 낯선 소리가 무서웠지만, 작은 딸랑거림과 친구가 되었어요. 어떻게 만났는지 읽어볼까요?','cards','방울 이야기 읽기',21,83,2),
 ('haemungi','♡','낮잠 자는 헤뭉이','쉿, 지금은 낮잠 시간. 조금 느려도 괜찮다는 것을 헤뭉이에게 배워요.','about','헤뭉이 알아보기',50,61,3),
 ('frame','✿','작은 그림 액자','오늘 만난 순간을 이곳에 남겨요. 아무 뜻 없는 낙서도 헤뭉이에게는 소중한 기억이에요.','daily','원화 감상하기',60,28,4),
 ('books','✧','이야기가 잠든 책장','책에는 헤뭉이의 질문들이 살아요. 바람은 어디에서 올까? 작은 용기는 무슨 모양일까?','cards','카드뉴스 넘기기',76,35,5),
 ('mug','☕','따끈한 머그잔','따뜻한 것을 좋아하는 헤뭉이답죠? 머그컵도 작은 굿즈로 상상해 보았어요.','goods','굿즈 진열장 보기',85,73,6),
 ('shelf','✦','반짝이는 진열장','동전, 인형, 방울, 키링까지. 아직은 상상 속 소장품이지만 하나씩 차곡차곡 전시 중이에요.','goods','굿즈 둘러보기',96,37,7)
on conflict(slug) do nothing;

insert into public.hm_site_settings(key,value) values
 ('identity','{"name":"헤뭉이","name_en":"HAEMUNGI","creator":"일현 조성훈","description":"사소한 우연이 포근한 친구가 되는 곳."}'::jsonb),
 ('character_profile','{"birthplace":"어느 날, 햇살이 들어온 방바닥","personality":"조용하고 순진해요. 호기심은 아주 많아요.","likes":"따뜻한 바람, 햇살, 사람","dislikes":"큰 소리와 서두르는 걸음","features":"크림 화이트 몸, 작은 점눈, 머리 위로 솟은 한 가닥의 곡선"}'::jsonb),
 ('mbti','{"type":"INFP","disclaimer":"실제 성격검사가 아닌 캐릭터 창작 해석"}'::jsonb)
on conflict(key) do nothing;
commit;
