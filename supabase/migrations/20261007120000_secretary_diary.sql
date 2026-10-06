-- AI비서(/work/secretary) "📔 다이어리" 탭용 테이블
-- 당일 한 일 / 내일 할 일을 날짜별로 기록하고, 할 일 항목을 secretary_schedules 일정으로 바로 등록한다.
-- Supabase 대시보드 SQL Editor에서 이 파일 내용을 실행해 주세요.
-- (코드에서 자동으로 실행되지 않습니다 — 앱 배포 전에 반드시 먼저 실행 필요)

-- 항목: kind='done'(한 일) | 'plan'(할 일). plan 항목의 entry_date는 "실행할 날짜"이다.
--   예) 10/7 화면의 "내일 할 일"에 적은 항목 → entry_date = 10/8
--       10/8 화면에서는 "오늘 할 일"로 보이고, 체크하면 "오늘 한 일"에 함께 집계된다.
create table if not exists secretary_diary_items (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date  date not null,
  kind        text not null check (kind in ('done','plan')),
  content     text not null,
  is_checked  boolean not null default false,
  schedule_id bigint references secretary_schedules(id) on delete set null,  -- 일정으로 등록된 경우
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_secretary_diary_items_user_date
  on secretary_diary_items(user_id, entry_date);

alter table secretary_diary_items enable row level security;

create policy "own_secretary_diary_items" on secretary_diary_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 하루 단위 자유 메모(회고·특이사항)
create table if not exists secretary_diary_notes (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  entry_date  date not null,
  note        text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (user_id, entry_date)
);

alter table secretary_diary_notes enable row level security;

create policy "own_secretary_diary_notes" on secretary_diary_notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
