-- 다이어리 "돌아보기" 각 줄의 완료 표시. 완료 시각을 남기고, null이면 미완료.
alter table secretary_diary_items
  add column if not exists completed_at timestamptz;
