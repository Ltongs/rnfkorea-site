-- 운행일지 한 페이지(일자별 표)로 통합: 운행 한 줄에 주유·요소수·운임을 함께 기록
--   일자 / 순번 / 출발지 / 도착지 / 거리 / 주유(L, 금액) / 요소수(L, 금액) / 운임
-- 별도 주유 테이블(truck_fuels)은 데이터 없이 폐기
alter table public.truck_trips add column if not exists fuel_liters numeric(8,2);
alter table public.truck_trips add column if not exists fuel_amount integer;
alter table public.truck_trips add column if not exists urea_liters numeric(8,2);
alter table public.truck_trips add column if not exists urea_amount integer;
alter table public.truck_trips add column if not exists freight integer;          -- 운임(원)
alter table public.truck_trips alter column driver drop not null;                 -- 운전자는 선택 입력
alter table public.truck_trips alter column driver set default '대표';

drop table if exists public.truck_fuels;
