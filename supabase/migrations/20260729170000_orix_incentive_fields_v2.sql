-- ORIX 인센티브 필드 2차 개편
--   품목 -> 상품구분(product_type, 할부/리스/기타 중 선택)
--   차종(vehicle_type) 신규 추가
--   CM인센티브율(cm_incentive_rate) 신규 추가 — CM지급인센티브가 인센티브율이 아닌 이 값에서 파생되도록 변경
--   공제금액 -> 실지급금액(actual_paid_amount)으로 명칭 변경
--   지급처(paid_to, 자유텍스트) -> paid_to_contractor_id로 변경, tb_contractors(수탁인 관리)와 연결.
--     등록된 수탁인이 아니면 애초에 선택할 수 없고, 지급일자를 입력하려면 수탁인 지정이 필수(체크 제약).
--   비고(payment_diff_note) 신규 추가 — 실지급금액이 CM지급인센티브와 다를 때 사유를 기록

-- 뷰가 기존 컬럼(item, incentive_total, cm_paid_incentive)에 의존하므로 먼저 제거
drop view public.orix_incentives_partner_view;

-- item(자유텍스트, 예: "목재파쇄기")은 이제 할부/리스/기타 분류로 의미가 바뀌므로,
-- 기존에 입력된 실제 장비명 데이터는 신규 차종(vehicle_type) 컬럼으로 옮겨서 보존한다.
alter table public.orix_incentives add column vehicle_type text;
update public.orix_incentives set vehicle_type = item where item is not null;
update public.orix_incentives set item = null;

alter table public.orix_incentives rename column item to product_type;
alter table public.orix_incentives
  add constraint orix_incentives_product_type_check
  check (product_type is null or product_type in ('할부','리스','기타'));

alter table public.orix_incentives add column cm_incentive_rate numeric;

-- CM지급인센티브: 이제 인센티브율이 아니라 별도의 CM인센티브율에서 파생 (3.3% 원천징수 공제는 유지)
alter table public.orix_incentives drop column cm_paid_incentive;
alter table public.orix_incentives
  add column cm_paid_incentive numeric
  generated always as (round(round(loan_principal * cm_incentive_rate / 100) * (1 - 0.033))) stored;

alter table public.orix_incentives rename column deduction_amount to actual_paid_amount;

alter table public.orix_incentives drop column paid_to;
alter table public.orix_incentives
  add column paid_to_contractor_id uuid references public.tb_contractors(id);

alter table public.orix_incentives add column payment_diff_note text;

-- 지급일자를 입력하려면 반드시 등록된 수탁인을 지정해야 한다 ("수탁인 등록이 되지 않은 사람은 지급할 수 없다")
alter table public.orix_incentives
  add constraint orix_incentives_paid_requires_contractor
  check (paid_at is null or paid_to_contractor_id is not null);

-- 파트너 뷰 재생성: 조용백이 입력하는 항목(상품구분/차종/CM인센티브율/CM지급인센티브 포함)
create view public.orix_incentives_partner_view as
select
  id, confirmed_date, customer_name, loan_principal, product_type, vehicle_type,
  incentive_rate, incentive_total, cm_incentive_rate, cm_paid_incentive,
  incentive_recipient, created_at, updated_at
from public.orix_incentives
where public.is_orix_admin() or public.is_orix_partner();

grant select, insert, update on public.orix_incentives_partner_view to authenticated;
revoke all on public.orix_incentives_partner_view from anon;

-- ── tb_contractors 최소 노출 뷰 (ORIX 지급처 선택용) ──
-- tb_contractors 원본 테이블은 주민번호(rrn_encrypted)/계좌번호 등 민감정보를 담고 있고
-- RLS가 admin@rnfkorea.co.kr, everyasset.fc@gmail.com만 허용하도록 이미 잠겨 있다(원천징수관리 페이지의
-- 기존 보안 경계이므로 이번 작업에서 건드리지 않음). ltongs7@gmail.com(isOrixAdmin)도 ORIX 지급처를
-- 고를 수 있어야 하므로, 이름만 노출하는 별도 뷰를 만들어 최소한의 정보만 연결한다.
create view public.orix_contractors_picker_view as
select id, name
from public.tb_contractors
where is_active = true
  and (public.is_orix_admin() or coalesce((auth.jwt()->>'email'), '') in ('admin@rnfkorea.co.kr','everyasset.fc@gmail.com'));

grant select on public.orix_contractors_picker_view to authenticated;
revoke all on public.orix_contractors_picker_view from anon;
