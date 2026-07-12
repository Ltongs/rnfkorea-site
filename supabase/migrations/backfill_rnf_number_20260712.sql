-- 과거에 각 사업부가 독립적으로 발급했던 번호(견적서 quote_no, RentalOS deal_no,
-- 수출문의 ref_code, 거래명세서 doc_no, 현대CM/태산통운 case_no)를 생성일자(created_at, KST) 기준으로
-- 6개 테이블을 하나로 합친 뒤 월별로 다시 순번을 매겨 RNF-YYMM-NNNNNN 형식으로 통일한다.
-- 기존에 고객에게 이미 전달됐을 수 있는 옛 번호는 legacy_no 컬럼에 그대로 보존해
-- 옛 번호로도 계속 검색할 수 있게 한다.

begin;

alter table public.tb_quotations add column if not exists legacy_no text;
alter table public.rental_os_deals add column if not exists legacy_no text;
alter table public.export_inquiries add column if not exists legacy_no text;
alter table public.tb_transaction_statements add column if not exists legacy_no text;
alter table public.hyundaicm_tasks add column if not exists legacy_no text;
alter table public.taesan_tasks add column if not exists legacy_no text;

update public.tb_quotations set legacy_no = quote_no where legacy_no is null and quote_no is not null;
update public.rental_os_deals set legacy_no = deal_no where legacy_no is null and deal_no is not null;
update public.export_inquiries set legacy_no = ref_code where legacy_no is null and ref_code is not null;
update public.tb_transaction_statements set legacy_no = doc_no where legacy_no is null and doc_no is not null;
update public.hyundaicm_tasks set legacy_no = case_no where legacy_no is null and case_no is not null;
update public.taesan_tasks set legacy_no = case_no where legacy_no is null and case_no is not null;

create temporary table tmp_rnf_numbering on commit drop as
with combined as (
  select 'tb_quotations'::text as tbl, id::text as id, created_at from public.tb_quotations
  union all
  select 'rental_os_deals', id::text, created_at from public.rental_os_deals
  union all
  select 'export_inquiries', id::text, created_at from public.export_inquiries
  union all
  select 'tb_transaction_statements', id::text, created_at from public.tb_transaction_statements
  union all
  select 'hyundaicm_tasks', id::text, created_at from public.hyundaicm_tasks
  union all
  select 'taesan_tasks', id::text, created_at from public.taesan_tasks
)
select
  tbl, id, created_at,
  to_char(created_at at time zone 'Asia/Seoul', 'YYMM') as ym,
  row_number() over (
    partition by to_char(created_at at time zone 'Asia/Seoul', 'YYMM')
    order by created_at, tbl, id
  ) as seq
from combined;

update public.tb_quotations t
set quote_no = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering n
where n.tbl = 'tb_quotations' and n.id = t.id::text;

update public.rental_os_deals t
set deal_no = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering n
where n.tbl = 'rental_os_deals' and n.id = t.id::text;

update public.export_inquiries t
set ref_code = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering n
where n.tbl = 'export_inquiries' and n.id = t.id::text;

update public.tb_transaction_statements t
set doc_no = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering n
where n.tbl = 'tb_transaction_statements' and n.id = t.id::text;

update public.hyundaicm_tasks t
set case_no = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering n
where n.tbl = 'hyundaicm_tasks' and n.id = t.id::text;

update public.taesan_tasks t
set case_no = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering n
where n.tbl = 'taesan_tasks' and n.id = t.id::text;

-- 이번 달(현재 진행 중이라 앞으로도 새 번호가 계속 발급될 달)만 카운터를 이어붙인다.
-- 이미 끝난 과거 달은 다시는 새 번호가 나올 일이 없으므로 카운터를 만들 필요가 없다.
insert into public.rnf_number_counters (ym, last_seq)
select ym, max(seq) from tmp_rnf_numbering
where ym = to_char(now() at time zone 'Asia/Seoul', 'YYMM')
group by ym
on conflict (ym) do update
  set last_seq = greatest(public.rnf_number_counters.last_seq, excluded.last_seq);

commit;
