-- 경기북부 견적도 관리자는 본다 (관리 목적) — 20261015140000에서 관리자 정책에 넣은 제외 조건을 되돌림 (2026-10-15)
-- 경기북부 계정은 계속 자기 명의 지게차(현대판매) 견적만 본다 (quotations_gbn_* 정책)
alter policy quotations_all on public.tb_quotations
  using (auth.email() = any (array['admin@rnfkorea.co.kr','everyasset.fc@gmail.com']))
  with check (auth.email() = any (array['admin@rnfkorea.co.kr','everyasset.fc@gmail.com']));
