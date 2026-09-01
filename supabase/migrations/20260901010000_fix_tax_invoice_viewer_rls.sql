-- security_hardening_20260712.sql에서 hcm_docs/vehicle-reg-docs 버킷과 hyundaicm_tasks 등 테이블은
-- NH캐피탈 직원(ehddhks1115@nhcapital.co.kr, is_hcm_viewer()만 통과)까지 조회 가능하도록 좁혔으나,
-- tax_invoices/tax_invoice_uploads 테이블과 tax-invoices 버킷은 is_hcm_staff()/is_internal_staff()만
-- 체크하도록 남아있어 해당 직원 계정에서 세금계산서 다운로드 시 "Object not found"로 보임
-- (RLS가 행을 걸러내면 실제로는 파일이 있어도 클라이언트에는 존재하지 않는 것처럼 보인다).
begin;

drop policy if exists tax_invoices_internal_all on public.tax_invoices;
create policy tax_invoices_select on public.tax_invoices for select
  using (public.is_internal_staff() or public.is_hcm_viewer());
create policy tax_invoices_write on public.tax_invoices for insert
  with check (public.is_internal_staff() or public.is_hcm_staff());
create policy tax_invoices_update on public.tax_invoices for update
  using (public.is_internal_staff() or public.is_hcm_viewer())
  with check (public.is_internal_staff() or public.is_hcm_staff());
create policy tax_invoices_delete on public.tax_invoices for delete
  using (public.is_internal_staff() or public.is_hcm_staff());

drop policy if exists tax_invoice_uploads_internal_all on public.tax_invoice_uploads;
create policy tax_invoice_uploads_select on public.tax_invoice_uploads for select
  using (public.is_internal_staff() or public.is_hcm_viewer());
create policy tax_invoice_uploads_write on public.tax_invoice_uploads for insert
  with check (public.is_internal_staff() or public.is_hcm_staff());
create policy tax_invoice_uploads_update on public.tax_invoice_uploads for update
  using (public.is_internal_staff() or public.is_hcm_viewer())
  with check (public.is_internal_staff() or public.is_hcm_staff());
create policy tax_invoice_uploads_delete on public.tax_invoice_uploads for delete
  using (public.is_internal_staff() or public.is_hcm_staff());

drop policy if exists tax_invoices_bucket_select on storage.objects;
create policy tax_invoices_bucket_select on storage.objects for select
  using (bucket_id = 'tax-invoices' and (public.is_internal_staff() or public.is_hcm_viewer()));
-- insert 정책(tax_invoices_bucket_insert)은 업로드 권한이라 is_hcm_staff() 그대로 유지

commit;
