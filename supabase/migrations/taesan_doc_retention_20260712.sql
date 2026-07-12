-- 태산통운 업무 화면은 이미 "확정 후 24시간 뒤 첨부서류 삭제·전화번호 마스킹",
-- "업로드 후 72시간 뒤 자동삭제"라고 안내하고 있고(DOC_DELETE_AFTER_HOURS/PHONE_MASK_AFTER_HOURS=24,
-- taesan_tasks.phone_scrubbed_at 컬럼도 이미 존재), 화면 카운트다운까지 표시하지만
-- 실제로 이를 수행하는 함수/크론이 전혀 없어 안내와 달리 아무것도 삭제되지 않고 있었다.
-- 이미 정상 동작 중인 현대건설기계(clear_expired_hcm_data 등)와 동일한 패턴으로 실제 구현한다.

-- 1) taesan_tasks 기본서류 5종(신분증/재직증명/소득증빙/견적서/굴삭기조종면허증) + 전화번호
--    — 확정(status='확정') 후 24시간 경과 시 실제 파기
create or replace function public.clear_expired_taesan_data()
returns void
language plpgsql
security definer
as $function$
declare
  rec record;
  paths text[];
  masked_phone text;
begin
  for rec in
    select id, customer_phone,
           doc_id_card, doc_employment, doc_income,
           doc_estimate, doc_excavator_license
    from public.taesan_tasks
    where status = '확정'
      and closed_at is not null
      and closed_at < now() - interval '24 hours'
      and (
        phone_scrubbed_at is null or
        doc_id_card is not null or
        doc_employment is not null or
        doc_income is not null or
        doc_estimate is not null or
        doc_excavator_license is not null
      )
  loop
    paths := array_remove(array[
      rec.doc_id_card, rec.doc_employment, rec.doc_income,
      rec.doc_estimate, rec.doc_excavator_license
    ], null);

    if array_length(paths, 1) > 0 then
      delete from storage.objects
        where bucket_id = 'taesan_docs' and name = any(paths);
    end if;

    if rec.customer_phone is not null then
      masked_phone := regexp_replace(
        regexp_replace(rec.customer_phone, '[^0-9]', '', 'g'),
        '(\d+)(\d{4})$', '\1****'
      );
    else
      masked_phone := rec.customer_phone;
    end if;

    update public.taesan_tasks
    set doc_id_card = null,
        doc_employment = null,
        doc_income = null,
        doc_estimate = null,
        doc_excavator_license = null,
        customer_phone = masked_phone,
        phone_scrubbed_at = now()
    where id = rec.id;
  end loop;
end;
$function$;

-- 2) 차량등록증(이전 전/이전 후) — 업로드(created_at) 후 72시간 경과 시 실제 삭제
create or replace function public.clear_expired_taesan_vehicle_reg_docs()
returns void
language plpgsql
security definer
as $function$
declare
  rec record;
begin
  for rec in
    select id, storage_path
    from public.taesan_vehicle_reg_doc_uploads
    where created_at < now() - interval '72 hours'
  loop
    delete from storage.objects
      where bucket_id = 'taesan-vehicle-reg-docs' and name = rec.storage_path;
    delete from public.taesan_vehicle_reg_doc_uploads where id = rec.id;
  end loop;
end;
$function$;

-- 3) 지입사 사업자등록증(세금계산서 대응) — 업로드(created_at) 후 72시간 경과 시 실제 삭제
create or replace function public.clear_expired_taesan_tax_invoices()
returns void
language plpgsql
security definer
as $function$
declare
  rec record;
begin
  for rec in
    select id, storage_path
    from public.taesan_tax_invoice_uploads
    where created_at < now() - interval '72 hours'
  loop
    delete from storage.objects
      where bucket_id = 'taesan-tax-invoices' and name = rec.storage_path;
    delete from public.taesan_tax_invoice_uploads where id = rec.id;
  end loop;
end;
$function$;

select cron.schedule(
  'clear-taesan-data-hourly',
  '0 * * * *',
  $$select public.clear_expired_taesan_data();$$
);
select cron.schedule(
  'clear-taesan-vehicle-reg-docs-hourly',
  '0 * * * *',
  $$select public.clear_expired_taesan_vehicle_reg_docs();$$
);
select cron.schedule(
  'clear-taesan-tax-invoices-hourly',
  '0 * * * *',
  $$select public.clear_expired_taesan_tax_invoices();$$
);
