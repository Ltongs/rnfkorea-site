-- ORIX 인센티브 항목에 수익자(beneficiary) 구분 추가: 수Company / 이동수
--   각 인센티브 건이 수Company(제휴사 명의) 몫인지 이동수(대표 개인) 몫인지 구분해서,
--   원천징수관리(수Company) 화면에 신설하는 "지급대상" 탭에서 수Company분만 그대로
--   보여줄 수 있도록 한다. admin/파트너 모두 입력 가능한 영업 항목이므로 note와 동일하게
--   두 뷰(edit/view) 모두에 포함한다.

alter table public.orix_incentives add column beneficiary text;
alter table public.orix_incentives
  add constraint orix_incentives_beneficiary_check
  check (beneficiary is null or beneficiary in ('수Company','이동수'));

drop view public.orix_incentives_partner_view;
drop view public.orix_incentives_partner_edit_view;

create view public.orix_incentives_partner_edit_view as
select
  id, confirmed_date, customer_name, loan_principal, product_type, vehicle_type,
  incentive_rate, incentive_total, cm_incentive_rate, cm_paid_incentive, note,
  incentive_recipient_contractor_id, incentive_recipient_pending, beneficiary,
  created_at, updated_at
from public.orix_incentives
where public.is_orix_admin() or public.is_orix_partner();

grant select, insert, update on public.orix_incentives_partner_edit_view to authenticated;
revoke all on public.orix_incentives_partner_edit_view from anon;

create view public.orix_incentives_partner_view as
select
  oi.id, oi.confirmed_date, oi.customer_name, oi.loan_principal, oi.product_type, oi.vehicle_type,
  oi.incentive_rate, oi.incentive_total, oi.cm_incentive_rate, oi.cm_paid_incentive, oi.note,
  oi.incentive_recipient_contractor_id, oi.incentive_recipient_pending, oi.beneficiary,
  oi.received_from_orix_at,
  oi.paid_at, oi.actual_paid_amount, oi.payment_diff_note, oi.wire_receipt_path,
  c.name as paid_to_contractor_name,
  oi.created_at, oi.updated_at
from public.orix_incentives oi
left join public.tb_contractors c on c.id = oi.paid_to_contractor_id
where public.is_orix_admin() or public.is_orix_partner();

grant select on public.orix_incentives_partner_view to authenticated;
revoke all on public.orix_incentives_partner_view from anon;

-- 원천징수관리(WithholdingPage) 수Company 화면 "지급대상" 탭에서 읽기전용으로 노출할
-- 최소 컬럼 뷰. tb_withholding_payments/tb_contractors와 동일하게 admin/ltongs7/everyasset.fc만
-- 접근 가능 — ORIX 파트너 전용 화면(is_orix_admin/is_orix_partner)과는 별개의 접근 경계다.
create view public.orix_incentives_sucompany_view as
select
  id, confirmed_date, customer_name, loan_principal, product_type, vehicle_type,
  incentive_rate, incentive_total, cm_incentive_rate, cm_paid_incentive, paid_at, note
from public.orix_incentives
where beneficiary = '수Company'
  and auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com']);

grant select on public.orix_incentives_sucompany_view to authenticated;
revoke all on public.orix_incentives_sucompany_view from anon;
