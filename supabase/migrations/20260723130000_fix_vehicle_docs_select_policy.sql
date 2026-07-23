-- 나르미 차량등록증 업로드가 admin 계정에서도 "new row violates row-level
-- security policy for table objects"로 매번 실패하던 문제 수정.
--
-- 근본 원인: Supabase Storage의 upload()는 내부적으로
--   INSERT INTO storage.objects (...) VALUES (...)
--   ON CONFLICT (name, bucket_id) DO UPDATE SET ...
--   RETURNING *
-- 형태로 실행되는데, RETURNING * 이 있으면 Postgres RLS는 INSERT/UPDATE의
-- WITH CHECK뿐 아니라 SELECT 정책도 함께 통과해야 한다.
--
-- 기존 vehicle_docs_select_policy는 narumi_tasks.vehicle_doc_path가 이미
-- 이 파일 경로로 등록돼 있어야 SELECT를 허용했는데, 프론트엔드 코드는
-- "① 스토리지 업로드 → ② narumi_tasks.vehicle_doc_path 업데이트" 순서로
-- 동작하므로 ①시점에는 아직 ②가 반영되지 않아 SELECT가 항상 실패하고,
-- 그 결과 INSERT 자체가 통째로 막히는 선후관계 버그였다.
--
-- admin/narumi 역할은 narumi_tasks_select_policy로 이미 모든 건을 볼 수
-- 있으므로, 이 두 역할에 한해 narumi_tasks 연결 조건 없이 SELECT를 허용해
-- 순환 의존을 끊는다. lotte 역할은 기존처럼 자신의 오토리스 건에만
-- 연결된 파일을 보도록 조건을 유지한다.

begin;

alter policy vehicle_docs_select_policy on storage.objects
  using (
    (bucket_id = 'vehicle_docs'::text)
    and (
      (narumi_app_role() = any (array['admin'::text, 'narumi'::text]))
      or (
        (narumi_app_role() = 'lotte'::text)
        and exists (
          select 1 from narumi_tasks t
          where t.vehicle_doc_path = objects.name and t.is_lotte_autolease = true
        )
      )
    )
  );

commit;
