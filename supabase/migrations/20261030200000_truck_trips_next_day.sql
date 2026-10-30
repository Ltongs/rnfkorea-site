-- 운행일지 당착/익일착 구분. trip_date는 상차일 기준, next_day=true면 도착일 = 상차일 + 1일
alter table public.truck_trips add column if not exists next_day boolean not null default false;
