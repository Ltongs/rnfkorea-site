-- 나르미 업무: 차량등록증 실제 자동삭제 + 고객 전화번호 뒷4자리 마스킹(파기)
-- 기존엔 HIDE_UPLOADED_AFTER_DAYS_FOR_NON_ADMIN(30일)이 "목록에서 숨기기"만 하고 실제 파일은
-- 영구 보관됐고, DB_SCRUB_AFTER_HOURS(120시간)는 화면 안내 문구만 있고 실제 파기 로직이 없었음.
-- 현대건설기계의 clear_expired_hcm_data()와 동일한 패턴(Postgres 함수 + pg_cron)으로 실제 구현.

alter table narumi_tasks
  add column if not exists vehicle_doc_uploaded_at timestamptz;

create or replace function public.clear_expired_narumi_data()
returns void
language plpgsql
security definer
as $function$
declare
  rec record;
  masked_phone text;
begin
  -- 1) 차량등록증 업로드 후 30일 지난 건 실제 삭제 (기존엔 목록에서 숨기기만 했음)
  for rec in
    select id, vehicle_doc_path
    from public.narumi_tasks
    where vehicle_doc_path is not null
      and vehicle_doc_uploaded_at is not null
      and vehicle_doc_uploaded_at < now() - interval '30 days'
  loop
    delete from storage.objects
      where bucket_id = 'vehicle_docs' and name = rec.vehicle_doc_path;
    update public.narumi_tasks
      set vehicle_doc_path = null
      where id = rec.id;
  end loop;

  -- 2) 전화번호 입력 후 120시간(5일) 지난 건 뒷 4자리 마스킹 (화면 안내 문구에 이미 약속된 정책)
  for rec in
    select id, customer_phone
    from public.narumi_tasks
    where customer_phone is not null
      and customer_phone_scrubbed_at is null
      and customer_phone_set_at is not null
      and customer_phone_set_at < now() - interval '120 hours'
  loop
    masked_phone := regexp_replace(
      regexp_replace(rec.customer_phone, '[^0-9]', '', 'g'),
      '(\d+)(\d{4})$', '\1****'
    );
    update public.narumi_tasks
      set customer_phone = masked_phone,
          customer_phone_scrubbed_at = now()
      where id = rec.id;
  end loop;
end;
$function$;

select cron.schedule(
  'clear-narumi-data-hourly',
  '0 * * * *',
  $$select public.clear_expired_narumi_data();$$
);

-- 덤으로 발견한 버그: 세금계산서(tax-invoices) 버킷은 "72시간 뒤 자동 삭제"라고 안내하지만
-- cleanup-tax-invoices 엣지함수를 호출하는 cron이 아예 등록되어 있지 않아 실제로는 삭제된 적이 없었음.
select cron.schedule(
  'cleanup-tax-invoices-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/cleanup-tax-invoices',
    body   := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    )
  );
  $$
);
