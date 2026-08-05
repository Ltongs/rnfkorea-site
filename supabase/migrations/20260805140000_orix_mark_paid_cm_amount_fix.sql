-- 버그 수정: mark_orix_incentive_paid()가 지급내역(tb_withholding_payments)을 등록할 때
-- CM지급 인센티브(cm_paid_incentive)가 아니라 인센티브 총액(incentive_total)을 기준으로
-- 금액을 계산하고 있었다. "미지급→지급완료" 클릭 시 실제로 수탁인에게 지급되는 금액은
-- 화면에 표시되는 CM지급 인센티브이므로, 그 금액을 기준으로 지급내역이 등록되어야 한다.
--
-- cm_paid_incentive(순액)는 이미 "round(round(loan_principal*cm_incentive_rate/100)*(1-0.033))"로
-- 3.3% 원천징수가 반영된 값이라, 원천징수 전 총액(pay_amount)을 같은 산식으로 재계산해
-- withholding_amount = 총액 - 순액으로 역산한다. 이렇게 해야 net_amount가 화면의
-- "CM지급 인센티브"와 항상 정확히 일치한다.
create or replace function public.mark_orix_incentive_paid(p_incentive_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_row public.orix_incentives%rowtype;
  v_cm_gross numeric;
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
  if v_row.cm_paid_incentive is null then
    raise exception 'CM지급 인센티브가 계산되지 않았습니다.';
  end if;

  v_cm_gross := round(v_row.loan_principal * v_row.cm_incentive_rate / 100);
  v_withholding := v_cm_gross - v_row.cm_paid_incentive;

  insert into public.tb_withholding_payments (
    contractor_id, pay_date, pay_amount, withholding_amount, net_amount,
    pay_reason, pay_method, transfer_ref, gift_card_included, note
  ) values (
    v_row.incentive_recipient_contractor_id,
    current_date,
    v_cm_gross,
    v_withholding,
    v_row.cm_paid_incentive,
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

-- 데이터 정정: 위 버그로 이미 잘못 등록된 지급내역 2건을 CM지급 인센티브 기준 금액으로 바로잡는다.
update public.tb_withholding_payments
set pay_amount = 203000, withholding_amount = 6699, net_amount = 196301
where id = '1aad54c6-86b7-4e9a-800e-c65d8a496c5d';

update public.tb_withholding_payments
set pay_amount = 2600000, withholding_amount = 85800, net_amount = 2514200
where id = '1a05ed43-40a5-446c-a535-5b3679f87207';
