-- 렌타나 타이어렌탈 업무페이지(/renthana/work) — RNF ↔ 렌타나 양사 공유 케이스.
--
-- 진행 단계(status):
--   draft(작성중) → submitted(심사요청) → approved(승인) / on_hold(보류) / rejected(부결)
--   on_hold → submitted(RNF 보완 후 재요청)
--   approved → installed(장착완료: 설치사진·보증서 첨부) → paid(대금지급 완료, 마무리)
--   paid·rejected 후 7일이 지나면 케이스 전체(고객정보·첨부·이력)를 자동 파기한다(6번 항목).
--
-- 사전 단계(1~3: 고객 기본정보·사업자등록증/차량등록증·견적서)가 모두 갖춰져야 submitted로,
-- 사후 단계(4: 설치사진·보증서)가 갖춰져야 installed로 넘어갈 수 있다 — 화면에서도 막지만
-- 우회 방지를 위해 아래 트리거에서 한 번 더 검사한다.
-- 단계가 바뀔 때마다 Postgres가 직접 send-renthana-kakao Edge Function을 호출한다
-- (narumi_new와 같은 이유: 브라우저 쪽 fetch는 탭 종료·네트워크 끊김으로 조용히 누락될 수 있음).

begin;

-- ============================================================
-- 0) 렌타나 담당자 계정 — lib/auth.tsx의 RENTHANA_EMAILS와 같은 목록으로 유지할 것
--    TODO: 렌타나 담당자 계정 생성 후 이메일을 여기에 추가
-- ============================================================
create or replace function public.is_renthana_partner()
returns boolean language sql stable as $$
  select lower(coalesce((auth.jwt()->>'email'), '')) = any (array[
    -- 예: 'manager@renthana.co.kr'
  ]::text[]);
$$;

create or replace function public.is_renthana_staff()
returns boolean language sql stable as $$
  select public.is_admin_level() or public.is_renthana_partner();
$$;

-- ============================================================
-- 1) 테이블
-- ============================================================
create table if not exists public.renthana_rental_cases (
  id              bigint generated always as identity primary key,
  case_no         text unique,                       -- 통합번호 RNF-YYMM-NNNNNN
  status          text not null default 'draft'
                  check (status in ('draft','submitted','approved','on_hold','rejected','installed','paid')),

  -- 1. 고객 기본정보
  customer_name   text not null,                     -- 대표자/담당자 이름
  customer_phone  text,
  company_name    text,                              -- 상호
  biz_no          text,                              -- 사업자등록번호

  -- 2. 차량 정보 (사업자등록증·차량등록증은 renthana_case_files로 첨부)
  vehicle_no      text,                              -- 차량번호 (여러 대면 쉼표 구분)
  vehicle_model   text,

  -- 3. 견적
  quote_no        text,                              -- 렌타나 계산기 견적번호(tb_quotations)
  tire_spec       text,                              -- 타이어 규격·브랜드
  tire_qty        integer,
  supply_price    numeric,                           -- 공급가격(VAT 제외)
  rental_months   integer check (rental_months in (12, 24)),
  monthly_fee     numeric,                           -- 월 렌탈료

  -- 4. 장착
  install_shop    text,
  install_date    date,

  -- 렌타나 심사 결과
  decision_note   text,                              -- 승인 조건 / 보류 사유·보완 요청 / 부결 사유
  decided_by      text,
  decided_at      timestamptz,

  -- 대금 지급
  paid_amount     numeric,
  paid_date       date,
  payment_note    text,

  special_note    text,
  submitted_at    timestamptz,
  installed_at    timestamptz,
  paid_at         timestamptz,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists renthana_rental_cases_status_idx on public.renthana_rental_cases (status, created_at desc);

create table if not exists public.renthana_case_files (
  id            bigint generated always as identity primary key,
  case_id       bigint not null references public.renthana_rental_cases(id) on delete cascade,
  kind          text not null
                check (kind in ('biz_reg','vehicle_reg','quote','install_photo','warranty','etc')),
  file_name     text not null,
  storage_path  text not null,                       -- renthana_docs 버킷 내 경로
  file_size     bigint,
  uploaded_by   text,
  created_at    timestamptz not null default now()
);
create index if not exists renthana_case_files_case_idx on public.renthana_case_files (case_id, kind);

create table if not exists public.renthana_case_history (
  id           bigint generated always as identity primary key,
  case_id      bigint not null references public.renthana_rental_cases(id) on delete cascade,
  event_type   text not null,                        -- created/status_change/edit/file_upload/file_delete/note
  from_status  text,
  to_status    text,
  note         text,
  created_by   text,
  created_at   timestamptz not null default now()
);
create index if not exists renthana_case_history_case_idx on public.renthana_case_history (case_id, created_at desc);

-- ============================================================
-- 2) 단계 전환 검사 — 누가, 어느 단계에서, 무엇이 갖춰졌을 때 넘어갈 수 있는지
-- ============================================================
create or replace function public.renthana_case_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin   boolean := public.is_admin_level();
  v_partner boolean := public.is_renthana_partner();
  v_email   text    := coalesce(auth.jwt()->>'email', '');
  v_kinds   text[];
