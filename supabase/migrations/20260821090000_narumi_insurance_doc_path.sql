-- 나르미 업무: 보험증권 첨부 기능 추가 (제작증과 동일한 방식 — vehicle_docs 버킷 재사용)
alter table narumi_tasks
  add column if not exists insurance_doc_path text;
