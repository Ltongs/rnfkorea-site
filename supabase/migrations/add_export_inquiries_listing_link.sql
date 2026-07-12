-- 수출 문의(export_inquiries)가 어떤 매물(export_listings)에 대한 문의인지 추적할 수 있도록 FK 추가.
-- 기존엔 상세페이지의 "견적 문의 →" 버튼이 ?ref=<id>&model=<name> 쿼리파라미터를 붙여 보내고 있었지만
-- ExportInquiryPage가 이 값을 읽지 않아 문의 테이블에 전혀 기록되지 않고 있었음.
alter table export_inquiries
  add column if not exists listing_id uuid references export_listings(id) on delete set null;

create index if not exists idx_export_inquiries_listing_id on export_inquiries(listing_id);
create index if not exists idx_export_inquiries_status on export_inquiries(status);