begin
  NEW.updated_at := now();
  if NEW.status = OLD.status then
    return NEW;
  end if;

  select coalesce(array_agg(distinct kind), '{}') into v_kinds
    from public.renthana_case_files where case_id = NEW.id;

  -- RNF(관리자) 단계: 심사요청 / 보완 후 재요청 / 장착완료
  if NEW.status = 'submitted' then
    if not v_admin then raise exception '심사요청은 RNF만 할 수 있습니다.'; end if;
    if OLD.status not in ('draft', 'on_hold') then raise exception '작성중·보류 건만 심사요청할 수 있습니다.'; end if;
    if btrim(coalesce(NEW.customer_name, '')) = '' or btrim(coalesce(NEW.customer_phone, '')) = '' then
      raise exception '고객 이름과 전화번호를 입력해주세요.';
    end if;
    if not (v_kinds @> array['biz_reg','vehicle_reg','quote']) then
      raise exception '사업자등록증·차량등록증·견적서를 모두 첨부해야 심사요청할 수 있습니다.';
    end if;
    NEW.submitted_at := now();
    NEW.decided_at := null;
    NEW.decided_by := null;

  elsif NEW.status = 'installed' then
    if not v_admin then raise exception '장착완료는 RNF만 등록할 수 있습니다.'; end if;
    if OLD.status <> 'approved' then raise exception '승인된 건만 장착완료로 넘길 수 있습니다.'; end if;
    if not (v_kinds @> array['install_photo','warranty']) then
      raise exception '설치사진과 보증서를 모두 첨부해야 장착완료로 넘길 수 있습니다.';
    end if;
    NEW.installed_at := now();

  -- 렌타나 단계: 승인/보류/부결, 대금지급
  elsif NEW.status in ('approved', 'on_hold', 'rejected') then
    if not (v_partner or v_admin) then raise exception '심사 결과는 렌타나 담당자만 입력할 수 있습니다.'; end if;
    if OLD.status <> 'submitted' then raise exception '심사요청된 건만 승인·보류·부결할 수 있습니다.'; end if;
    if NEW.status in ('on_hold', 'rejected') and btrim(coalesce(NEW.decision_note, '')) = '' then
      raise exception '보류·부결 사유를 입력해주세요.';
    end if;
    NEW.decided_at := now();
    NEW.decided_by := v_email;

  elsif NEW.status = 'paid' then
    if not (v_partner or v_admin) then raise exception '대금지급은 렌타나 담당자만 처리할 수 있습니다.'; end if;
    if OLD.status <> 'installed' then raise exception '장착완료된 건만 대금지급 처리할 수 있습니다.'; end if;
    NEW.paid_at := now();

  -- 되돌리기(관리자 전용, 잘못 누른 경우 수습용)
  elsif NEW.status = 'draft' then
    if not v_admin then raise exception '작성중으로 되돌리기는 관리자만 할 수 있습니다.'; end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_renthana_case_guard on public.renthana_rental_cases;
