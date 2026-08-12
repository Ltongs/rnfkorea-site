-- skip_sales_rep_alert 체크된 딜은 배성구 팀장(p2001103@hanmail.net) 본인에게는
-- 목록에서도 아예 보이지 않도록 RLS 레벨에서 차단한다. (admin/NH캐피탈/ORIX는 그대로 조회 가능)

create or replace function public.is_hcm_sales_rep()
returns boolean language sql stable as $$
  select coalesce((auth.jwt()->>'email'), '') = 'p2001103@hanmail.net';
$$;

drop policy if exists hyundaicm_tasks_select on public.hyundaicm_tasks;
create policy hyundaicm_tasks_select on public.hyundaicm_tasks for select
  using (
    public.is_hcm_viewer()
    and not (coalesce(skip_sales_rep_alert, false) and public.is_hcm_sales_rep())
  );

drop policy if exists hyundaicm_tasks_update on public.hyundaicm_tasks;
create policy hyundaicm_tasks_update on public.hyundaicm_tasks for update
  using (
    public.is_hcm_viewer()
    and not (coalesce(skip_sales_rep_alert, false) and public.is_hcm_sales_rep())
  )
  with check (
    public.is_hcm_viewer()
    and not (coalesce(skip_sales_rep_alert, false) and public.is_hcm_sales_rep())
  );
