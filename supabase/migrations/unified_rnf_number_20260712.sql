-- 사업부마다 견적서(FL-/BT-/HL-/PO-), RentalOS 딜(RO-), 수출문의(EX-), 거래명세서(TS-)가
-- 각자 타임스탬프 끝자리·랜덤값으로 번호를 만들고 있어 실제로는 순서를 알 수 없었다.
-- (현대CM/태산통운 케이스번호는 이미 "연월-순번" 형태로 제대로 매겨지고 있었음 — 그 방식을
-- 회사 전체로 확장한다.)
-- 매달 초기화되는 단일 카운터를 모든 업무가 공유하는 RNF-YYMM-NNNNNN 형식으로 통일한다.
-- 기존에 이미 발급된 번호는 그대로 두고, 이 함수를 쓰기 시작하는 시점부터의 신규 건에만 적용된다.

create table if not exists public.rnf_number_counters (
  ym text primary key,
  last_seq integer not null default 0
);

alter table public.rnf_number_counters enable row level security;
revoke all on public.rnf_number_counters from anon, authenticated;

create or replace function public.next_rnf_number()
returns text
language plpgsql
security definer
as $function$
declare
  v_ym text := to_char(now() at time zone 'Asia/Seoul', 'YYMM');
  v_seq integer;
begin
  insert into public.rnf_number_counters as c (ym, last_seq)
  values (v_ym, 1)
  on conflict (ym) do update set last_seq = c.last_seq + 1
  returning c.last_seq into v_seq;

  return 'RNF-' || v_ym || '-' || lpad(v_seq::text, 6, '0');
end;
$function$;

-- 수출 문의 폼은 로그인 없이 접근하는 공개 화면이므로 anon도 호출 가능해야 한다.
-- 카운터 테이블 자체는 위에서 이미 anon/authenticated 접근을 막아뒀고, 이 함수(security definer)만
-- 통해서 번호를 발급받을 수 있다.
grant execute on function public.next_rnf_number() to anon, authenticated;

-- 현대CM/태산통운 케이스번호는 지금까지 저장 없이 화면에서 매번 재계산했는데,
-- 앞으로는 접수 시점에 실제 값을 저장해서 재계산에 의존하지 않게 한다.
alter table public.hyundaicm_tasks add column if not exists case_no text;
alter table public.taesan_tasks add column if not exists case_no text;
