-- 일정(secretary_schedules) 변경사항을 여러 기기(모바일/PC)에 실시간으로 반영하기 위해
-- 해당 테이블을 supabase_realtime publication에 추가한다.
alter publication supabase_realtime add table public.secretary_schedules;
