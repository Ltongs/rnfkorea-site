-- 개인정보 보안 점검(2026-07-12) 후속 조치.
-- 발견된 문제의 공통 원인: 테이블마다 "auth.role()='authenticated'"(로그인만 하면 누구나) 같은
-- 광범위한 정책이 먼저 만들어졌고, 이후 테이블별로 더 좁은 정책(관리자만 등)이 추가됐지만
-- Postgres RLS는 permissive 정책을 OR로 합치기 때문에 넓은 정책이 있으면 좁은 정책은 무력화된다.
-- 이 마이그레이션은 각 테이블의 실제 소비 화면(App.tsx 라우트 가드 기준)에 맞춰
-- "authenticated면 전부 허용" 정책을 역할 기반 정책으로 교체한다.
--
-- 역할 그룹 정의 (lib/auth.tsx의 getRoleFlags와 동일하게 유지할 것):
--   is_admin_level()   = admin@rnfkorea.co.kr, ltongs7@gmail.com (부관리자)
--   is_internal_staff()= admin_level + 나르미(@narmimotors.com) + 롯데오토리스(@lotte.net)
--                        + 보험전담(inhyang1004@hanmail.net) + AI비서-보험(everyasset.fc@gmail.com)
--                        (상담관리/AI비서/대시보드/주간리뷰/거래명세서가 공유하는 "내부" 그룹)
--   is_hcm_staff()      = admin_level + 현대건설기계 담당자 + NH캐피탈(파트너 2명)
--   is_hcm_viewer()     = is_hcm_staff() + NH캐피탈 직원(상태변경·다운로드만)
--   is_rental_os_staff()= admin_level + kohd1222@naver.com

begin;

-- ============================================================
-- 0) 공용 헬퍼 함수
-- ============================================================
create or replace function public.is_admin_level()
returns boolean language sql stable as $$
  select coalesce((auth.jwt()->>'email'), '') in ('admin@rnfkorea.co.kr','ltongs7@gmail.com');
$$;

create or replace function public.is_internal_staff()
returns boolean language sql stable as $$
  select
    public.is_admin_level()
    or coalesce((auth.jwt()->>'email'), '') in ('inhyang1004@hanmail.net','everyasset.fc@gmail.com')
    or coalesce((auth.jwt()->>'email'), '') ilike '%@narmimotors.com'
    or coalesce((auth.jwt()->>'email'), '') ilike '%@lotte.net';
$$;

create or replace function public.is_hcm_staff()
returns boolean language sql stable as $$
  select
    public.is_admin_level()
    or coalesce((auth.jwt()->>'email'), '') in
       ('p2001103@hanmail.net','allbar7555@naver.com','yongbaek_jo@orix.co.kr');
$$;

create or replace function public.is_hcm_viewer()
returns boolean language sql stable as $$
  select public.is_hcm_staff() or coalesce((auth.jwt()->>'email'), '') = 'ehddhks1115@nhcapital.co.kr';
$$;

create or replace function public.is_rental_os_staff()
returns boolean language sql stable as $$
  select public.is_admin_level() or coalesce((auth.jwt()->>'email'), '') = 'kohd1222@naver.com';
$$;

-- ============================================================
-- 1) export_tasks / insurance_tasks
--    현대CM 페이지의 보험/수출 탭은 이미 삭제됐지만(2026-07-12 세션) 남아있던 이 두 테이블은
--    RLS 자체가 꺼져 있고 anon(비로그인)에게 SELECT/INSERT/UPDATE/DELETE가 전부 열려 있었음.
--    현재 프론트엔드에서 실제로 도달 가능한 진입점이 없으므로 완전 봉쇄한다.
-- ============================================================
alter table public.export_tasks enable row level security;
alter table public.insurance_tasks enable row level security;
revoke all on public.export_tasks from anon, authenticated;
revoke all on public.insurance_tasks from anon, authenticated;

-- ============================================================
-- 2) vehicles
--    narumi_tasks로 대체된 구버전 테이블로 보이며 프론트엔드 어디에서도 참조하지 않음.
--    그런데 anon에게 SELECT/INSERT가 무제한으로 열려 있었고 실제 고객명·VIN이 들어있었음.
-- ============================================================
alter table public.vehicles enable row level security;
drop policy if exists "public insert" on public.vehicles;
drop policy if exists "allow public insert" on public.vehicles;
drop policy if exists "public read" on public.vehicles;
drop policy if exists "allow public read" on public.vehicles;
revoke all on public.vehicles from anon, authenticated;

