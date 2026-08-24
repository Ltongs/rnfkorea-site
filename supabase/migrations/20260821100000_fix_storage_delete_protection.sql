-- storage.objects에는 고아 파일 방지용 protect_delete 트리거(storage.protect_delete())가 걸려 있어,
-- storage.allow_delete_query 세션 설정(트랜잭션 한정) 없이는 "DELETE FROM storage.objects"가
-- 항상 "Direct deletion from storage tables is not allowed" 예외로 막힌다.
-- (20260817110000_hcm_doc_retention_fix.sql 작업 중 발견 — 그 마이그레이션 자체가 이 예외로 실패했었음)
--
-- 이 트리거를 고려하지 않고 작성된 기존 정리 함수들도 전부 동일한 이유로 크론이 돌 때마다
-- 조용히 실패하고 있었다(파일이 있는 건이 하나라도 있으면 storage.objects DELETE에서 예외가
-- 발생해 그 실행 전체가 롤백됨). 아래 함수들에 set_config('storage.allow_delete_query', 'true', true)를
-- 추가해 정상적으로 삭제되도록 고친다.

create or replace function public.clear_expired_hcm_data()
returns void
language plpgsql
security definer
as $function$
declare
  rec record;
  paths text[];
  masked_phone text;
begin
  perform set_config('storage.allow_delete_query', 'true', true);

  for rec in
    select id, customer_phone,
           doc_id_card, doc_employment, doc_income,
           doc_estimate, doc_excavator_license, doc_etc
    from public.hyundaicm_tasks
    where status = '확정'
      and closed_at is not null
      and closed_at < now() - interval '24 hours'
      and (
        phone_scrubbed_at is null or
        doc_id_card is not null or
        doc_employment is not null or
        doc_income is not null or
        doc_estimate is not null or
        doc_excavator_license is not null or
        doc_etc is not null
      )
  loop
    paths := array_remove(array[
      rec.doc_id_card, rec.doc_employment, rec.doc_income,
      rec.doc_estimate, rec.doc_excavator_license, rec.doc_etc
    ], null);

    if array_length(paths, 1) > 0 then
      delete from storage.objects
      where bucket_id = 'hcm_docs' and name = any(paths);
    end if;

    if rec.customer_phone is not null then
      masked_phone := regexp_replace(
        regexp_replace(rec.customer_phone, '[^0-9]', '', 'g'),
        '(\d+)(\d{4})$', '\1****'
      );
    else
      masked_phone := rec.customer_phone;
    end if;

    update public.hyundaicm_tasks
    set
      doc_id_card           = null,
      doc_employment        = null,
      doc_income            = null,
      doc_estimate          = null,
      doc_excavator_license = null,
      doc_etc               = null,
      customer_phone        = masked_phone,
      phone_scrubbed_at     = now()
    where id = rec.id;
  end loop;
end;
$function$;

create or replace function public.clear_expired_hcm_docs()
returns void
language plpgsql
security definer
as $function$
declare
  rec record;
  paths text[];
begin
  perform set_config('storage.allow_delete_query', 'true', true);

  for rec in
    select id,
           doc_id_card, doc_employment, doc_income,
           doc_estimate, doc_excavator_license, doc_etc
    from public.hyundaicm_tasks
    where status = '확정'
      and closed_at is not null
      and closed_at < now() - interval '24 hours'
      and (
        doc_id_card is not null or
        doc_employment is not null or
        doc_income is not null or
        doc_estimate is not null or
        doc_excavator_license is not null or
        doc_etc is not null
      )
  loop
    paths := array_remove(array[
      rec.doc_id_card,
      rec.doc_employment,
      rec.doc_income,
      rec.doc_estimate,
      rec.doc_excavator_license,
      rec.doc_etc
    ], null);

    if array_length(paths, 1) > 0 then
      delete from storage.objects
      where bucket_id = 'hcm_docs'
        and name = any(paths);

      update public.hyundaicm_tasks
      set
        doc_id_card           = null,
        doc_employment        = null,
        doc_income            = null,
        doc_estimate          = null,
        doc_excavator_license = null,
        doc_etc               = null
      where id = rec.id;
    end if;
  end loop;
end;
$function$;

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
  perform set_config('storage.allow_delete_query', 'true', true);

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

create or replace function public.clear_expired_taesan_tax_invoices()
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
    from public.taesan_tax_invoice_uploads
    where created_at < now() - interval '72 hours'
  loop
    delete from storage.objects
      where bucket_id = 'taesan-tax-invoices' and name = rec.storage_path;
    delete from public.taesan_tax_invoice_uploads where id = rec.id;
  end loop;
end;
$function$;

create or replace function public.clear_expired_taesan_vehicle_reg_docs()
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
    from public.taesan_vehicle_reg_doc_uploads
    where created_at < now() - interval '72 hours'
  loop
    delete from storage.objects
      where bucket_id = 'taesan-vehicle-reg-docs' and name = rec.storage_path;
    delete from public.taesan_vehicle_reg_doc_uploads where id = rec.id;
  end loop;
end;
$function$;
