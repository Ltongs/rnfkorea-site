-- 운행일지: 계기판 입력 제거, 장소(상호/주소) 기준 거리 자동계산으로 전환
-- 출발지/도착지를 장소검색(supabase/functions/truck-route)으로 고르면 좌표를 저장하고,
-- 두 좌표로 카카오모빌리티 길찾기 거리(km)를 받아 distance_km에 넣는다.
alter table public.truck_trips drop column if exists odometer_start;
alter table public.truck_trips drop column if exists odometer_end;
alter table public.truck_fuels drop column if exists odometer;

alter table public.truck_trips add column if not exists origin_address text;
alter table public.truck_trips add column if not exists origin_x numeric(10,7);   -- 경도
alter table public.truck_trips add column if not exists origin_y numeric(10,7);   -- 위도
alter table public.truck_trips add column if not exists dest_address text;
alter table public.truck_trips add column if not exists dest_x numeric(10,7);
alter table public.truck_trips add column if not exists dest_y numeric(10,7);
alter table public.truck_trips add column if not exists distance_approx boolean not null default false;  -- 길찾기 실패로 직선거리 근사값인 경우
