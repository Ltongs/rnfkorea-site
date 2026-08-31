-- RNF-2608-000056 건: 보험전담 계정(inhyang1004@hanmail.net)으로 제작증을
-- 첨부했는데 storage/DB 어디에도 저장되지 않은 문제 수정.
--
-- 근본 원인: lib/auth.tsx의 canCreate는 isInsuranceManager
-- (email === 'inhyang1004@hanmail.net')를 포함하므로 이 계정은 나르미 페이지에서
-- "제작증 첨부" 버튼을 정상적으로 볼 수 있다. is_internal_staff()
-- (security_hardening_20260712.sql)도 이 계정을 이미 내부 직원으로 인정한다.
-- 하지만 vehicle_docs 버킷의 storage RLS를 판별하는 narumi_app_role()
-- (20260827120000_fix_narumi_app_role_domain.sql)은 admin 3계정 +
-- @narmimotors.com/@lotte.net 도메인만 인식하고 inhyang1004@hanmail.net은
-- 빠져 있어 'none'을 반환했다. 그 결과 업로드 버튼은 보이지만 storage insert가
-- RLS에 막혀 조용히 실패했다(에러 alert는 뜨지만 흐름상 놓치기 쉬움).
--
-- is_internal_staff()와 동일하게 이 계정을 인정하도록 맞춘다. admin/narumi 역할은
-- narumi_tasks 연결 여부와 무관하게 vehicle_docs를 전부 볼 수 있으므로(select
-- policy), 보험전담 계정도 동일한 넓은 접근이 필요해 'narumi'로 매핑한다.

begin;

create or replace function public.narumi_app_role()
returns text language sql stable as $$
  select case
    when public.current_user_email() in ('admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'everyasset.fc@gmail.com') then 'admin'
    when public.current_user_email() = 'inhyang1004@hanmail.net' then 'narumi'
    when public.current_user_email() ilike '%@narmimotors.com' then 'narumi'
    when public.current_user_email() ilike '%@lotte.net' then 'lotte'
    else 'none'
  end
$$;

commit;