-- ============================================================
-- 3) tb_orders
--    anon_read_by_id/anon_update_by_id가 이름과 달리 id로 범위를 제한하지 않고
--    qual=true여서 로그인 없이 전체 테이블 SELECT/UPDATE가 가능했음.
--    공개 확인링크(OrderConfirm) 용도는 order-confirm 엣지함수로 이전하고 anon 접근은 제거.
--    나머지 authenticated 권한은 상담관리/대시보드/AI비서가 공유하는 is_internal_staff()로 축소.
-- ============================================================
drop policy if exists anon_read_by_id on public.tb_orders;
drop policy if exists anon_update_by_id on public.tb_orders;
drop policy if exists authenticated_read on public.tb_orders;
drop policy if exists authenticated_update on public.tb_orders;
drop policy if exists tb_orders_auth on public.tb_orders;
create policy tb_orders_internal_all on public.tb_orders for all
  using (public.is_internal_staff()) with check (public.is_internal_staff());

-- ============================================================
-- 4) customers
--    소비 화면(secretary/FinanceHub/거래명세서)이 모두 admin-level 전용 라우트이므로
--    "로그인만 하면 전체 고객 마스터 조회 가능"을 admin-level 전용으로 축소.
-- ============================================================
drop policy if exists authenticated_read on public.customers;
create policy customers_admin_select on public.customers for select
  using (public.is_admin_level());

-- ============================================================
-- 5) consultation_* (상담관리 CallManagement + AI비서 + 대시보드/주간리뷰가 공유)
-- ============================================================
drop policy if exists consultation_battery_details_all_authenticated on public.consultation_battery_details;
drop policy if exists consultation_battery_details_auth on public.consultation_battery_details;
create policy consultation_battery_details_internal_all on public.consultation_battery_details for all
  using (public.is_internal_staff()) with check (public.is_internal_staff());

drop policy if exists consultation_forklift_details_all_authenticated on public.consultation_forklift_details;
drop policy if exists consultation_forklift_details_auth on public.consultation_forklift_details;
create policy consultation_forklift_details_internal_all on public.consultation_forklift_details for all
  using (public.is_internal_staff()) with check (public.is_internal_staff());

drop policy if exists authenticated_only on public.consultation_export_details;
drop policy if exists consultation_export_details_auth on public.consultation_export_details;
create policy consultation_export_details_internal_all on public.consultation_export_details for all
  using (public.is_internal_staff()) with check (public.is_internal_staff());

drop policy if exists consultation_finance_details_auth on public.consultation_finance_details;
drop policy if exists finance_details_delete_for_authenticated on public.consultation_finance_details;
drop policy if exists finance_details_insert_for_authenticated on public.consultation_finance_details;
drop policy if exists finance_details_select_for_authenticated on public.consultation_finance_details;
drop policy if exists finance_details_update_for_authenticated on public.consultation_finance_details;
create policy consultation_finance_details_internal_all on public.consultation_finance_details for all
  using (public.is_internal_staff()) with check (public.is_internal_staff());

drop policy if exists consultation_tire_details_auth on public.consultation_tire_details;
drop policy if exists authenticated_only on public.consultation_tire_details;
create policy consultation_tire_details_internal_all on public.consultation_tire_details for all
  using (public.is_internal_staff()) with check (public.is_internal_staff());

drop policy if exists consultation_cases_auth on public.consultation_cases;
create policy consultation_cases_internal_all on public.consultation_cases for all
  using (public.is_internal_staff()) with check (public.is_internal_staff());

-- consultation_insurance_details: 기존 select/update/delete_policy는
-- "이메일이 inhyang1004가 아니면 무조건 true"라서 사실상 로그인 계정 전부(외부 파트너 포함)에게
-- 열려 있었음. inhyang1004(보험전담)는 registration_insurance 건만 보게 하는 규칙은 유지하되
-- 그 외에는 is_internal_staff()로 좁힌다. insert_policy는 아예 비로그인도 허용(roles:public,
-- qual:null)이었으므로 함께 교체한다.
drop policy if exists consultation_insurance_details_auth on public.consultation_insurance_details;
drop policy if exists consultation_insurance_details_insert_policy on public.consultation_insurance_details;
drop policy if exists consultation_insurance_details_select_policy on public.consultation_insurance_details;
drop policy if exists consultation_insurance_details_update_policy on public.consultation_insurance_details;
drop policy if exists consultation_insurance_details_delete_policy on public.consultation_insurance_details;
create policy consultation_insurance_details_internal_all on public.consultation_insurance_details for all
  using (
    public.is_internal_staff()
    and (
      coalesce((auth.jwt()->>'email'), '') <> 'inhyang1004@hanmail.net'
      or exists (
        select 1 from public.consultation_cases c
        where c.id = consultation_insurance_details.consultation_id
          and c.work_type = 'registration_insurance'
      )
    )
  )
  with check (
    public.is_internal_staff()
    and (
      coalesce((auth.jwt()->>'email'), '') <> 'inhyang1004@hanmail.net'
      or exists (
        select 1 from public.consultation_cases c
        where c.id = consultation_insurance_details.consultation_id
          and c.work_type = 'registration_insurance'
      )
    )
  );

