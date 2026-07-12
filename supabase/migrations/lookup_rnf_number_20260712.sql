-- 일련번호(신규 RNF-YYMM-NNNNNN 또는 과거 legacy_no) 하나로 6개 업무 테이블을 가로질러
-- 해당 건을 찾아주는 통합 검색 함수. AI비서의 "번호검색" 탭에서 사용한다.

-- SECURITY DEFINER로 RLS를 우회해 6개 테이블을 전부 조회하므로, 반드시 관리자만 호출 가능해야
-- 한다(2026-07-12 보안 점검에서 확립한 is_admin_level() 원칙과 동일 — "로그인만 하면 전체 조회"를
-- 다시 열어주지 않도록 함수 안에서 직접 admin 여부를 검사한다).
create or replace function public.lookup_rnf_number(p_no text)
returns table (
  source text,
  label text,
  detail text,
  status text,
  created_at timestamptz,
  path text
)
language plpgsql
security definer
stable
as $function$
begin
  if not public.is_admin_level() then
    raise exception 'permission denied';
  end if;

  return query
  select '견적서/발주서'::text as source,
         coalesce(q.recipient, '-') as label,
         q.quote_no || case when q.legacy_no is not null and q.legacy_no <> q.quote_no then ' (구번호 ' || q.legacy_no || ')' else '' end as detail,
         q.quote_type as status,
         q.created_at,
         '/work/quotation'::text as path
  from public.tb_quotations q
  where q.quote_no = p_no or q.legacy_no = p_no

  union all
  select 'RentalOS 딜',
         coalesce(r.customer_name, '-'),
         r.deal_no || case when r.legacy_no is not null and r.legacy_no <> r.deal_no then ' (구번호 ' || r.legacy_no || ')' else '' end,
         r.status,
         r.created_at,
         '/rental-os'
  from public.rental_os_deals r
  where r.deal_no = p_no or r.legacy_no = p_no

  union all
  select '수출 문의',
         coalesce(e.company, '-') || coalesce(' · ' || nullif(e.name, ''), ''),
         e.ref_code || case when e.legacy_no is not null and e.legacy_no <> e.ref_code then ' (구번호 ' || e.legacy_no || ')' else '' end,
         e.status,
         e.created_at,
         '/work/secretary'
  from public.export_inquiries e
  where e.ref_code = p_no or e.legacy_no = p_no

  union all
  select '거래명세서',
         coalesce(s.customer_name, '-'),
         s.doc_no || case when s.legacy_no is not null and s.legacy_no <> s.doc_no then ' (구번호 ' || s.legacy_no || ')' else '' end,
         null,
         s.created_at,
         '/work/statement'
  from public.tb_transaction_statements s
  where s.doc_no = p_no or s.legacy_no = p_no

  union all
  select '현대건설기계 할부금융',
         coalesce(h.customer_name, '-'),
         h.case_no || case when h.legacy_no is not null and h.legacy_no <> h.case_no then ' (구번호 ' || h.legacy_no || ')' else '' end,
         h.status,
         h.created_at,
         '/hyundaicm'
  from public.hyundaicm_tasks h
  where h.case_no = p_no or h.legacy_no = p_no

  union all
  select '태산통운 할부금융',
         coalesce(x.customer_name, '-'),
         x.case_no || case when x.legacy_no is not null and x.legacy_no <> x.case_no then ' (구번호 ' || x.legacy_no || ')' else '' end,
         x.status,
         x.created_at,
         '/taesan'
  from public.taesan_tasks x
  where x.case_no = p_no or x.legacy_no = p_no;
end;
$function$;

-- 관리자만 쓰는 내부 검색 기능이므로 authenticated로 제한한다(공개 anon 불필요).
revoke all on function public.lookup_rnf_number(text) from public;
grant execute on function public.lookup_rnf_number(text) to authenticated;
