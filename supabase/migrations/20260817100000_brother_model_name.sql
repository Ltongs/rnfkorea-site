-- 현대지게차 경기북부판매: 기존 "톤수" 입력칸을 "모델명"으로 바꾸고, 별도 "톤수" 필드를 새로 추가
alter table public.brother_tasks
  add column if not exists model_name text;

comment on column public.brother_tasks.model_name is '지게차 모델명 (예: 25D-9A)';
comment on column public.brother_tasks.equipment_ton is '톤수 (예: 2.5톤)';