-- ============================================================
-- 6) tax_invoices / tax_invoice_uploads (상담관리 + AI비서 + 현대CM이 공유)
-- ============================================================
drop policy if exists tax_invoices_auth on public.tax_invoices;
drop policy if exists tax_invoices_delete on public.tax_invoices;
drop policy if exists tax_invoices_insert on public.tax_invoices;
drop policy if exists tax_invoices_select on public.tax_invoices;
drop policy if exists tax_invoices_update on public.tax_invoices;
create policy tax_invoices_internal_all on public.tax_invoices for all
  using (public.is_internal_staff() or public.is_hcm_staff())
  with check (public.is_internal_staff() or public.is_hcm_staff());

drop policy if exists tax_invoice_uploads_auth on public.tax_invoice_uploads;
drop policy if exists hyundaicm_and_admin_can_insert_tax_invoice on public.tax_invoice_uploads;
create policy tax_invoice_uploads_internal_all on public.tax_invoice_uploads for all
  using (public.is_internal_staff() or public.is_hcm_staff())
  with check (public.is_internal_staff() or public.is_hcm_staff());

-- ============================================================
-- 7) hyundaicm_tasks / hcm_etc_docs / hcm_holds / vehicle_reg_doc_uploads
--    현대CM 전용 — is_internal_staff()가 아니라 is_hcm_staff()/is_hcm_viewer() 사용.
--    NH캐피탈 직원(ehddhks1115)은 이번 세션에서 "상태변경+다운로드만 허용, 업로드 불가"로
--    합의됐으므로 SELECT/UPDATE(상태변경)는 is_hcm_viewer(), INSERT(업로드)/DELETE는 is_hcm_staff()로 분리.
-- ============================================================
drop policy if exists hyundaicm_tasks_auth on public.hyundaicm_tasks;
drop policy if exists hyundaicm_select on public.hyundaicm_tasks;
drop policy if exists hyundaicm_insert on public.hyundaicm_tasks;
drop policy if exists hyundaicm_update on public.hyundaicm_tasks;
drop policy if exists hyundaicm_delete on public.hyundaicm_tasks;
create policy hyundaicm_tasks_select on public.hyundaicm_tasks for select
  using (public.is_hcm_viewer());
create policy hyundaicm_tasks_insert on public.hyundaicm_tasks for insert
  with check (public.is_hcm_staff());
create policy hyundaicm_tasks_update on public.hyundaicm_tasks for update
  using (public.is_hcm_viewer()) with check (public.is_hcm_viewer());
create policy hyundaicm_tasks_delete on public.hyundaicm_tasks for delete
  using (public.is_admin_level());

drop policy if exists hcm_etc_docs_auth on public.hcm_etc_docs;
drop policy if exists hcm_etc_docs_delete on public.hcm_etc_docs;
drop policy if exists hcm_etc_docs_insert on public.hcm_etc_docs;
drop policy if exists hcm_etc_docs_select on public.hcm_etc_docs;
create policy hcm_etc_docs_select on public.hcm_etc_docs for select using (public.is_hcm_viewer());
create policy hcm_etc_docs_insert on public.hcm_etc_docs for insert with check (public.is_hcm_staff());
create policy hcm_etc_docs_update on public.hcm_etc_docs for update using (public.is_hcm_staff()) with check (public.is_hcm_staff());
create policy hcm_etc_docs_delete on public.hcm_etc_docs for delete using (public.is_hcm_staff());

drop policy if exists hcm_holds_auth on public.hcm_holds;
drop policy if exists authenticated_all on public.hcm_holds;
create policy hcm_holds_internal_all on public.hcm_holds for all
  using (public.is_hcm_staff()) with check (public.is_hcm_staff());

