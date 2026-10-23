-- 크론 부하 정리 (2026-10-23 DB 응답 지연 장애 후속)
-- 1) cron.job_run_details가 5월부터 23만 건(142MB, DB의 약 87%)까지 쌓여 있었다 → 최근 7일만 보관
-- 2) hold-scheduler가 매분 net.http_post를 호출해 pg_net 응답 기록 정리 부담이 컸다 → 5분마다로 완화

delete from cron.job_run_details where end_time < now() - interval '7 days';

select cron.schedule(
  'purge-cron-history-daily',
  '0 18 * * *', -- 매일 03:00 KST
  $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$
);

select cron.alter_job(
  (select jobid from cron.job where jobname = 'hold-scheduler-job'),
  schedule := '*/5 * * * *'
);
