-- 태산통운 페이지: NH캐피탈(allbar7555@naver.com, 강신규 소장) 계정에 현대CM 페이지(isNhCapital)와
-- 동일한 폭넓은 권한(조회/신규등록/수정/상태변경/서류업로드/삭제) 부여.
-- 프론트엔드 권한(lib/auth.tsx의 isNhCapital, pages/Taesan/index.tsx의 canXxx)만 바꿔서는
-- RLS가 여전히 admin/subAdmin/taesan(yj565012@naver.com)만 허용하고 있어 실제로는 막히므로
-- DB 정책도 함께 갱신한다.

alter policy taesan_tasks_select on public.taesan_tasks
  using (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']));

alter policy taesan_tasks_insert on public.taesan_tasks
  with check (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','allbar7555@naver.com']));

alter policy taesan_tasks_update on public.taesan_tasks
  using (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']));

alter policy taesan_tasks_delete on public.taesan_tasks
  using (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','everyasset.fc@gmail.com','allbar7555@naver.com']));

alter policy taesan_holds_all on public.taesan_holds
  using (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']));

alter policy taesan_etc_docs_all on public.taesan_etc_docs
  using (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']));

alter policy taesan_tax_invoice_uploads_all on public.taesan_tax_invoice_uploads
  using (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']));

alter policy taesan_vehicle_reg_doc_uploads_all on public.taesan_vehicle_reg_doc_uploads
  using (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']));

-- 스토리지 버킷 (기타서류, 세금계산서, 차량등록증)
alter policy taesan_docs_access on storage.objects
  using (bucket_id = 'taesan_docs' and auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']))
  with check (bucket_id = 'taesan_docs' and auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']));

alter policy taesan_tax_invoices_access on storage.objects
  using (bucket_id = 'taesan-tax-invoices' and auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']))
  with check (bucket_id = 'taesan-tax-invoices' and auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']));

alter policy taesan_vehicle_reg_docs_access on storage.objects
  using (bucket_id = 'taesan-vehicle-reg-docs' and auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']))
  with check (bucket_id = 'taesan-vehicle-reg-docs' and auth.email() = any (array['admin@rnfkorea.co.kr','ltongs7@gmail.com','yj565012@naver.com','everyasset.fc@gmail.com','allbar7555@naver.com']));
