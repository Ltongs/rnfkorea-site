-- 나르미 "보험" 버튼: 클릭 → "당사에서 가입하나요?" 확인 → Y/N 응답 시
-- narumi_tasks.has_insurance를 true로 업데이트해 버튼을 비활성화해야 한다.
--
-- 프론트(lib/auth.tsx canChangeStatus)는 admin 외에도 보험전담(inhyang1004@hanmail.net),
-- NH캐피탈(allbar7555@naver.com), NH캐피탈 직원(ehddhks1115@nhcapital.co.kr) 계정에
-- 상태 변경 버튼을 노출하고 있었지만, narumi_tasks의 UPDATE RLS 정책은 admin
-- (narumi_app_role()='admin' 또는 admin@rnfkorea.co.kr/everyasset.fc@gmail.com)만
-- 허용하고 있어 이 세 계정은 버튼을 눌러도 DB update가 조용히 막혔다(Y 경로는
-- 에러를 콘솔에만 찍고 삼켜서 화면에는 아무 표시도 없이 has_insurance가 갱신되지
-- 않는 채로 남았음). canChangeStatus와 동일한 대상으로 UPDATE 정책을 확장한다.

begin;

create policy narumi_tasks_update_insurance_nhcapital
  on public.narumi_tasks
  for update
  using ((auth.jwt() ->> 'email') = any (array['inhyang1004@hanmail.net', 'allbar7555@naver.com', 'ehddhks1115@nhcapital.co.kr']))
  with check ((auth.jwt() ->> 'email') = any (array['inhyang1004@hanmail.net', 'allbar7555@naver.com', 'ehddhks1115@nhcapital.co.kr']));

commit;
