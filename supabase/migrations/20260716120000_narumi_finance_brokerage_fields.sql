-- 나르미 페이지 기능 추가(2026-07-16): 결제방식/영업용 세부구분/임시번호판 반납/번호판 중개 플로우.
-- 전부 nullable(또는 안전한 기본값)로 추가하는 non-breaking 변경. 기존 데이터/로직에 영향 없음.

begin;

alter table public.narumi_tasks add column if not exists finance_type text; -- '할부' | '리스' | '현금'
alter table public.narumi_tasks add column if not exists lease_company text; -- 리스 선택시 리스사 수기입력
alter table public.narumi_tasks add column if not exists business_type text; -- '개별' | '용달' | '지입' (용도구분이 영업용일 때만)
alter table public.narumi_tasks add column if not exists temp_plate_returned boolean; -- 임시번호판 반납여부 (Y=true/N=false)
alter table public.narumi_tasks add column if not exists temp_plate_return_due_date text; -- N일 때 예정 반납일자 (YYYY.MM.DD, delivery_date_text와 동일 포맷)
alter table public.narumi_tasks add column if not exists is_plate_brokerage boolean not null default false; -- 영업용 번호판 중개 건 여부
alter table public.narumi_tasks add column if not exists brokerage_result text; -- '중개완료' | '보류' | '취소'
alter table public.narumi_tasks add column if not exists is_dispatched boolean not null default false; -- 중개 건이 '출고' 처리되어 정식 건으로 전환됐는지

commit;
