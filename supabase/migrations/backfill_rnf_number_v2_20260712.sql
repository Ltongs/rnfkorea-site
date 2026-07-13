-- 나르미(narumi_tasks)와 진흥주문(tb_orders)에도 통합 번호를 도입한다. 이 둘은 이전 소급변경
-- (backfill_rnf_number_20260712.sql)에 포함되지 않았었는데, 같은 달에 놓고 보면 시간순으로
-- 다른 업무 사이사이에 끼어들어가야 하므로 이미 배정된 번호들과 함께 전체를 다시 계산한다.
-- (이 세션 안에서 방금 배정된 번호라 아직 고객에게 실제로 전달된 적이 없어 다시 매겨도 안전하다.)

begin;

alter table public.narumi_tasks add column if not exists case_no text;
alter table public.narumi_tasks add column if not exists legacy_no text;
alter table public.tb_orders add column if not exists order_no text;
alter table public.tb_orders add column if not exists legacy_no text;

-- 나르미는 화면에 "#id"로 표시되던 것을, 진흥주문은 카카오 메시지 등에 쓰이던
-- "id 뒤 8자리" 표기를 그대로 legacy_no로 남겨 예전 방식으로도 검색되게 한다.
update public.narumi_tasks set legacy_no = '#' || id::text where legacy_no is null;
update public.tb_orders set legacy_no = upper(right(id::text, 8)) where legacy_no is null;

create temporary table tmp_rnf_numbering_v2 on commit drop as
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
  union all
  select 'narumi_tasks', id::text, created_at from public.narumi_tasks
  union all
  select 'tb_orders', id::text, created_at from public.tb_orders
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
from tmp_rnf_numbering_v2 n
where n.tbl = 'tb_quotations' and n.id = t.id::text;

update public.rental_os_deals t
set deal_no = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering_v2 n
where n.tbl = 'rental_os_deals' and n.id = t.id::text;

update public.export_inquiries t
set ref_code = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering_v2 n
where n.tbl = 'export_inquiries' and n.id = t.id::text;

update public.tb_transaction_statements t
set doc_no = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering_v2 n
where n.tbl = 'tb_transaction_statements' and n.id = t.id::text;

update public.hyundaicm_tasks t
set case_no = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering_v2 n
where n.tbl = 'hyundaicm_tasks' and n.id = t.id::text;

update public.taesan_tasks t
set case_no = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering_v2 n
where n.tbl = 'taesan_tasks' and n.id = t.id::text;

update public.narumi_tasks t
set case_no = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering_v2 n
where n.tbl = 'narumi_tasks' and n.id = t.id::text;

update public.tb_orders t
set order_no = 'RNF-' || n.ym || '-' || lpad(n.seq::text, 6, '0')
from tmp_rnf_numbering_v2 n
where n.tbl = 'tb_orders' and n.id = t.id::text;

insert into public.rnf_number_counters (ym, last_seq)
select ym, max(seq) from tmp_rnf_numbering_v2
where ym = to_char(now() at time zone 'Asia/Seoul', 'YYMM')
group by ym
on conflict (ym) do update
  set last_seq = greatest(public.rnf_number_counters.last_seq, excluded.last_seq);

commit;