create trigger trg_renthana_case_guard
  before update on public.renthana_rental_cases
  for each row execute function public.renthana_case_guard();

-- 렌타나 담당자는 심사결과·지급 관련 칸만 바꿀 수 있다(고객정보·견적은 RNF 관리).
create or replace function public.renthana_partner_column_guard()
returns trigger
language plpgsql
as $$
begin
  if public.is_renthana_partner() and not public.is_admin_level() then
    if (NEW.customer_name, NEW.customer_phone, NEW.company_name, NEW.biz_no, NEW.vehicle_no, NEW.vehicle_model,
        NEW.quote_no, NEW.tire_spec, NEW.tire_qty, NEW.supply_price, NEW.rental_months, NEW.monthly_fee,
        NEW.install_shop, NEW.install_date, NEW.special_note, NEW.case_no, NEW.created_by)
       is distinct from
       (OLD.customer_name, OLD.customer_phone, OLD.company_name, OLD.biz_no, OLD.vehicle_no, OLD.vehicle_model,
        OLD.quote_no, OLD.tire_spec, OLD.tire_qty, OLD.supply_price, OLD.rental_months, OLD.monthly_fee,
        OLD.install_shop, OLD.install_date, OLD.special_note, OLD.case_no, OLD.created_by) then
      raise exception '렌타나 담당자는 고객정보·견적 내용을 수정할 수 없습니다. RNF에 요청해주세요.';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_renthana_partner_column_guard on public.renthana_rental_cases;
create trigger trg_renthana_partner_column_guard
  before update on public.renthana_rental_cases
  for each row execute function public.renthana_partner_column_guard();

-- ============================================================
-- 3) 카카오 알림 — 단계가 바뀌면 서버에서 직접 발송 요청
--    본문에는 case_id와 이벤트만 담고, Edge Function이 DB에서 내용을 다시 읽어 발송한다
--    (anon key로 함수를 직접 호출해 임의 문구를 보내는 것을 막기 위함).
-- ============================================================
create or replace function public.notify_renthana_case()
returns trigger
language plpgsql
security definer
as $function$
declare
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5md3RzcHRxbG9lZnNicGp2ZHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MTM1NDIsImV4cCI6MjA4NzQ4OTU0Mn0.xMWMNwH79WNx_iMp05SUOpRFsZxtJ3ti_wu3cWf2gBE';
begin
  if NEW.status is distinct from OLD.status and NEW.status <> 'draft' then
    perform net.http_post(
      url := 'https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/send-renthana-kakao',
      headers := ('{"Content-Type":"application/json","Authorization":"Bearer ' || anon_key || '"}')::jsonb,
      body := jsonb_build_object(
        'caseId', NEW.id,
        'event', NEW.status,
        'resubmit', (NEW.status = 'submitted' and OLD.status = 'on_hold')
      )
    );
  end if;
  return NEW;
end;
$function$;

drop trigger if exists trg_notify_renthana_case on public.renthana_rental_cases;
create trigger trg_notify_renthana_case
  after update on public.renthana_rental_cases
  for each row execute function public.notify_renthana_case();

-- ============================================================
-- 4) RLS — RNF 관리자 + 렌타나 담당자만
-- ============================================================
alter table public.renthana_rental_cases  enable row level security;
alter table public.renthana_case_files    enable row level security;
alter table public.renthana_case_history  enable row level security;

-- 케이스: 조회·수정은 양사, 등록·삭제는 RNF만
create policy renthana_cases_select on public.renthana_rental_cases for select
  using (public.is_renthana_staff());
