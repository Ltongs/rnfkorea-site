-- 팩스번호 필드에 번호가 2개 이상 있는 골프장(9곳)을 대표번호 1개만 쓰지 않고
-- 확인되는 모든 번호로 발송하도록 정책 변경. send-fax-campaign에서 fax 필드를
-- 정규식으로 파싱해 번호별로 각각 발송/기록하므로, 원래의 조합 문자열을 되돌리고
-- fax_send_log의 중복방지 유니크 제약을 (campaign_id, contact_id)에서
-- (campaign_id, contact_id, fax_number)로 완화해 골프장 1곳당 여러 건 로그를 허용한다.

update public.golf_course_contacts set fax = '031-672-6011, 033-573-0876', note = '예약실 1588-7207'
  where name = '파인크리크CC' and region = '경기 안성시';

update public.golf_course_contacts set fax = '031-589-9210, 031-640-0202', note = null
  where name = '마이다스CC' and region = '경기 이천시';

update public.golf_course_contacts set fax = '031-539-5768, 031-539-5723, 033-260-0147, 033-260-0134', note = '예지실업'
  where name = '베어크리크CC' and region = '경기 포천시';

update public.golf_course_contacts set fax = '031-585-7902, 031-585-7904', note = '팩스 확인 필요'
  where name = '썬힐CC' and region = '경기 가평군';

update public.golf_course_contacts set fax = '055-379-0098 / 055-379-0090 / 055-379-0032', note = '주소/전화 확인 필요'
  where name = '양산CC' and region = '경남 양산시';

update public.golf_course_contacts set fax = '055-382-9114 / 055-370-1309', note = '주소/전화 확인 필요'
  where name = '통도파인이스트' and region = '경남 양산시';

update public.golf_course_contacts set fax = '054-749-7373 / 054-745-7777', note = null
  where name = '경주신라CC' and region = '경북 경주시';

update public.golf_course_contacts set fax = '054-336-7678 054-380-8080', note = null
  where name = '영천오펠' and region = '경북 영천시';

update public.golf_course_contacts set fax = '054-336-9798 054-372-4646', note = '27홀, 대중제'
  where name = '오션힐스영천' and region = '경북 영천시';

drop index if exists fax_send_log_campaign_contact_uniq;
create unique index fax_send_log_campaign_contact_fax_uniq
  on public.fax_send_log (campaign_id, contact_id, fax_number);
