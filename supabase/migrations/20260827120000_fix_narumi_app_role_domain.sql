-- 나르미 제작증/보험증권 첨부가 "new row violates row-level security policy"로
-- 실패하던 문제 수정.
--
-- 근본 원인: 나르미 페이지 접근 권한(lib/auth.tsx의 isNarumi = email.endsWith
-- ("@narmimotors.com"), RouteGuard의 canViewAll)은 @narmimotors.com 도메인 전체를
-- 허용하는데, storage.objects(vehicle_docs 버킷) RLS를 판별하는 narumi_app_role()은
-- 'sales@narmimotors.com' 단 하나의 계정만 'narumi'로, 'youngjin.heo@lotte.net' 단
-- 하나만 'lotte'로 인식했다(20260718090000_everyasset_full_admin.sql).
-- 그 결과 같은 도메인의 다른 계정(예: 김규선)은 페이지 접근/파일 선택은 되지만
-- narumi_app_role()이 'none'을 반환해 vehicle_docs 버킷 insert/select 정책을
-- 통과하지 못하고 막혔다.
--
-- is_internal_staff()(security_hardening_20260712.sql)와 fix_narumi_domain_typo.sql은
-- 이미 같은 이유로 도메인 와일드카드(@narmimotors.com, @lotte.net)로 맞춰져 있으므로,
-- narumi_app_role()도 동일한 기준으로 통일한다.

begin;

create or replace function public.narumi_app_role()
returns text language sql stable as $$
  select case
    when public.current_user_email() in ('admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'everyasset.fc@gmail.com') then 'admin'
    when public.current_user_email() ilike '%@narmimotors.com' then 'narumi'
    when public.current_user_email() ilike '%@lotte.net' then 'lotte'
    else 'none'
  end
$$;

commit;
