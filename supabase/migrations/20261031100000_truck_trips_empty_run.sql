-- 운행일지 공차거리: 직전 구간의 도착지 → 이 구간의 출발지가 다르면 그 사이를 빈 차로 이동한 거리(공차)로 본다.
-- 공차는 "이 구간 앞"의 이동으로 이 줄에 저장한다. empty_from은 계산 기준(직전 도착지 이름|경도|위도)이며,
-- 앞 구간이 바뀌어 기준이 달라지면 화면에서 다시 계산한다.
alter table public.truck_trips add column if not exists empty_km numeric(8,1);
alter table public.truck_trips add column if not exists empty_approx boolean not null default false;  -- 직선거리 근사값
alter table public.truck_trips add column if not exists empty_manual boolean not null default false;  -- 직접 입력한 값 (자동계산으로 덮어쓰지 않음)
alter table public.truck_trips add column if not exists empty_from text;
