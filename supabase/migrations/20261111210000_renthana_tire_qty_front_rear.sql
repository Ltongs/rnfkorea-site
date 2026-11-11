-- 렌타나 타이어렌탈: 타이어 수량을 전륜·후륜으로 나눠 기록한다.
-- 기존 tire_qty는 더 이상 쓰지 않는다(이미 열려 있던 화면에서 저장할 때 오류가 나지 않도록 칼럼은 남겨둠).

begin;

alter table public.renthana_rental_cases
  add column if not exists tire_qty_front integer,
  add column if not exists tire_qty_rear  integer;

comment on column public.renthana_rental_cases.tire_qty       is '사용 안 함 — tire_qty_front / tire_qty_rear로 대체(2026-11-11)';
comment on column public.renthana_rental_cases.tire_qty_front is '전륜 타이어 수량(본)';
comment on column public.renthana_rental_cases.tire_qty_rear  is '후륜 타이어 수량(본)';

-- 렌타나 담당자가 고칠 수 없는 칸에 전·후 수량 추가
create or replace function public.renthana_partner_column_guard()
returns trigger
language plpgsql
as $$
begin
  if public.is_renthana_partner() and not public.is_admin_level() then
    if (NEW.customer_name, NEW.customer_phone, NEW.company_name, NEW.biz_no, NEW.vehicle_no, NEW.vehicle_model,
        NEW.quote_no, NEW.tire_spec, NEW.tire_qty, NEW.tire_qty_front, NEW.tire_qty_rear,
        NEW.supply_price, NEW.rental_months, NEW.monthly_fee,
        NEW.install_shop, NEW.install_date, NEW.special_note, NEW.case_no, NEW.created_by)
       is distinct from
       (OLD.customer_name, OLD.customer_phone, OLD.company_name, OLD.biz_no, OLD.vehicle_no, OLD.vehicle_model,
        OLD.quote_no, OLD.tire_spec, OLD.tire_qty, OLD.tire_qty_front, OLD.tire_qty_rear,
        OLD.supply_price, OLD.rental_months, OLD.monthly_fee,
        OLD.install_shop, OLD.install_date, OLD.special_note, OLD.case_no, OLD.created_by) then
      raise exception '렌타나 담당자는 고객정보·견적 내용을 수정할 수 없습니다. RNF에 요청해주세요.';
    end if;
  end if;
  return NEW;
end;
$$;

commit;
