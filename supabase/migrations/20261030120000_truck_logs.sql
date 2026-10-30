-- 화물운송사업 운행일지 (AI비서 "🚚 운행일지" 탭)
-- 차량: 타타대우 25톤 윙바디 1대로 시작 (vehicle 컬럼으로 추후 증차 대비)
-- 운전자: 대표 + 기사 1인 (driver 텍스트)
-- 권한: admin@rnfkorea.co.kr, ltongs7@gmail.com, everyasset.fc@gmail.com 세 계정이 같은 데이터를 함께 본다.
-- Supabase 대시보드 SQL Editor에서 이 파일 내용을 실행해 주세요. (앱 배포 전에 먼저 실행 필요)

create or replace function public.is_truck_log_user()
returns boolean language sql stable as $function$
  select coalesce((auth.jwt()->>'email'), '') in
    ('admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com');
$function$;

-- 운행 기록: 일자별 출발-도착, 운행거리
create table if not exists public.truck_trips (
  id             bigint generated always as identity primary key,
  trip_date      date not null,
  vehicle        text not null default '타타대우 25톤 윙바디',
  driver         text not null,
  origin         text not null,
  destination    text not null,
  odometer_start numeric(10,1),           -- 출발 계기판(km), 선택
  odometer_end   numeric(10,1),           -- 도착 계기판(km), 선택
  distance_km    numeric(8,1),            -- 운행거리(km). 계기판 입력 시 화면에서 자동 계산
  cargo          text,                    -- 화물/화주, 선택
  memo           text,
  created_by     text default (auth.jwt()->>'email'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_truck_trips_date on public.truck_trips(trip_date);

-- 주유 내역
create table if not exists public.truck_fuels (
  id          bigint generated always as identity primary key,
  fuel_date   date not null,
  vehicle     text not null default '타타대우 25톤 윙바디',
  driver      text not null,
  station     text,                       -- 주유소
  liters      numeric(8,2),               -- 주유량(L)
  unit_price  integer,                    -- 단가(원/L)
  amount      integer not null,           -- 금액(원)
  odometer    numeric(10,1),              -- 주유 시 계기판(km), 선택
  pay_method  text,                       -- 결제수단(유류카드/법인카드/현금 등)
  memo        text,
  created_by  text default (auth.jwt()->>'email'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_truck_fuels_date on public.truck_fuels(fuel_date);

alter table public.truck_trips enable row level security;
alter table public.truck_fuels enable row level security;

create policy truck_trips_users_all on public.truck_trips
  for all using (public.is_truck_log_user()) with check (public.is_truck_log_user());
create policy truck_fuels_users_all on public.truck_fuels
  for all using (public.is_truck_log_user()) with check (public.is_truck_log_user());

-- 2026-10-30부터 public 새 테이블은 grant를 명시해야 한다
grant select, insert, update, delete on public.truck_trips to authenticated;
grant select, insert, update, delete on public.truck_fuels to authenticated;
grant all on public.truck_trips to service_role;
grant all on public.truck_fuels to service_role;