drop policy if exists vehicle_reg_doc_uploads_auth on public.vehicle_reg_doc_uploads;
drop policy if exists authenticated_can_insert on public.vehicle_reg_doc_uploads;
drop policy if exists hyundaicm_can_insert on public.vehicle_reg_doc_uploads;
-- hyundaicm_and_admin_can_select는 기존 이메일 목록 정책을 그대로 유지(이미 NH캐피탈 직원 포함)
create policy vehicle_reg_doc_uploads_insert on public.vehicle_reg_doc_uploads for insert
  with check (public.is_hcm_staff());
create policy vehicle_reg_doc_uploads_update on public.vehicle_reg_doc_uploads for update
  using (public.is_hcm_viewer()) with check (public.is_hcm_viewer());
create policy vehicle_reg_doc_uploads_delete on public.vehicle_reg_doc_uploads for delete
  using (public.is_admin_level());

-- ============================================================
-- 8) rental_os_deals / rental_os_deal_files / rental_os_deal_history
--    "admin + kohd1222@naver.com 전용" 설계 의도와 달리 로그인 계정 전체(다른 파트너 포함)에게
--    열려 있었음.
-- ============================================================
drop policy if exists authenticated_all_rental_os_deals on public.rental_os_deals;
create policy rental_os_deals_staff_all on public.rental_os_deals for all
  using (public.is_rental_os_staff()) with check (public.is_rental_os_staff());

drop policy if exists authenticated_all_rental_os_deal_files on public.rental_os_deal_files;
create policy rental_os_deal_files_staff_all on public.rental_os_deal_files for all
  using (public.is_rental_os_staff()) with check (public.is_rental_os_staff());

drop policy if exists authenticated_all_rental_os_deal_history on public.rental_os_deal_history;
create policy rental_os_deal_history_staff_all on public.rental_os_deal_history for all
  using (public.is_rental_os_staff()) with check (public.is_rental_os_staff());

-- ============================================================
-- 9) email_reports — AI비서(admin-level 전용 라우트)에서만 사용
-- ============================================================
drop policy if exists email_reports_auth on public.email_reports;
drop policy if exists "admin read" on public.email_reports;
create policy email_reports_admin_all on public.email_reports for all
  using (public.is_admin_level()) with check (public.is_admin_level());

-- ============================================================
-- 10) google_calendar_tokens
--     "본인 토큰만" 정책(gcal_tokens_own)이 이미 있었지만 auth_all_gcal_tokens(로그인만 하면
--     타인의 access_token/refresh_token까지 전부 조회+수정 가능)이 이를 완전히 무력화하고 있었음.
--     본인 토큰 자가 관리(gcal 연동/해제)를 제외하면 client가 직접 이 테이블을 읽을 이유가 없으므로
--     타인 토큰 조회가 필요한 두 곳(구글 연락처 검색)은 별도 엣지함수로 옮긴다(아래 8번 참고).
-- ============================================================
drop policy if exists auth_all_gcal_tokens on public.google_calendar_tokens;

-- ============================================================
-- 11) kakao_tokens
--     access_token/refresh_token(카카오 알림톡 발송용 사업자 인증 정보)이 로그인 계정 전체에게
--     열려 있었음. 실제 연동/해제는 현대CM 담당자(KakaoConnect.tsx)만 수행하므로 그 범위로 축소.
-- ============================================================
drop policy if exists kakao_tokens_auth on public.kakao_tokens;
drop policy if exists "Allow all for authenticated" on public.kakao_tokens;
create policy kakao_tokens_hcm_all on public.kakao_tokens for all
  using (public.is_hcm_staff()) with check (public.is_hcm_staff());

-- ============================================================
-- 12) storage.objects — vehicle_docs 버킷(나르미 차량등록증)
--     Studio에서 생성된 기본 "공개 허용" 정책(11gcu3y_0)이 비로그인 SELECT/INSERT를 전부 열어뒀고,
--     버킷 자체도 public=true라 서명 없이 누구나 문서를 열람할 수 있었음.
--     이미 존재하는 vehicle_docs_select/insert/update/delete_policy(나르미 역할 기반)로 충분하므로
--     기본 정책만 제거하고 버킷을 private으로 전환한다.
-- ============================================================
drop policy if exists "Allow insert vehicle_docs 11gcu3y_0" on storage.objects;
drop policy if exists "Allow read vehicle_docs 11gcu3y_0" on storage.objects;
update storage.buckets set public = false where id = 'vehicle_docs';