create policy renthana_cases_insert on public.renthana_rental_cases for insert
  with check (public.is_admin_level());
create policy renthana_cases_update on public.renthana_rental_cases for update
  using (public.is_renthana_staff()) with check (public.is_renthana_staff());
create policy renthana_cases_delete on public.renthana_rental_cases for delete
  using (public.is_admin_level());

-- 첨부: 양사 조회·업로드, 삭제는 RNF 또는 본인이 올린 파일
create policy renthana_files_select on public.renthana_case_files for select
  using (public.is_renthana_staff());
create policy renthana_files_insert on public.renthana_case_files for insert
  with check (public.is_renthana_staff());
create policy renthana_files_delete on public.renthana_case_files for delete
  using (public.is_admin_level() or (public.is_renthana_partner() and uploaded_by = auth.jwt()->>'email'));

-- 이력: 양사 조회·기록, 수정·삭제 불가(감사 기록)
create policy renthana_history_select on public.renthana_case_history for select
  using (public.is_renthana_staff());
create policy renthana_history_insert on public.renthana_case_history for insert
  with check (public.is_renthana_staff());

-- 2026-10-30부터 public 새 테이블은 권한을 명시해야 한다. anon은 주지 않는다.
revoke all on public.renthana_rental_cases, public.renthana_case_files, public.renthana_case_history from anon;
grant select, insert, update, delete on public.renthana_rental_cases to authenticated;
grant select, insert, delete          on public.renthana_case_files   to authenticated;
grant select, insert                  on public.renthana_case_history to authenticated;
grant all on public.renthana_rental_cases, public.renthana_case_files, public.renthana_case_history to service_role;

-- ============================================================
-- 5) Storage 버킷 (비공개)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('renthana_docs', 'renthana_docs', false)
on conflict (id) do nothing;

create policy renthana_docs_select on storage.objects for select
  using (bucket_id = 'renthana_docs' and public.is_renthana_staff());
create policy renthana_docs_insert on storage.objects for insert
  with check (bucket_id = 'renthana_docs' and public.is_renthana_staff());
create policy renthana_docs_delete on storage.objects for delete
  using (bucket_id = 'renthana_docs' and public.is_renthana_staff());

-- ============================================================
-- 6) 보관기간 — 지급완료(또는 부결) 후 7일이 지나면 케이스 전체 파기
--    고객정보·견적·첨부파일·이력 모두 같은 기간(D+7)으로 삭제한다.
--    화면(pages/Renthana/work/index.tsx RETENTION_DAYS)의 삭제 예정일 안내와 같은 기준으로 유지할 것.
-- ============================================================
create or replace function public.clear_expired_renthana_cases()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ids bigint[];
begin
  -- storage.objects의 protect_delete 트리거를 이 트랜잭션에서만 통과시킨다
  -- (20260821100000_fix_storage_delete_protection.sql 참고)
  perform set_config('storage.allow_delete_query', 'true', true);

  select coalesce(array_agg(id), '{}') into v_ids
    from public.renthana_rental_cases
   where (status = 'paid'     and paid_at    < now() - interval '7 days')
      or (status = 'rejected' and decided_at < now() - interval '7 days');

  if array_length(v_ids, 1) is null then
    return;
  end if;

  delete from storage.objects
   where bucket_id = 'renthana_docs'
     and name in (select storage_path from public.renthana_case_files where case_id = any(v_ids));

  -- 첨부·이력은 on delete cascade로 함께 삭제된다
  delete from public.renthana_rental_cases where id = any(v_ids);
end;
$function$;

revoke all on function public.clear_expired_renthana_cases() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'clear-renthana-cases-hourly') then
    perform cron.unschedule('clear-renthana-cases-hourly');
  end if;
end $$;

select cron.schedule(
  'clear-renthana-cases-hourly',
  '15 * * * *',
  $$select public.clear_expired_renthana_cases();$$
);

commit;
