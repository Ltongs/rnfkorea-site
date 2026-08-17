-- 현대지게차 경기북부판매 딜에 엔진형식(디젤/전동(납산)/전동(리튬)) 구분 컬럼 추가
alter table public.brother_tasks
  add column if not exists engine_type text;

comment on column public.brother_tasks.engine_type is
  '엔진형식 구분: 디젤 / 전동(납산) / 전동(리튬)';
