-- 상담관리: D+30 알림 30일 스누즈 + 상담별 첨부파일(딜 확정 시 자동삭제)

alter table public.consultation_cases
  add column if not exists overdue_snoozed_until timestamptz;

create table if not exists public.consultation_attachments (
  id              bigint generated always as identity primary key,
  consultation_id bigint not null references public.consultation_cases(id) on delete cascade,
  file_name       text not null,
  storage_path    text not null,
  file_size       bigint,
  uploaded_by     text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_consultation_attachments_consultation_id
  on public.consultation_attachments(consultation_id);

alter table public.consultation_attachments enable row level security;
create policy consultation_attachments_internal_all on public.consultation_attachments
  for all using (public.is_internal_staff()) with check (public.is_internal_staff());
revoke all on public.consultation_attachments from anon;

insert into storage.buckets (id, name, public)
values ('consultation_attachments', 'consultation_attachments', false)
on conflict (id) do nothing;

create policy consultation_attachments_staff_all on storage.objects
  for all using (bucket_id = 'consultation_attachments' and public.is_internal_staff())
  with check (bucket_id = 'consultation_attachments' and public.is_internal_staff());
