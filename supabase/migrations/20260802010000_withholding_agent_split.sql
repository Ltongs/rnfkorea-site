-- 원천징수 관리: 원천징수자(甲, 지급주체)를 RNF Korea / 수Company 두 곳으로 구분한다.
-- 기존 등록된 수탁인은 전부 RNF Korea와 거래 중이므로 default 'RNF Korea'로 백필된다.
alter table tb_contractors
  add column if not exists withholding_agent text not null default 'RNF Korea'
    check (withholding_agent in ('RNF Korea', '수Company'));

-- 월별 집계 뷰: 원천징수자별로 분리 집계되도록 수탁인 테이블과 조인하고
-- withholding_agent를 그룹 기준에 추가한다 (기존 컬럼 구성/순서는 그대로 유지, 끝에 추가).
create or replace view v_withholding_monthly as
select
  date_trunc('month', p.pay_date::timestamp with time zone)::date as pay_month,
  to_char(p.pay_date::timestamp with time zone, 'YYYY-MM') as month_label,
  count(*) as count,
  sum(p.pay_amount) as total_pay,
  sum(p.withholding_amount) as total_withholding,
  sum(p.net_amount) as total_net,
  (date_trunc('month', p.pay_date::timestamp with time zone) + interval '1 mon' + interval '9 days')::date as due_date,
  c.withholding_agent
from tb_withholding_payments p
join tb_contractors c on c.id = p.contractor_id
group by
  date_trunc('month', p.pay_date::timestamp with time zone),
  to_char(p.pay_date::timestamp with time zone, 'YYYY-MM'),
  c.withholding_agent
order by date_trunc('month', p.pay_date::timestamp with time zone) desc;

-- 연간 집계 뷰: withholding_agent를 끝에 추가
create or replace view v_withholding_annual as
select
  extract(year from p.pay_date)::integer as pay_year,
  c.id as contractor_id,
  c.name,
  c.rrn_masked,
  count(*) as pay_count,
  sum(p.pay_amount) as annual_pay,
  sum(p.withholding_amount) as annual_withholding,
  sum(p.net_amount) as annual_net,
  c.withholding_agent
from tb_withholding_payments p
join tb_contractors c on c.id = p.contractor_id
group by extract(year from p.pay_date), c.id, c.name, c.rrn_masked, c.withholding_agent
order by extract(year from p.pay_date)::integer desc, sum(p.pay_amount) desc;
