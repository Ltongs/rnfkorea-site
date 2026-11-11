-- 렌타나 타이어렌탈: 설치확인서 팩스는 렌타나가 아니라 장착점으로 보낸다. 장착점마다 번호가 달라 케이스별로 저장한다.

begin;

alter table public.renthana_rental_cases
  add column if not exists install_shop_fax text;

comment on column public.renthana_rental_cases.install_shop_fax is '장착점 팩스번호 — 설치확인서 팩스 발송 대상(send-renthana-fax)';

-- 렌타나 담당자가 고칠 수 없는 칸에 장착점 팩스 추가
create or replace function public.renthana_partner_column_guard()
returns trigger
language plpgsql
as $$
begin
  if public.is_renthana_partner() and not public.is_admin_level() then
    if (NEW.customer_name, NEW.customer_phone, NEW.company_name, NEW.biz_no, NEW.vehicle_no, NEW.vehicle_model,
        NEW.quote_no, NEW.tire_spec, NEW.tire_qty, NEW.tire_qty_front, NEW.tire_qty_rear,
        NEW.supply_price, NEW.rental_months, NEW.monthly_fee,
        NEW.install_shop, NEW.install_shop_fax, NEW.install_date, NEW.special_note, NEW.case_no, NEW.created_by)
       is distinct from
       (OLD.customer_name, OLD.customer_phone, OLD.company_name, OLD.biz_no, OLD.vehicle_no, OLD.vehicle_model,
        OLD.quote_no, OLD.tire_spec, OLD.tire_qty, OLD.tire_qty_front, OLD.tire_qty_rear,
        OLD.supply_price, OLD.rental_months, OLD.monthly_fee,
        OLD.install_shop, OLD.install_shop_fax, OLD.install_date, OLD.special_note, OLD.case_no, OLD.created_by) then
      raise exception '렌타나 담당자는 고객정보·견적 내용을 수정할 수 없습니다. RNF에 요청해주세요.';
    end if;
  end if;
  return NEW;
end;
$$;

commit;
