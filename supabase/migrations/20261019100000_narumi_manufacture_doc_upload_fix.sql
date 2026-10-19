-- 나르미(sales@narmimotors.com) 계정으로 신규 접수 시 제작증(PDF) 첨부가
-- "new row violates row-level security policy"로 실패하던 문제 수정.
--
-- 근본 원인 1: vehicle_docs 버킷의 storage.objects INSERT/UPDATE 정책이
--   narumi_app_role() = 'admin' 만 허용하고 있었다. 나르미 계정(및 'narumi'로
--   매핑된 보험전담 계정)은 접수(canCreate)와 제작증 첨부 버튼은 보이지만
--   실제 업로드가 막혔다. upload(..., { upsert: true })는 기존 파일이 있으면
--   UPDATE 정책도 통과해야 하므로 두 정책을 함께 연다.
--
-- 근본 원인 2: 업로드 뒤 프론트가 narumi_tasks.manufacture_doc_path를 직접
--   UPDATE 하는데, narumi_tasks UPDATE 정책은 admin/보험전담/NH캐피탈만 허용해
--   나르미 계정에서는 0건 반영(오류 없이 조용히 무시)된다.
--   나르미에게 narumi_tasks 전체 수정 권한을 주지 않도록, 제작증 경로만
--   기록하는 security definer 함수를 둔다.

begin;

alter policy vehicle_docs_insert_policy on storage.objects
  with check (
    bucket_id = 'vehicle_docs'
    and public.narumi_app_role() = any (array['admin', 'narumi'])
  );

alter policy vehicle_docs_update_policy on storage.objects
  using (
    bucket_id = 'vehicle_docs'
    and public.narumi_app_role() = any (array['admin', 'narumi'])
  )
  with check (
    bucket_id = 'vehicle_docs'
    and public.narumi_app_role() = any (array['admin', 'narumi'])
  );

create or replace function public.set_narumi_manufacture_doc_path(p_task_id bigint, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.narumi_app_role() not in ('admin', 'narumi') then
    raise exception '제작증 첨부 권한이 없습니다.';
  end if;

  -- 경로는 프론트 규칙("{id}/manufacture_certificate.{ext}")만 허용
  if p_path !~ ('^' || p_task_id::text || '/manufacture_certificate\.[A-Za-z0-9]+$') then
    raise exception '잘못된 제작증 경로입니다.';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'vehicle_docs' and name = p_path
  ) then
    raise exception '업로드된 제작증 파일을 찾을 수 없습니다.';
  end if;

  update public.narumi_tasks
    set manufacture_doc_path = p_path
    where id = p_task_id;

  if not found then
    raise exception '해당 접수 건을 찾을 수 없습니다.';
  end if;
end;
$$;

revoke all on function public.set_narumi_manufacture_doc_path(bigint, text) from public, anon;
grant execute on function public.set_narumi_manufacture_doc_path(bigint, text) to authenticated;

commit;
