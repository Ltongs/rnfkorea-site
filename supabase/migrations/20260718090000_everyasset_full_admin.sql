-- everyasset.fc@gmail.com(AI비서-보험 전용 계정)에게 admin@rnfkorea.co.kr과
-- 완전히 동일한 DB 접근권한을 부여한다(사용자 명시적 확인: "완전한 admin과 동일한 권한").
--
-- 이 계정은 지금까지 is_internal_staff()/narumi_app_role()='narumi' 수준으로만
-- 좁게 허용되어 있었고, 'admin@rnfkorea.co.kr'을 직접 하드코딩한 정책 20개 +
-- 스토리지 정책 4개는 아예 접근이 막혀 있었다. 이 마이그레이션은 그 모든 지점에
-- everyasset.fc@gmail.com을 admin@rnfkorea.co.kr과 나란히 추가한다.
-- (클라이언트 측 lib/auth.tsx의 isSubAdmin도 함께 반영할 것 — 이 파일만으로는 불충분함)

begin;

-- ============================================================
-- 1) 공용 헬퍼 함수 — is_admin_level()이 admin_level 계열
--    (is_hcm_staff/is_hcm_viewer/is_internal_staff/is_rental_os_staff)에
--    자동으로 전파되므로 가장 넓은 효과를 낸다.
-- ============================================================
create or replace function public.is_admin_level()
returns boolean language sql stable as $$
  select coalesce((auth.jwt()->>'email'), '') in
    ('admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'everyasset.fc@gmail.com');
$$;

-- narumi_app_role(): everyasset.fc@gmail.com을 'narumi'가 아닌 'admin'으로 승격
create or replace function public.narumi_app_role()
returns text language sql stable as $$
  select case
    when public.current_user_email() in ('admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'everyasset.fc@gmail.com') then 'admin'
    when public.current_user_email() = 'sales@narmimotors.com' then 'narumi'
    when public.current_user_email() = 'youngjin.heo@lotte.net' then 'lotte'
    else 'none'
  end
$$;

-- ============================================================
-- 2) 'admin@rnfkorea.co.kr'을 직접 하드코딩한 테이블 정책 (is_admin_level 미경유)
-- ============================================================
alter policy narumi_notification_logs_admin_select on public.narumi_notification_logs
  using (lower(coalesce((auth.jwt() ->> 'email'), '')) = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'everyasset.fc@gmail.com']));

alter policy narumi_tasks_select_admin on public.narumi_tasks
  using ((auth.jwt() ->> 'email') = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']));

alter policy narumi_tasks_update_admin_only on public.narumi_tasks
  using ((auth.jwt() ->> 'email') = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']))
  with check ((auth.jwt() ->> 'email') = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']));

alter policy narumi_tasks_delete_admin_only on public.narumi_tasks
  using ((auth.jwt() ->> 'email') = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']));

alter policy gift_card_stock_all on public.tb_gift_card_stock
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']));

alter policy admin_can_select_export_inquiry on public.export_inquiries
  using ((auth.jwt() ->> 'email') = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'everyasset.fc@gmail.com']));

alter policy hyundaicm_and_admin_can_select on public.vehicle_reg_doc_uploads
  using ((auth.jwt() ->> 'email') = any (array['p2001103@hanmail.net', 'admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'allbar7555@naver.com', 'yongbaek_jo@orix.co.kr', 'ehddhks1115@nhcapital.co.kr', 'everyasset.fc@gmail.com']));

alter policy all_hyundaicm_users_can_select_tax_invoice on public.tax_invoice_uploads
  using ((auth.jwt() ->> 'email') = any (array['p2001103@hanmail.net', 'admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'allbar7555@naver.com', 'yongbaek_jo@orix.co.kr', 'ehddhks1115@nhcapital.co.kr', 'everyasset.fc@gmail.com']));

alter policy contractors_all on public.tb_contractors
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']));

alter policy payments_all on public.tb_withholding_payments
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']));

alter policy quotations_all on public.tb_quotations
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']));

alter policy admin_all_schedules on public.schedules
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']));

alter policy taesan_tasks_select on public.taesan_tasks
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com']));

alter policy taesan_tasks_update on public.taesan_tasks
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com']));

alter policy taesan_tasks_delete on public.taesan_tasks
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'everyasset.fc@gmail.com']));

alter policy taesan_holds_all on public.taesan_holds
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com']));

alter policy taesan_etc_docs_all on public.taesan_etc_docs
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com']));

alter policy taesan_vehicle_reg_doc_uploads_all on public.taesan_vehicle_reg_doc_uploads
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com']));

alter policy taesan_tax_invoice_uploads_all on public.taesan_tax_invoice_uploads
  using (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com']));

alter policy "admin full access on tb_transaction_statements" on public.tb_transaction_statements
  using ((auth.jwt() ->> 'email') = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']))
  with check ((auth.jwt() ->> 'email') = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com']));

-- ============================================================
-- 3) storage.objects 정책 (버킷별 admin 하드코딩)
-- ============================================================
alter policy hcm_docs_delete on storage.objects
  using ((bucket_id = 'hcm_docs') and (auth.email() = any (array['admin@rnfkorea.co.kr', 'everyasset.fc@gmail.com'])));

alter policy taesan_docs_access on storage.objects
  using ((bucket_id = 'taesan_docs') and (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com'])))
  with check ((bucket_id = 'taesan_docs') and (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com'])));

alter policy taesan_tax_invoices_access on storage.objects
  using ((bucket_id = 'taesan-tax-invoices') and (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com'])))
  with check ((bucket_id = 'taesan-tax-invoices') and (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com'])));

alter policy taesan_vehicle_reg_docs_access on storage.objects
  using ((bucket_id = 'taesan-vehicle-reg-docs') and (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com'])))
  with check ((bucket_id = 'taesan-vehicle-reg-docs') and (auth.email() = any (array['admin@rnfkorea.co.kr', 'ltongs7@gmail.com', 'yj565012@naver.com', 'everyasset.fc@gmail.com'])));

commit;
