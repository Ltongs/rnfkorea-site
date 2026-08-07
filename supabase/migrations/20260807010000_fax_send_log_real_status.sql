-- 팩스는 SMS와 달리 발송이 비동기다. send-fax-campaign이 Solapi에 POST했을 때
-- 오는 응답은 "접수 완료"일 뿐 실제 수신기까지 도달했는지는 몇 초~몇십 초 후에야
-- 확정되는데, 지금까지는 이 접수 응답만 보고 곧바로 status='success'로 기록했다.
-- 실제로는 회선 문제 등으로 최종 실패한 건도 전부 "성공"으로 잘못 표시되고 있었음
-- (테스트로 직접 확인: statusCode 3048 "팩스 전송이 실패 처리 되었습니다").
--
-- fax_send_log에 실제 최종 상태를 담을 컬럼을 추가하고, 이미 "success"로 기록된
-- 행(솔라피가 메시지ID를 발급한 행)은 전부 "sent"(접수됨, 확인 전) 상태로 되돌려서
-- refresh-fax-status 함수가 실제 최종 결과로 다시 채우도록 한다.

alter table public.fax_send_log add column if not exists solapi_status_code text;
alter table public.fax_send_log add column if not exists status_checked_at timestamptz;

update public.fax_send_log
  set status = 'sent'
  where status = 'success' and solapi_message_id is not null;
