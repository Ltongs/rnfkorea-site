-- 인센티브(ORIX·롯데) 관리 권한에 everyasset.fc@gmail.com 추가 (2026-10-15)
-- is_orix_admin()을 쓰는 orix_incentives 정책, 송금증(storage orix_wire_receipts) 정책,
-- orix_incentives_partner_view / partner_edit_view / orix_contractors_picker_view 가 함께 적용된다.
-- (롯데 tb_lotte_lease_incentives, tb_contractors, tb_withholding_payments 는 이미 이 계정을 허용)
-- 화면 쪽은 lib/auth.tsx isOrixAdmin 과 같은 목록을 유지한다.
create or replace function public.is_orix_admin()
 returns boolean
 language sql
 stable
as $function$
  select coalesce((auth.jwt()->>'email'), '') in ('admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com');
$function$;
