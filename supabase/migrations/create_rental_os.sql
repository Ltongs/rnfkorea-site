-- Rental_O/S (렌탈 딜 아웃소싱) 업무 페이지용 테이블/스토리지 생성
-- Supabase 대시보드 SQL Editor에서 이 파일 내용을 실행해 주세요.
-- (코드에서 자동으로 실행되지 않습니다 — 앱 배포 전에 반드시 먼저 실행 필요)

-- ── 1) 딜 테이블 ──────────────────────────────────────────────
create table if not exists rental_os_deals (
  id               bigint generated always as identity primary key,
  deal_no          text,                          -- 케이스 번호 (RO-2026-00001 형식, 앱에서 생성)
  customer_name    text not null,
  company_name     text,
  customer_phone   text,
  description      text,                          -- 딜 설명
  equipment_type   text,                           -- 장비/차량 종류
  equipment_spec   text,                           -- 규격/톤수 등
  rental_period    text,                           -- 렌탈 기간 (예: 12개월)
  amount           numeric,                        -- 딜 금액 (취급액)
  outsourcing_partner text,                        -- 아웃소싱 협력사명
  sales_rep        text,                           -- 담당자
  status           text not null default '접수',   -- 접수 | 진행중 | 확정 | 반려
  reject_reason    text,                           -- 반려 사유 (status=반려일 때)
  special_note     text,
  created_by       text,                           -- 등록자 이메일
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  closed_at        timestamptz                     -- 확정/반려로 종결된 시각
);

create index if not exists idx_rental_os_deals_status on rental_os_deals(status);
create index if not exists idx_rental_os_deals_created_at on rental_os_deals(created_at);

-- ── 2) 첨부파일 (자유 다중 업로드) ──────────────────────────────
create table if not exists rental_os_deal_files (
  id            bigint generated always as identity primary key,
  deal_id       bigint not null references rental_os_deals(id) on delete cascade,
  file_name     text not null,                     -- 사용자가 지정한 파일명(확장자 포함)
  storage_path  text not null,                     -- rental_os_docs 버킷 내 경로
  file_size     bigint,
  uploaded_by   text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_rental_os_deal_files_deal_id on rental_os_deal_files(deal_id);

-- ── 3) 딜 히스토리 (경과/타임라인) ──────────────────────────────
create table if not exists rental_os_deal_history (
  id            bigint generated always as identity primary key,
  deal_id       bigint not null references rental_os_deals(id) on delete cascade,
  event_type    text not null,                     -- created | status_change | note | file_upload | file_delete | edit
  from_status   text,
  to_status     text,
  note          text,
  created_by    text,
  created_at    timestamptz not null default now()
);

create index if not exists idx_rental_os_deal_history_deal_id on rental_os_deal_history(deal_id);

-- ── 4) RLS ────────────────────────────────────────────────────
-- 이 앱은 프론트엔드(RouteGuard)에서 admin/kohd1222@naver.com 만 페이지 접근을 막고 있습니다.
-- RLS는 "로그인한 사용자"까지만 걸러주며, 이메일 단위 세부 제한은 프론트엔드가 담당합니다.
-- (다른 테이블들의 RLS 정책과 다르다면 Supabase 대시보드에서 맞춰서 조정해 주세요.)
alter table rental_os_deals enable row level security;
alter table rental_os_deal_files enable row level security;
alter table rental_os_deal_history enable row level security;

create policy "authenticated_all_rental_os_deals" on rental_os_deals
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_all_rental_os_deal_files" on rental_os_deal_files
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "authenticated_all_rental_os_deal_history" on rental_os_deal_history
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── 5) Storage 버킷 ───────────────────────────────────────────
-- SQL Editor에서 버킷 생성은 아래 insert로 가능하지만, 안 되면 대시보드 Storage 탭에서
-- "rental_os_docs" 버킷을 Private(비공개)로 직접 만들어 주세요.
insert into storage.buckets (id, name, public)
values ('rental_os_docs', 'rental_os_docs', false)
on conflict (id) do nothing;

create policy "authenticated_read_rental_os_docs" on storage.objects
  for select using (bucket_id = 'rental_os_docs' and auth.role() = 'authenticated');
create policy "authenticated_write_rental_os_docs" on storage.objects
  for insert with check (bucket_id = 'rental_os_docs' and auth.role() = 'authenticated');
create policy "authenticated_delete_rental_os_docs" on storage.objects
  for delete using (bucket_id = 'rental_os_docs' and auth.role() = 'authenticated');
