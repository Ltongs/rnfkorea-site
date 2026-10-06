-- 다이어리 "오늘 한 일" 행에서 "→ 내일"로 넘긴 경우, 생성된 내일 할 일(plan) 항목을 가리킨다.
-- 내일 할 일을 삭제하면 링크만 풀린다(on delete set null).
alter table secretary_diary_items
  add column if not exists forwarded_item_id bigint references secretary_diary_items(id) on delete set null;