-- ============================================================
-- 13) storage.objects — rental_os_docs 버킷
-- ============================================================
drop policy if exists authenticated_read_rental_os_docs on storage.objects;
drop policy if exists authenticated_write_rental_os_docs on storage.objects;
drop policy if exists authenticated_delete_rental_os_docs on storage.objects;
create policy rental_os_docs_staff_all on storage.objects for all
  using (bucket_id = 'rental_os_docs' and public.is_rental_os_staff())
  with check (bucket_id = 'rental_os_docs' and public.is_rental_os_staff());

-- ============================================================
-- 14) anon 테이블 권한 정리
--     RLS 정책만으로도 anon은 이미 차단되지만(위 정책들이 전부 email 기반이라 anon은
--     매치되지 않음), 테이블 자체의 GRANT가 남아있으면 이후 누군가 실수로 "roles:public"
--     정책을 다시 추가할 때 즉시 재노출된다. 방어적으로 anon GRANT 자체를 제거한다.
-- ============================================================
revoke all on public.tb_orders from anon;
revoke all on public.customers from anon;
revoke all on public.consultation_cases from anon;
revoke all on public.consultation_battery_details from anon;
revoke all on public.consultation_forklift_details from anon;
revoke all on public.consultation_export_details from anon;
revoke all on public.consultation_finance_details from anon;
revoke all on public.consultation_tire_details from anon;
revoke all on public.consultation_insurance_details from anon;
revoke all on public.tax_invoices from anon;
revoke all on public.tax_invoice_uploads from anon;
revoke all on public.hyundaicm_tasks from anon;
revoke all on public.hcm_etc_docs from anon;
revoke all on public.hcm_holds from anon;
revoke all on public.vehicle_reg_doc_uploads from anon;
revoke all on public.rental_os_deals from anon;
revoke all on public.rental_os_deal_files from anon;
revoke all on public.rental_os_deal_history from anon;
revoke all on public.email_reports from anon;
revoke all on public.kakao_tokens from anon;
revoke all on public.google_calendar_tokens from anon;

commit;
-- hcm_docs / vehicle-reg-docs / tax-invoices 버킷도 테이블(vehicle_reg_doc_uploads, tax_invoice_uploads,
-- tax_invoices)과 동일하게 "로그인만 하면 전체 허용"이었음 — 나르미/롯데/태산/RentalOS 등
-- 다른 파트너 계정도 현대CM 차량등록증·세금계산서 원본 파일을 스토리지 레벨에서 직접 열람 가능했음.
-- 이미 만들어둔 is_hcm_staff()/is_hcm_viewer() 헬퍼로 동일하게 좁힌다.
begin;

drop policy if exists authenticated_download_hcm_docs on storage.objects;
drop policy if exists hcm_docs_select on storage.objects;
drop policy if exists hcm_docs_insert on storage.objects;
drop policy if exists hcm_docs_update on storage.objects;
create policy hcm_docs_select on storage.objects for select
  using (bucket_id = 'hcm_docs' and public.is_hcm_viewer());
create policy hcm_docs_insert on storage.objects for insert
  with check (bucket_id = 'hcm_docs' and public.is_hcm_staff());
create policy hcm_docs_update on storage.objects for update
  using (bucket_id = 'hcm_docs' and public.is_hcm_staff())
  with check (bucket_id = 'hcm_docs' and public.is_hcm_staff());
-- hcm_docs_delete(admin 전용)는 이미 올바르게 좁혀져 있으므로 유지

drop policy if exists authenticated_download_vehicle_reg on storage.objects;
drop policy if exists authenticated_upload_vehicle_reg on storage.objects;
create policy vehicle_reg_docs_select on storage.objects for select
  using (bucket_id = 'vehicle-reg-docs' and public.is_hcm_viewer());
create policy vehicle_reg_docs_insert on storage.objects for insert
  with check (bucket_id = 'vehicle-reg-docs' and public.is_hcm_staff());

drop policy if exists authenticated_select_tax_invoice on storage.objects;
drop policy if exists authenticated_upload_tax_invoice on storage.objects;
create policy tax_invoices_bucket_select on storage.objects for select
  using (bucket_id = 'tax-invoices' and (public.is_hcm_staff() or public.is_internal_staff()));
create policy tax_invoices_bucket_insert on storage.objects for insert
  with check (bucket_id = 'tax-invoices' and (public.is_hcm_staff() or public.is_internal_staff()));

commit;
