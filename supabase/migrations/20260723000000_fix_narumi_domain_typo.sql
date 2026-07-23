-- narumi_tasks_select_narumi / narumi_tasks_insert_narumi 정책에
-- 도메인 오타가 있었음: '%@narminotors.com' (오타) → '%@narmimotors.com' (실제 도메인)
-- lib/auth.tsx의 isNarumi = email.endsWith("@narmimotors.com")와 불일치했던 부분을 바로잡는다.
-- sales@narmimotors.com은 narumi_app_role()로 별도 커버되어 지금까지 드러나지 않았지만,
-- 그 외 @narmimotors.com 계정은 이 두 정책으로 전혀 매치되지 않는 상태였다.

begin;

alter policy narumi_tasks_select_narumi on public.narumi_tasks
  using ((auth.jwt() ->> 'email') ~~* '%@narmimotors.com');

alter policy narumi_tasks_insert_narumi on public.narumi_tasks
  with check ((auth.jwt() ->> 'email') ~~* '%@narmimotors.com');

commit;
