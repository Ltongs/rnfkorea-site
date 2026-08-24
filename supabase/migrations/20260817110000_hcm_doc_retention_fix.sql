-- 현대건기 경기북부(HCM) 화면의 "차량등록증" / "세금계산서" 첨부파일은
-- "업로드 후 72시간 뒤 자동삭제"라고 안내하지만, 기존 cleanup-vehicle-reg-docs /
-- cleanup-tax-invoices 엣지함수가 스토리지 삭제와 DB 레코드 삭제를 원자적이지 않은
-- 별개의 네트워크 호출 2번으로 처리하고 있었다. 스토리지 오브젝트가 먼저 지워진 뒤
-- (다른 원인으로든, 혹은 이 함수의 이전 실행에서든) DB 레코드 삭제가 실패하면, 다음
-- 실행에서도 storage.remove()가 이미 없는 오브젝트에 대해 에러를 반환해 함수가 그대로
-- 중단되고 DB 레코드는 영영 정리되지 않는다. 그 결과 목록에는 파일이 계속 보이지만
-- 실제로는 존재하지 않아 다운로드 시 "Object not found" 에러가 발생한다.
-- (태산통운 clear_expired_taesan_* 함수와 동일하게) 스토리지 삭제 + DB 삭제를 하나의
-- Postgres 함수(SQL DELETE는 대상이 없어도 에러 없이 0건 처리됨) 안에서 실제 실행한다.
--
-- 추가로 발견한 버그: storage.objects에는 고아 파일 방지용 protect_delete 트리거가 걸려 있어
-- storage.allow_delete_query 세션 설정 없이는 직접 DELETE가 항상 예외로 막힌다. 이 마이그레이션의
-- 함수뿐 아니라 clear_expired_hcm_data/clear_expired_hcm_docs/clear_expired_narumi_data/
-- clear_expired_taesan_* 등 기존 함수들도 전부 같은 이유로 크론이 돌 때마다 조용히 실패하고
-- 있었다. 이 파일에서는 새로 만드는 두 함수에 대해, 뒤이은 마이그레이션에서 나머지 기존
-- 함수들에 대해 set_config('storage.allow_delete_query', 'true', true)를 추가해 해결한다.

create or replace function public.clear_expired_hcm_vehicle_reg_docs()
returns void
language plpgsql
security definer
as $function$
declare
  rec record;
begin
  -- storage.objects는 고아 파일 방지용 protect_delete 트리거가 직접 DELETE를 막고 있어
  -- 이 세션(트랜잭션 한정)에서만 명시적으로 허용해야 한다.
  perform set_config('storage.allow_delete_query', 'true', true);

  for rec in
    select id, storage_path
    from public.vehicle_reg_doc_uploads
    where uploaded_at < now() - interval '72 hours'
  loop
    delete from storage.objects
      where bucket_id = 'vehicle-reg-docs' and name = rec.storage_path;
    delete from public.vehicle_reg_doc_uploads where id = rec.id;
  end loop;
end;
$function$;

create or replace function public.clear_expired_hcm_tax_invoices()
returns void
language plpgsql
security definer
as $function$
declare
  rec record;
begin
  perform set_config('storage.allow_delete_query', 'true', true);

  for rec in
    select id, storage_path
    from public.tax_invoice_uploads
    where uploaded_at < now() - interval '72 hours'
  loop
    delete from storage.objects
      where bucket_id = 'tax-invoices' and name = rec.storage_path;
    delete from public.tax_invoice_uploads where id = rec.id;
  end loop;
end;
$function$;

-- 엣지함수(net.http_post) 경유 크론이 이미 등록돼 있었다면 내려서, 위 함수를
-- 직접 호출하는 크론으로 대체한다 (네트워크 왕복/인증 헤더 등 실패 지점을 없앤다).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-tax-invoices-hourly') then
    perform cron.unschedule('cleanup-tax-invoices-hourly');
  end if;
  if exists (select 1 from cron.job where jobname = 'cleanup-vehicle-reg-docs-hourly') then
    perform cron.unschedule('cleanup-vehicle-reg-docs-hourly');
  end if;
  if exists (select 1 from cron.job where jobname = 'clear-hcm-tax-invoices-hourly') then
    perform cron.unschedule('clear-hcm-tax-invoices-hourly');
  end if;
  if exists (select 1 from cron.job where jobname = 'clear-hcm-vehicle-reg-docs-hourly') then
    perform cron.unschedule('clear-hcm-vehicle-reg-docs-hourly');
  end if;
end $$;

select cron.schedule(
  'clear-hcm-vehicle-reg-docs-hourly',
  '0 * * * *',
  $$select public.clear_expired_hcm_vehicle_reg_docs();$$
);
select cron.schedule(
  'clear-hcm-tax-invoices-hourly',
  '0 * * * *',
  $$select public.clear_expired_hcm_tax_invoices();$$
);

-- 이미 스토리지 오브젝트는 사라졌지만 DB 레코드만 남아 있던 기존 건들
-- (예: 농협 담당자가 "Object not found"로 겪은 IMG_2630.png)을 즉시 정리한다.
select public.clear_expired_hcm_vehicle_reg_docs();
select public.clear_expired_hcm_tax_invoices();
