-- 렌타나 계산기(/renthana) 기간을 12·36개월 → 12·24개월로 변경.
-- save_renthana_quote의 36개월 인자(p_fee36)를 24개월(p_fee24)로 바꾼다.
-- 인자 이름만 바뀌고 타입은 같아 create or replace로는 바꿀 수 없으므로 기존 함수를 지우고 다시 만든다.

begin;

drop function if exists public.save_renthana_quote(text, text, numeric, boolean, numeric, numeric);

create function public.save_renthana_quote(
  p_product    text,     -- '배터리' | '타이어'
  p_item_name  text,     -- 품목명 (선택)
  p_price      numeric,  -- 공급가격 (VAT 제외)
  p_show_price boolean,  -- 견적서에 공급가격 표시 여부
  p_fee12      numeric,  -- 12개월 월 렌탈료
  p_fee24      numeric   -- 24개월 월 렌탈료
)
returns table (quote_no text, quote_date date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no   text;
  v_date date := (now() at time zone 'Asia/Seoul')::date;
  v_name text := nullif(btrim(coalesce(p_item_name, '')), '');
begin
  if p_product not in ('배터리', '타이어') then
    raise exception 'invalid product';
  end if;
  if p_price is null or p_price <= 0 or p_price > 10000000000 then
    raise exception 'invalid price';
  end if;
  if length(coalesce(v_name, '')) > 100 then
    raise exception 'item name too long';
  end if;

  v_no := public.next_rnf_number();

  insert into public.tb_quotations (
    quote_type, quote_no, quote_date, recipient, items, notes,
    total_amount, vat_amount, grand_total, created_by
  ) values (
    'renthana', v_no, v_date,
    coalesce(v_name, p_product || ' 렌탈'),
    jsonb_build_array(jsonb_build_object(
      'name', coalesce(v_name, p_product), 'spec', p_product, 'qty', '1', 'price', p_price::text,
      'product', p_product, 'show_price', coalesce(p_show_price, true),
      'fee12', round(p_fee12), 'fee24', round(p_fee24)
    )),
    array[
      '12개월 월 렌탈료 ' || to_char(round(p_fee12), 'FM999,999,999,999') || '원',
      '24개월 월 렌탈료 ' || to_char(round(p_fee24), 'FM999,999,999,999') || '원',
      '공급가격 ' || case when coalesce(p_show_price, true) then '표시' else '가림' end
    ],
    p_price, round(p_price * 0.1), round(p_price * 1.1),
    coalesce(auth.email(), 'renthana-public')
  );

  return query select v_no, v_date;
end;
$$;

revoke all on function public.save_renthana_quote(text, text, numeric, boolean, numeric, numeric) from public;
grant execute on function public.save_renthana_quote(text, text, numeric, boolean, numeric, numeric) to anon, authenticated;

commit;
