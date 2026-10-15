-- 견적서 발송 이력(tb_quotations)에 작성 당시 입력값 전체를 저장한다.
-- 기존에는 품목(items)·특기사항(notes)만 남아서, 불러오기 시 할인금액·계약금·할부조건·등록비용 등이
-- 기본값으로 바뀌는 문제가 있었다. 이 값이 있으면 불러오기/다운로드 때 그대로 복원한다.
alter table public.tb_quotations add column if not exists form_data jsonb;
