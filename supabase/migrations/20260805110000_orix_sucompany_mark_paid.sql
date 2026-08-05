-- 원천징수관리(WithholdingPage) 수Company > 지급대상 탭에서 "미지급" 배지를 클릭하면
-- 1) 해당 오릭스 인센티브를 지급완료로 표시하고, 2) 지급대상(수탁인)에게 실제 지급한
-- 것으로 원천징수관리 지급내역(tb_withholding_payments)에 자동 등록되도록 한다.
--
-- 두 테이블에 걸친 쓰기(지급내역 insert + orix_incentives.paid_at 갱신)를 클라이언트에서
-- 순차 REST 호출 두 번으로 처리하면 중간에 실패했을 때 상태가 어긋날 수 있으므로
-- (예: 지급내역은 등록됐는데 오릭스 쪽은 미지급으로 남아 재클릭 시 중복 등록되는 사고),
-- 하나의 SECURITY DEFINER 함수 안에서 원자적으로 처리한다.

-- 읽기 뷰에 지급대상(수탁인) 정보 노출 — 지급 처리 가능 여부 판단 및 화면 표시용.
drop view public.orix_incentives_sucompany_view;

create view public.orix_incentives_sucompany_view as
select
  oi.id, oi.confirmed_date, oi.customer_name, oi.loan_principal, oi.product_type, oi.vehicle_type,
  oi.incentive_rate, oi.incentive_total, oi.cm_incentive_rate, oi.cm_paid_incentive, oi.paid_at, oi.note,
  oi.incentive_recipient_contractor_id, oi.incentive_recipient_pending,
  c.name as recipient_name
from public.orix_incentives oi
left join public.tb_contractors c on c.id = oi.incentive_recipient_contractor_id
where oi.beneficiary = '수Company'
  and auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com']);

grant select on public.orix_incentives_sucompany_view to authenticated;
revoke all on public.orix_incentives_sucompany_view from anon;

create or replace function public.mark_orix_incentive_paid(p_incentive_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_row public.orix_incentives%rowtype;
  v_withholding numeric;
begin
  if coalesce((auth.jwt()->>'email'), '') <> all (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com']) then
    raise exception '권한이 없습니다.';
  end if;

  select * into v_row from public.orix_incentives where id = p_incentive_id for update;
  if not found then
    raise exception '인센티브 항목을 찾을 수 없습니다.';
  end if;
  if v_row.beneficiary is distinct from '수Company' then
    raise exception '수Company 수익자 항목만 처리할 수 있습니다.';
  end if;
  if v_row.paid_at is not null then
    raise exception '이미 지급 처리된 항목입니다.';
  end if;
  if v_row.incentive_recipient_pending or v_row.incentive_recipient_contractor_id is null then
    raise exception '지급대상(수탁인)이 지정되지 않았습니다. 오릭스 인센티브 관리 화면에서 먼저 지정해주세요.';
  end if;
  if v_row.incentive_total is null then
    raise exception '인센티브 총액이 계산되지 않았습니다.';
  end if;

  v_withholding := floor(v_row.incentive_total * 0.033);

  insert into public.tb_withholding_payments (
    contractor_id, pay_date, pay_amount, withholding_amount, net_amount,
    pay_reason, pay_method, transfer_ref, gift_card_included, note
  ) values (
    v_row.incentive_recipient_contractor_id,
    current_date,
    v_row.incentive_total,
    v_withholding,
    v_row.incentive_total - v_withholding,
    '업무위탁 인센티브',
    '계좌이체',
    '',
    false,
    '오릭스 인센티브 자동등록 (고객: ' || v_row.customer_name || ')'
  );

  update public.orix_incentives
  set paid_at = current_date,
      paid_to_contractor_id = v_row.incentive_recipient_contractor_id
  where id = p_incentive_id;
end;
$function$;

revoke all on function public.mark_orix_incentive_paid(uuid) from public;
grant execute on function public.mark_orix_incentive_paid(uuid) to authenticated;
