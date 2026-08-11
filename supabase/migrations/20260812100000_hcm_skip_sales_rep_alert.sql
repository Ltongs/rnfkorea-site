-- 현대CM 딜에서 특정 건은 영업사원(배성구)에게 알림톡이 가지 않도록 하는 admin 전용 체크박스
alter table public.hyundaicm_tasks
  add column if not exists skip_sales_rep_alert boolean not null default false;

comment on column public.hyundaicm_tasks.skip_sales_rep_alert is
  '체크 시 이 딜의 카카오 알림톡 발송에서 영업사원(배성구) 번호를 제외함. admin만 설정 가능(UI에서 admin에게만 노출).';
