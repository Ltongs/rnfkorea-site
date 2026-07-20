-- 진흥주문 계산서발행 자동연동 버그 수정 (2026-07-20)
-- tb_orders.id는 uuid인데 sales_records.jinheung_order_id가 bigint로 만들어져 있어서
-- 계산서발행 시 매출 자동 등록 insert가 항상 22P02(invalid input syntax for type bigint)로 실패했음.
-- 실패해도 프론트에서 insert 에러를 체크하지 않아 조용히 무시되고, tb_orders 상태만 "계산서발행"으로
-- 바뀐 채 sales_records에는 아무 것도 남지 않았다. jinheung_order_id가 채워진 행이 하나도 없어
-- 이 기능은 도입 이후 한 번도 정상 작동한 적이 없었던 것으로 보인다.

begin;

alter table public.sales_records
  alter column jinheung_order_id type uuid using jinheung_order_id::text::uuid;

commit;
