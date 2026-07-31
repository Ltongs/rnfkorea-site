-- ORIX 인센티브 "지급대상(수령자)" 필드를 수탁인 관리(tb_contractors)와 연결
--   기존엔 자유텍스트(incentive_recipient)라 등록되지 않은 이름을 아무렇게나 입력할 수
--   있었고, 관리자 전용 지급처(paid_to_contractor_id)와도 전혀 매칭이 보장되지 않았다.
--   paid_to_contractor_id와 동일한 방식으로 FK로 전환해 등록된 수탁인 중에서만
--   선택하도록 한다("수탁인 등록이 되지 않은 사람은 지급대상으로 지정할 수 없다").

-- 뷰가 기존 컬럼(incentive_recipient)에 의존하므로 컬럼 변경 전에 먼저 제거
drop view public.orix_incentives_partner_edit_view;
drop view public.orix_incentives_partner_view;

alter table public.orix_incentives
  add column incentive_recipient_contractor_id uuid references public.tb_contractors(id);

-- 기존 자유텍스트 값이 수탁인 이름과 정확히 일치하는 경우 best-effort로 자동 연결
update public.orix_incentives oi
set incentive_recipient_contractor_id = c.id
from public.tb_contractors c
where oi.incentive_recipient = c.name;

alter table public.orix_incentives drop column incentive_recipient;

create view public.orix_incentives_partner_edit_view as
select
  id, confirmed_date, customer_name, loan_principal, product_type, vehicle_type,
  incentive_rate, incentive_total, cm_incentive_rate, cm_paid_incentive,
  incentive_recipient_contractor_id, created_at, updated_at
from public.orix_incentives
where public.is_orix_admin() or public.is_orix_partner();

grant select, insert, update on public.orix_incentives_partner_edit_view to authenticated;
revoke all on public.orix_incentives_partner_edit_view from anon;

create view public.orix_incentives_partner_view as
select
  oi.id, oi.confirmed_date, oi.customer_name, oi.loan_principal, oi.product_type, oi.vehicle_type,
  oi.incentive_rate, oi.incentive_total, oi.cm_incentive_rate, oi.cm_paid_incentive,
  oi.incentive_recipient_contractor_id,
  oi.paid_at, oi.actual_paid_amount, oi.payment_diff_note, oi.wire_receipt_path,
  c.name as paid_to_contractor_name,
  oi.created_at, oi.updated_at
from public.orix_incentives oi
left join public.tb_contractors c on c.id = oi.paid_to_contractor_id
where public.is_orix_admin() or public.is_orix_partner();

grant select on public.orix_incentives_partner_view to authenticated;
revoke all on public.orix_incentives_partner_view from anon;

-- 지급대상 선택 드롭다운도 조용백(파트너)이 써야 하므로 피커 뷰 접근을 확대한다.
-- (id/name만 노출하는 최소 정보 뷰이므로 파트너에게 열어도 안전)
-- 기존 허용 대상(admin/ltongs7/everyasset.fc)은 그대로 두고 is_orix_partner()만 추가한다.
drop view public.orix_contractors_picker_view;

create view public.orix_contractors_picker_view as
select id, name
from public.tb_contractors
where is_active = true
  and (
    public.is_orix_admin()
    or public.is_orix_partner()
    or coalesce((auth.jwt()->>'email'), '') in ('admin@rnfkorea.co.kr','everyasset.fc@gmail.com')
  );

grant select on public.orix_contractors_picker_view to authenticated;
revoke all on public.orix_contractors_picker_view from anon;
