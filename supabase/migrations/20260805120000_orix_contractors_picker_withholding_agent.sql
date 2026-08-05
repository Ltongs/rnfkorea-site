-- 오릭스 인센티브 관리 화면에서 "지급대상(수탁인)"을 수익자 구분(수Company/이동수)에 맞는
-- 수탁인으로만 고를 수 있도록 제한하려면, 피커 뷰에 원천징수자(withholding_agent) 구분이
-- 필요하다. (수익자=수Company인데 원천징수자=RNF Korea인 수탁인을 지급대상으로 고르면,
-- "미지급→지급완료" 처리 시 생성되는 지급내역이 원천징수관리>수Company 탭이 아니라
-- RNF Korea 탭에 등록돼버려서 화면 간 표시가 어긋난다.)
drop view public.orix_contractors_picker_view;

create view public.orix_contractors_picker_view as
select id, name, withholding_agent
from public.tb_contractors
where is_active = true
  and (
    public.is_orix_admin()
    or public.is_orix_partner()
    or coalesce((auth.jwt()->>'email'), '') in ('admin@rnfkorea.co.kr','everyasset.fc@gmail.com')
  );

grant select on public.orix_contractors_picker_view to authenticated;
revoke all on public.orix_contractors_picker_view from anon;
