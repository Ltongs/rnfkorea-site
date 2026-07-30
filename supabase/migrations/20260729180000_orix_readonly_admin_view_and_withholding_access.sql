-- 1) 원천징수관리(WithholdingPage) 접근권한에 ltongs7@gmail.com(본인) 추가.
--    기존엔 admin@rnfkorea.co.kr, everyasset.fc@gmail.com만 허용되어 있어 본인 계정으로는
--    /work/withholding 페이지에 들어가도 데이터가 비어 보였다.
alter policy contractors_all on public.tb_contractors
  using (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com']));

alter policy payments_all on public.tb_withholding_payments
  using (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com']));

alter policy gift_card_stock_all on public.tb_gift_card_stock
  using (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com']));

-- 2) ORIX 파트너(조용백)에게 관리자 전용 항목(지급일자/지급처/실지급금액/비고/송금증)을
--    "읽기전용"으로 노출. 기존 orix_incentives_partner_view는 이 컬럼들이 아예 없어서
--    수정용으로도 재사용하면 조용백이 admin 컬럼까지 update할 수 있게 되므로,
--    조회용(전체 컬럼 포함)과 입력용(영업 항목만)을 별개의 뷰로 분리한다.
--      - orix_incentives_partner_view       : SELECT 전용, admin 컬럼 포함(읽기전용)
--      - orix_incentives_partner_edit_view  : INSERT/UPDATE 가능, 영업 항목만(기존과 동일 범위)
drop view public.orix_incentives_partner_view;

create view public.orix_incentives_partner_edit_view as
select
  id, confirmed_date, customer_name, loan_principal, product_type, vehicle_type,
  incentive_rate, incentive_total, cm_incentive_rate, cm_paid_incentive,
  incentive_recipient, created_at, updated_at
from public.orix_incentives
where public.is_orix_admin() or public.is_orix_partner();

grant select, insert, update on public.orix_incentives_partner_edit_view to authenticated;
revoke all on public.orix_incentives_partner_edit_view from anon;

-- 지급처는 tb_contractors.id가 아니라 이름을 그대로 노출한다(조용백은 tb_contractors 원본에
-- 접근 권한이 없지만, 뷰는 소유자 권한으로 조인을 수행하므로 이름 조회 자체는 문제없다).
create view public.orix_incentives_partner_view as
select
  oi.id, oi.confirmed_date, oi.customer_name, oi.loan_principal, oi.product_type, oi.vehicle_type,
  oi.incentive_rate, oi.incentive_total, oi.cm_incentive_rate, oi.cm_paid_incentive,
  oi.incentive_recipient,
  oi.paid_at, oi.actual_paid_amount, oi.payment_diff_note, oi.wire_receipt_path,
  c.name as paid_to_contractor_name,
  oi.created_at, oi.updated_at
from public.orix_incentives oi
left join public.tb_contractors c on c.id = oi.paid_to_contractor_id
where public.is_orix_admin() or public.is_orix_partner();

grant select on public.orix_incentives_partner_view to authenticated;
revoke all on public.orix_incentives_partner_view from anon;

-- 3) 송금증 스토리지: 조회(미리보기)는 admin+파트너 모두 허용, 업로드/수정/삭제는 admin만.
drop policy orix_wire_receipts_admin_all on storage.objects;

create policy orix_wire_receipts_select on storage.objects for select
  using (bucket_id = 'orix_wire_receipts' and (public.is_orix_admin() or public.is_orix_partner()));

create policy orix_wire_receipts_admin_insert on storage.objects for insert
  with check (bucket_id = 'orix_wire_receipts' and public.is_orix_admin());

create policy orix_wire_receipts_admin_update on storage.objects for update
  using (bucket_id = 'orix_wire_receipts' and public.is_orix_admin())
  with check (bucket_id = 'orix_wire_receipts' and public.is_orix_admin());

create policy orix_wire_receipts_admin_delete on storage.objects for delete
  using (bucket_id = 'orix_wire_receipts' and public.is_orix_admin());
