-- ORIX 인센티브 관리 화면: admin(admin@rnfkorea.co.kr, ltongs7@gmail.com)과
-- ORIX 조용백(yongbaek_jo@orix.co.kr) 단 두 사람만 접근하는 전용 페이지.
--
-- 권한 분리:
--   admin  : 확정일자/고객명/확정금액/품목/인센티브(총,지급대상) + 지급일자/지급처/공제금액/송금증 전부
--   yongbaek_jo : 확정일자/고객명/확정금액/품목/인센티브(총,지급대상)만 — 지급일자/지급처/공제금액/송금증은
--                 조회는 물론 API 응답에도 아예 포함되지 않아야 함(단순 UI 숨김이 아니라 서버 단에서 차단).
--
-- Supabase RLS는 행(row) 단위 제어만 가능하고 열(column) 단위 제어는 못 하므로,
-- 기본 테이블은 admin 전용으로 완전히 잠그고, yongbaek_jo는 admin 전용 컬럼을 아예
-- select 목록에서 뺀 뷰(orix_incentives_partner_view)를 통해서만 접근하게 한다.
-- 이 뷰는 컬럼 목록이 단순(단일 테이블, WHERE절만 존재)해 Postgres가 자동으로
-- insert/update 가능한 "updatable view"로 처리하므로, yongbaek_jo가 뷰를 통해
-- 자기 담당 필드를 직접 입력/수정할 수 있으면서도 admin 전용 컬럼은 애초에 뷰의
-- 컬럼 타입에 없어서 절대 읽거나 쓸 수 없다.

create or replace function public.is_orix_admin()
returns boolean language sql stable as $function$
  select coalesce((auth.jwt()->>'email'), '') in ('admin@rnfkorea.co.kr','ltongs7@gmail.com');
$function$;

create or replace function public.is_orix_partner()
returns boolean language sql stable as $function$
  select coalesce((auth.jwt()->>'email'), '') = 'yongbaek_jo@orix.co.kr';
$function$;

create table public.orix_incentives (
  id uuid primary key default gen_random_uuid(),
  -- ── 조용백(ORIX) 입력 항목 ──
  confirmed_date date,
  customer_name text not null,
  confirmed_amount numeric,
  item text,
  incentive_total numeric,
  incentive_recipient text,
  -- ── admin 전용 항목 ──
  paid_at date,
  paid_to text,
  deduction_amount numeric,
  wire_receipt_path text,
  created_by text default (auth.jwt()->>'email'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_orix_incentives_updated_at()
returns trigger language plpgsql as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

create trigger orix_incentives_set_updated_at
  before update on public.orix_incentives
  for each row execute function public.set_orix_incentives_updated_at();

alter table public.orix_incentives enable row level security;

create policy orix_incentives_admin_all on public.orix_incentives
  for all using (public.is_orix_admin()) with check (public.is_orix_admin());

revoke all on public.orix_incentives from anon;

-- ── 조용백 전용 뷰: admin 전용 컬럼(paid_at/paid_to/deduction_amount/wire_receipt_path)을
--    애초에 select 목록에서 제외 ──
create view public.orix_incentives_partner_view as
select
  id, confirmed_date, customer_name, confirmed_amount, item,
  incentive_total, incentive_recipient, created_at, updated_at
from public.orix_incentives
where public.is_orix_admin() or public.is_orix_partner();

grant select, insert, update on public.orix_incentives_partner_view to authenticated;
revoke all on public.orix_incentives_partner_view from anon;

-- ── 송금증 업로드 스토리지 버킷 (admin 전용, 조용백은 업로드/조회 모두 불가) ──
insert into storage.buckets (id, name, public)
values ('orix_wire_receipts', 'orix_wire_receipts', false)
on conflict (id) do nothing;

create policy orix_wire_receipts_admin_all on storage.objects for all
  using (bucket_id = 'orix_wire_receipts' and public.is_orix_admin())
  with check (bucket_id = 'orix_wire_receipts' and public.is_orix_admin());
