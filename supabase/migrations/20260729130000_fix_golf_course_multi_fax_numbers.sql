-- golf_course_contacts.fax 필드에 팩스번호가 2개 이상 들어있던 10건 정리.
-- send-fax-campaign에서 fax를 숫자만 추출(replace(/[^0-9]/g, "")))해서 그대로 발신번호로
-- 쓰기 때문에, 한 필드에 번호가 여러 개 있으면 숫자가 이어붙어 완전히 잘못된 번호로
-- 발송될 위험이 있었음. 대표번호 1개만 fax에 남기고 나머지는 note에 보존한다.
-- (리앤리CC는 원본 엑셀 셀의 줄바꿈으로 "031-585"+"-4819"가 갈라져 있던 것으로,
--  실제로는 번호 1개("031-585-4819")였던 것을 하나로 합침 — 다른 9건과는 성격이 다름)

update public.golf_course_contacts set fax = '031-585-4819'
  where name = '리앤리CC' and region = '경기 가평군';

update public.golf_course_contacts
  set fax = '031-672-6011',
      note = '예약실 1588-7207 / 팩스 추가번호: 033-573-0876'
  where name = '파인크리크CC' and region = '경기 안성시';

update public.golf_course_contacts
  set fax = '031-589-9210',
      note = '팩스 추가번호: 031-640-0202'
  where name = '마이다스CC' and region = '경기 이천시';

update public.golf_course_contacts
  set fax = '031-539-5768',
      note = '예지실업 / 팩스 추가번호: 031-539-5723, 033-260-0147, 033-260-0134'
  where name = '베어크리크CC' and region = '경기 포천시';

update public.golf_course_contacts
  set fax = '031-585-7902',
      note = '팩스 확인 필요 / 팩스 추가번호: 031-585-7904'
  where name = '썬힐CC' and region = '경기 가평군';

update public.golf_course_contacts
  set fax = '055-379-0098',
      note = '주소/전화 확인 필요 / 팩스 추가번호: 055-379-0090, 055-379-0032'
  where name = '양산CC' and region = '경남 양산시';

update public.golf_course_contacts
  set fax = '055-382-9114',
      note = '주소/전화 확인 필요 / 팩스 추가번호: 055-370-1309'
  where name = '통도파인이스트' and region = '경남 양산시';

update public.golf_course_contacts
  set fax = '054-749-7373',
      note = '팩스 추가번호: 054-745-7777'
  where name = '경주신라CC' and region = '경북 경주시';

update public.golf_course_contacts
  set fax = '054-336-7678',
      note = '팩스 추가번호: 054-380-8080'
  where name = '영천오펠' and region = '경북 영천시';

update public.golf_course_contacts
  set fax = '054-336-9798',
      note = '27홀, 대중제 / 팩스 추가번호: 054-372-4646'
  where name = '오션힐스영천' and region = '경북 영천시';
