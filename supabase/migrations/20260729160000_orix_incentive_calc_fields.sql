-- ORIX 인센티브 필드 개편:
--   확정금액 -> 대출원금(loan_principal)으로 명칭/컬럼 변경
--   인센티브율(incentive_rate, %) 신규 추가 — 조용백이 직접 입력
--   인센티브 총액(incentive_total)은 더 이상 수동 입력이 아니라 "대출원금 × 인센티브율 / 100"으로
--     항상 자동 계산되도록 GENERATED 컬럼으로 전환 (앱 코드가 잘못 계산해서 저장하는 사고를 원천 차단)
--   CM지급 인센티브(cm_paid_incentive) 신규 추가 — "인센티브 총액에서 3.3%(사업소득 원천징수) 추가
--     공제한 금액"으로 자동 계산되는 GENERATED 컬럼. ("CM"은 특별한 의미 없는 구분용 이름)
--   두 컬럼 모두 조용백(ORIX 파트너)에게도 보여야 하는 항목이므로 파트너 뷰에도 포함한다.
--
-- Postgres GENERATED 컬럼은 다른 GENERATED 컬럼을 참조할 수 없으므로, cm_paid_incentive는
-- incentive_total을 참조하지 않고 (loan_principal × incentive_rate / 100) 계산을 그대로 다시 적어
-- 3.3%를 추가로 공제하는 형태로 정의한다 — 두 컬럼은 항상 같은 대출원금/인센티브율에서 도출되므로
-- 결과적으로 일치한다.

-- 뷰가 incentive_total 컬럼에 의존하고 있어, 컬럼을 바꾸기 전에 먼저 뷰부터 제거한다.
drop view public.orix_incentives_partner_view;

alter table public.orix_incentives rename column confirmed_amount to loan_principal;

alter table public.orix_incentives add column incentive_rate numeric;

alter table public.orix_incentives drop column incentive_total;
alter table public.orix_incentives
  add column incentive_total numeric
  generated always as (round(loan_principal * incentive_rate / 100)) stored;

alter table public.orix_incentives
  add column cm_paid_incentive numeric
  generated always as (round(round(loan_principal * incentive_rate / 100) * (1 - 0.033))) stored;

create view public.orix_incentives_partner_view as
select
  id, confirmed_date, customer_name, loan_principal, item,
  incentive_rate, incentive_total, cm_paid_incentive, incentive_recipient,
  created_at, updated_at
from public.orix_incentives
where public.is_orix_admin() or public.is_orix_partner();

grant select, insert, update on public.orix_incentives_partner_view to authenticated;
revoke all on public.orix_incentives_partner_view from anon;
