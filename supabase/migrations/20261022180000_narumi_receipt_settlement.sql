-- 나르미: 관리자 전용 영수증 첨부 + 차량등록 비용 정산서 + 고객 문자 발송 기록
alter table narumi_tasks
  add column if not exists receipt_doc_path text,
  add column if not exists receipt_doc_uploaded_at timestamptz,
  add column if not exists settlement jsonb,
  add column if not exists customer_docs_sent_at timestamptz;

-- 영수증도 차량등록증과 같은 30일 보관 정책으로 실제 삭제한다.
create or replace function public.clear_expired_narumi_data()
returns void
language plpgsql
security definer
as $function$
declare
  rec record;
  masked_phone text;
begin
  perform set_config('storage.allow_delete_query', 'true', true);

  -- 1) 차량등록증 업로드 후 30일 지난 건 실제 삭제
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

  -- 1-2) 영수증 첨부 후 30일 지난 건 실제 삭제
  for rec in
    select id, receipt_doc_path
    from public.narumi_tasks
    where receipt_doc_path is not null
      and receipt_doc_uploaded_at is not null
      and receipt_doc_uploaded_at < now() - interval '30 days'
  loop
    delete from storage.objects
      where bucket_id = 'vehicle_docs' and name = rec.receipt_doc_path;
    update public.narumi_tasks
      set receipt_doc_path = null
      where id = rec.id;
  end loop;

  -- 2) 전화번호 입력 후 120시간(5일) 지난 건 뒷 4자리 마스킹
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
