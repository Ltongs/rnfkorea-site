-- 나르미 신규 입력 시 카카오 알림이 오지 않는 문제 수정.
--
-- 원인: 카카오 발송이 전적으로 브라우저 쪽 fetch(sendNarumiKakao)에만 의존하고
-- 있어서, 등록 저장(narumi_tasks insert)은 성공해도 곧바로 이어지는 알림 요청은
-- 탭 전환/종료/네트워크 끊김 등으로 조용히 취소될 수 있었다(같은 시점에 실행되던
-- secretary_todos/secretary_schedules 자동등록도 함께 누락되는 것으로 확인됨 —
-- 두 작업 모두 저장 직후 이어지는 별개의 비동기 호출인데 동시에 빠졌다는 것은
-- 저장 이후 클라이언트 실행 자체가 끊겼다는 뜻).
--
-- 조치: tb_orders.notify_wheel_return()과 동일한 패턴(트리거 + net.http_post)으로
-- narumi_tasks INSERT/출고전환 UPDATE 시 Postgres가 직접 Edge Function을 호출하도록
-- 서버 쪽으로 옮긴다. 이러면 브라우저 상태와 무관하게 알림이 확실히 나간다.
-- (클라이언트 쪽 해당 sendNarumiKakao(type:"narumi_new") 호출은 pages/Narumi/index.tsx
-- 에서 함께 제거하여 중복 발송을 방지함. narumi_status/narumi_vehicle_doc/narumi_postal
-- 등 다른 알림 타입은 이번 수정 범위 밖이며 기존 클라이언트 방식을 유지함.)

begin;

create or replace function public.notify_narumi_new()
returns trigger
language plpgsql
security definer
as $function$
declare
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5md3RzcHRxbG9lZnNicGp2ZHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MTM1NDIsImV4cCI6MjA4NzQ4OTU0Mn0.xMWMNwH79WNx_iMp05SUOpRFsZxtJ3ti_wu3cWf2gBE';
begin
  perform net.http_post(
    url := 'https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/send-hyundaicm-kakao',
    headers := ('{"Content-Type":"application/json","Authorization":"Bearer ' || anon_key || '"}')::jsonb,
    body := jsonb_build_object(
      'type', 'narumi_new',
      'vin', case when NEW.is_plate_brokerage then '(번호판 중개 건)' else NEW.vin end,
      'customerName', NEW.customer_name,
      'salesRep', coalesce(NEW.sales_rep, '-'),
      'deliveryDate', coalesce(NEW.delivery_date_text, '-'),
      'specialNote', NEW.special_note
    )
  );
  return NEW;
end;
$function$;

drop trigger if exists trg_notify_narumi_new on public.narumi_tasks;
create trigger trg_notify_narumi_new
  after insert on public.narumi_tasks
  for each row execute function public.notify_narumi_new();

create or replace function public.notify_narumi_dispatch()
returns trigger
language plpgsql
security definer
as $function$
declare
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5md3RzcHRxbG9lZnNicGp2ZHl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MTM1NDIsImV4cCI6MjA4NzQ4OTU0Mn0.xMWMNwH79WNx_iMp05SUOpRFsZxtJ3ti_wu3cWf2gBE';
begin
  if NEW.is_dispatched = true and OLD.is_dispatched = false then
    perform net.http_post(
      url := 'https://nfwtsptqloefsbpjvdyu.supabase.co/functions/v1/send-hyundaicm-kakao',
      headers := ('{"Content-Type":"application/json","Authorization":"Bearer ' || anon_key || '"}')::jsonb,
      body := jsonb_build_object(
        'type', 'narumi_new',
        'vin', NEW.vin,
        'customerName', NEW.customer_name,
        'salesRep', coalesce(NEW.sales_rep, '-'),
        'deliveryDate', coalesce(NEW.delivery_date_text, '-'),
        'specialNote', '번호판 중개 건 → 출고 전환'
      )
    );
  end if;
  return NEW;
end;
$function$;

drop trigger if exists trg_notify_narumi_dispatch on public.narumi_tasks;
create trigger trg_notify_narumi_dispatch
  after update on public.narumi_tasks
  for each row execute function public.notify_narumi_dispatch();

commit;
