-- 롯데오토리스 인센티브 관리: 원천징수(수탁인) 구조와 무관한 독립적인 계약별 인센티브 목록.
create table tb_lotte_lease_incentives (
  id uuid primary key default gen_random_uuid(),
  contract_date date not null,
  contract_no text,
  customer_name text not null,
  contract_amount numeric not null,
  collateral_set boolean not null default false,
  incentive_amount numeric not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_lotte_lease_incentives_updated_at
  before update on tb_lotte_lease_incentives
  for each row execute function set_updated_at();

alter table tb_lotte_lease_incentives enable row level security;

create policy lotte_lease_incentives_all on tb_lotte_lease_incentives
  for all
  using (auth.email() = ANY (ARRAY['admin@rnfkorea.co.kr'::text, 'ltongs7@gmail.com'::text, 'everyasset.fc@gmail.com'::text]))
  with check (auth.email() = ANY (ARRAY['admin@rnfkorea.co.kr'::text, 'ltongs7@gmail.com'::text, 'everyasset.fc@gmail.com'::text]));
