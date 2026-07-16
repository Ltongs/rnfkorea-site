-- 나르미 월간 리포트(2026-07-17): "등록완료" 상태로 전환된 시점을 기록하는 컬럼 추가.
-- 기존 is_registered는 boolean 플래그뿐이라 "몇 월에 등록완료됐는지" 집계가 불가능했음.
-- 이미 등록완료된 기존 건들은 정확한 완료 시각을 알 수 없으므로 접수 시각(created_at)으로 근사 백필한다.

begin;

alter table public.narumi_tasks add column if not exists registered_at timestamptz;

update public.narumi_tasks
set registered_at = created_at
where is_registered = true and registered_at is null;

commit;
