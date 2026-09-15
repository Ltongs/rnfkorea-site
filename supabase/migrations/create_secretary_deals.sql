-- AI비서(/work/secretary) 메모 탭 상단 "진행 중인 딜" 섹션용 테이블
-- Supabase 대시보드 SQL Editor에서 이 파일 내용을 실행해 주세요.
-- (코드에서 자동으로 실행되지 않습니다 — 앱 배포 전에 반드시 먼저 실행 필요)

create table if not exists secretary_deals (
  id          bigint generated always as identity primary key,
  content     text not null,              -- 형식 없는 자유 메모 (예: "OO중공업 지게차 3대 상담중, 견적 발송함")
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create index if not exists idx_secretary_deals_is_active on secretary_deals(is_active, created_at desc);

alter table secretary_deals enable row level security;

create policy "authenticated_all_secretary_deals" on secretary_deals
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
