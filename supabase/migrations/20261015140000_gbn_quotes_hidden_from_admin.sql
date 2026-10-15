-- 경기북부(hj5321006@naver.com) 견적은 경기북부 계정만 본다 — 관리자 정책에서도 제외 (2026-10-15)
-- Rental O/S 사용 중단 → 통합상담 Rental O/S 기록용 등록 권한 제거
begin;
alter policy quotations_all on public.tb_quotations
  using ((auth.email() = any (array['admin@rnfkorea.co.kr','everyasset.fc@gmail.com'])) and created_by is distinct from 'hj5321006@naver.com')
  with check ((auth.email() = any (array['admin@rnfkorea.co.kr','everyasset.fc@gmail.com'])) and created_by is distinct from 'hj5321006@naver.com');
drop policy if exists consultation_cases_rentalos_insert on public.consultation_cases;
commit;
