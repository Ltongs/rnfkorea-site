-- 상품권 재고관리(구매·보유·지급) 신규 테이블.
-- 원천징수 지급내역(tb_withholding_payments)의 "상품권 포함" 체크와는 별개로,
-- 상품권 자체의 구매/보유/지급 이력을 추적하기 위한 원장(ledger) 테이블.
-- 현재 재고 = SUM(purchase.quantity) - SUM(distribution.quantity), 액면가별로 집계.

begin;

create table public.tb_gift_card_stock (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('purchase', 'distribution')),
  denomination integer not null check (denomination > 0),
  quantity integer not null check (quantity > 0),
  unit_price integer,
  total_amount integer not null default 0,
  vendor text,
  recipient_name text,
  contractor_id uuid references public.tb_contractors(id) on delete set null,
  withholding_payment_id uuid references public.tb_withholding_payments(id) on delete set null,
  reason text,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table public.tb_gift_card_stock enable row level security;

create policy gift_card_stock_all on public.tb_gift_card_stock
  for all
  using (auth.email() = 'admin@rnfkorea.co.kr')
  with check (auth.email() = 'admin@rnfkorea.co.kr');

create index idx_gift_card_stock_date on public.tb_gift_card_stock (entry_date desc);
create index idx_gift_card_stock_denom on public.tb_gift_card_stock (denomination);

commit;
