// pages/WorkManual/index.tsx
// 내부 업무페이지 전체 사용 매뉴얼 — 관리자 전용. 배경 CSS/구조는 별도 검토·승인된 정적 Artifact 원본을 그대로 이식했다.
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";

const MANUAL_CSS = `
:root{
  --bg:#f6f3ec;
  --surface:#ffffff;
  --surface-2:#efeadf;
  --ink:#16202c;
  --ink-muted:#57626f;
  --ink-faint:#88919a;
  --line:#e2ddd0;
  --line-strong:#cfc8b6;
  --navy:#0a192f;
  --navy-2:#13253f;
  --navy-ink:#eef2f6;
  --accent:#d9600f;
  --accent-ink:#7a3407;
  --accent-bg:#fbe6d4;
  --st-new:#3b6ea5; --st-new-bg:#e3edf6; --st-new-ink:#1c3f60;
  --st-prog:#b8791a; --st-prog-bg:#faedd7; --st-prog-ink:#6b4710;
  --st-done:#2f7d4f; --st-done-bg:#e1f0e6; --st-done-ink:#1a4a2f;
  --st-stop:#b23b3b; --st-stop-bg:#f8e3e3; --st-stop-ink:#6b2020;
  --radius:12px;
  --font-sans:"Noto Sans KR",-apple-system,"Malgun Gothic",sans-serif;
  --font-mono:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme:dark){
  :root{
    --bg:#111820; --surface:#182230; --surface-2:#1e2a3a;
    --ink:#e7ecf1; --ink-muted:#a7b2bf; --ink-faint:#75808d;
    --line:#2a3849; --line-strong:#3a4d63;
    --navy:#0a1420; --navy-2:#0d1926; --navy-ink:#e7ecf1;
    --accent:#ef7d2f; --accent-ink:#ffdcb8; --accent-bg:#3a2413;
    --st-new-bg:#1c2c3d; --st-new-ink:#8fb8dd;
    --st-prog-bg:#392c14; --st-prog-ink:#e0b567;
    --st-done-bg:#173324; --st-done-ink:#7fc79c;
    --st-stop-bg:#3a1c1c; --st-stop-ink:#e19696;
  }
}
:root[data-theme="dark"]{
  --bg:#111820; --surface:#182230; --surface-2:#1e2a3a;
  --ink:#e7ecf1; --ink-muted:#a7b2bf; --ink-faint:#75808d;
  --line:#2a3849; --line-strong:#3a4d63;
  --navy:#0a1420; --navy-2:#0d1926; --navy-ink:#e7ecf1;
  --accent:#ef7d2f; --accent-ink:#ffdcb8; --accent-bg:#3a2413;
  --st-new-bg:#1c2c3d; --st-new-ink:#8fb8dd;
  --st-prog-bg:#392c14; --st-prog-ink:#e0b567;
  --st-done-bg:#173324; --st-done-ink:#7fc79c;
  --st-stop-bg:#3a1c1c; --st-stop-ink:#e19696;
}
:root[data-theme="light"]{
  --bg:#f6f3ec; --surface:#ffffff; --surface-2:#efeadf;
  --ink:#16202c; --ink-muted:#57626f; --ink-faint:#88919a;
  --line:#e2ddd0; --line-strong:#cfc8b6;
  --navy:#0a192f; --navy-2:#13253f; --navy-ink:#eef2f6;
  --accent:#d9600f; --accent-ink:#7a3407; --accent-bg:#fbe6d4;
  --st-new-bg:#e3edf6; --st-new-ink:#1c3f60;
  --st-prog-bg:#faedd7; --st-prog-ink:#6b4710;
  --st-done-bg:#e1f0e6; --st-done-ink:#1a4a2f;
  --st-stop-bg:#f8e3e3; --st-stop-ink:#6b2020;
}
*{box-sizing:border-box;}
body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--font-sans);line-height:1.7;}
h1,h2,h3,h4{font-weight:500;text-wrap:balance;color:var(--ink);}
a{color:var(--accent);}
code,.mono{font-family:var(--font-mono);}
.layout{display:flex;max-width:1180px;margin:0 auto;align-items:flex-start;}
.side{position:sticky;top:0;align-self:flex-start;width:252px;flex-shrink:0;padding:2rem 1rem 2rem 1.5rem;height:100vh;overflow-y:auto;}
.side-head{padding:0 .5rem 1rem;}
.side-head .brand{font-size:13px;letter-spacing:.06em;color:var(--ink-faint);text-transform:uppercase;}
.side-head h1{font-size:18px;margin:.25rem 0 0;}
.side nav{display:flex;flex-direction:column;gap:2px;}
.side .grp{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-faint);margin:14px .5rem 4px;}
.side a{display:block;padding:6px 10px;border-radius:8px;color:var(--ink-muted);text-decoration:none;font-size:14px;}
.side a:hover{background:var(--surface-2);color:var(--ink);}
main{flex:1;min-width:0;padding:2rem 2.5rem 6rem;}
.hero{background:var(--navy);color:var(--navy-ink);border-radius:16px;padding:2rem 2.25rem;margin-bottom:2rem;}
.hero .eyebrow{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#f0b073;margin:0 0 .5rem;}
.hero h1{color:var(--navy-ink);font-size:26px;margin:0 0 .6rem;}
.hero p{color:#c3ceda;margin:0;max-width:60ch;font-size:15px;}
.legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:1.25rem;}
.pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:4px 10px;border-radius:999px;font-weight:500;}
.pill.new{background:var(--st-new-bg);color:var(--st-new-ink);}
.pill.prog{background:var(--st-prog-bg);color:var(--st-prog-ink);}
.pill.done{background:var(--st-done-bg);color:var(--st-done-ink);}
.pill.stop{background:var(--st-stop-bg);color:var(--st-stop-ink);}
section.page{background:var(--surface);border:0.5px solid var(--line);border-radius:16px;padding:2rem 2.25rem;margin-bottom:1.5rem;scroll-margin-top:1.5rem;}
section.page > .head{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;border-bottom:0.5px solid var(--line);padding-bottom:1.1rem;margin-bottom:1.1rem;}
section.page h2{font-size:20px;margin:0;display:flex;align-items:center;gap:10px;}
section.page h2 .icon{font-size:20px;}
.path{font-family:var(--font-mono);font-size:12.5px;background:var(--surface-2);color:var(--ink-muted);padding:3px 9px;border-radius:6px;white-space:nowrap;}
.meta-row{display:flex;flex-wrap:wrap;gap:1.4rem;font-size:13px;color:var(--ink-muted);margin-top:.5rem;}
.meta-row b{color:var(--ink);font-weight:500;}
section.page h3{font-size:15px;margin:1.6rem 0 .6rem;}
section.page p{margin:.5rem 0;color:var(--ink-muted);max-width:70ch;}
section.page p.lead{color:var(--ink);font-size:15.5px;}
.flow{display:flex;flex-wrap:wrap;align-items:center;gap:0;margin:.75rem 0 1rem;}
.flow .step{background:var(--surface-2);border:0.5px solid var(--line);border-radius:8px;padding:7px 13px;font-size:13.5px;font-weight:500;color:var(--ink);}
.flow .arrow{color:var(--ink-faint);padding:0 8px;font-size:14px;}
ul.tick{list-style:none;margin:.6rem 0;padding:0;display:grid;gap:8px;}
ul.tick li{position:relative;padding-left:20px;color:var(--ink-muted);font-size:14px;}
ul.tick li::before{content:"";position:absolute;left:2px;top:9px;width:6px;height:6px;border-radius:50%;background:var(--accent);}
ul.tick li b{color:var(--ink);font-weight:500;}
table{width:100%;border-collapse:collapse;font-size:13.5px;margin:.6rem 0;}
table caption{caption-side:top;text-align:left;font-size:12px;color:var(--ink-faint);margin-bottom:6px;}
th{text-align:left;color:var(--ink-faint);font-weight:500;font-size:11.5px;letter-spacing:.03em;text-transform:uppercase;padding:6px 10px;border-bottom:0.5px solid var(--line-strong);}
td{padding:9px 10px;border-bottom:0.5px solid var(--line);color:var(--ink-muted);vertical-align:top;}
td.k{color:var(--ink);font-weight:500;white-space:nowrap;}
.tblwrap{overflow-x:auto;}
.note{background:var(--accent-bg);color:var(--accent-ink);border-radius:10px;padding:.85rem 1rem;font-size:13.5px;margin:1rem 0;}
.note b{font-weight:500;}
.quick{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:1rem 0 0;}
.quick a{display:block;background:var(--surface);border:0.5px solid var(--line);border-radius:10px;padding:12px 14px;text-decoration:none;color:var(--ink);}
.quick a:hover{border-color:var(--line-strong);}
.quick .qname{font-size:14px;font-weight:500;display:flex;align-items:center;gap:7px;}
.quick .qwho{font-size:12px;color:var(--ink-faint);margin-top:3px;}
footer.end{text-align:center;color:var(--ink-faint);font-size:12.5px;padding:2rem 0 3rem;}
@media (max-width:900px){
  .layout{flex-direction:column;}
  .side{position:static;width:100%;height:auto;padding:1.25rem;}
  main{padding:0 1.25rem 4rem;}
}
`;

const MANUAL_BODY_HTML = `
<div class="layout">
  <aside class="side">
    <div class="side-head">
      <div class="brand">RNF Korea</div>
      <h1>업무 매뉴얼</h1>
    </div>
    <nav>
      <a href="#overview">개요 · 용어 통일</a>
      <div class="grp">공통 파이프라인</div>
      <a href="#callmanagement">상담관리</a>
      <a href="#secretary">AI비서</a>
      <a href="#financehub">매출/매입 관리</a>
      <a href="#dashboard">운영대시보드</a>
      <a href="#weeklyreview">주간리뷰</a>
      <div class="grp">사업부 전용 업무</div>
      <a href="#hyundaicm">현대건기(부산경남) 할부금융</a>
      <a href="#taesan">태산통운</a>
      <a href="#narumi">나르미</a>
      <a href="#rentalos">Rental_O/S</a>
      <a href="#export">수출장비</a>
      <div class="grp">참고</div>
      <a href="#roles">접근권한 요약표</a>
    </nav>
  </aside>

  <main>
    <div class="hero">
      <p class="eyebrow">Internal operations guide</p>
      <h1>RNF Korea 업무페이지 사용 매뉴얼</h1>
      <p>AI비서, 상담관리, 매출/매입 관리부터 현대건기(부산경남)·태산통운·나르미·Rental_O/S·수출까지, 사내 업무용 화면 전체를 한 곳에서 정리했습니다. 왼쪽 목차에서 필요한 화면으로 바로 이동하세요.</p>
      <div class="legend">
        <span class="pill new">● 접수 / 신규</span>
        <span class="pill prog">● 진행중</span>
        <span class="pill done">● 완료 / 확정</span>
        <span class="pill stop">● 취소 / 반려</span>
      </div>
    </div>

    <section class="page" id="overview">
      <div class="head"><h2><span class="icon">📖</span>개요 — 화면은 여러 개, 정의는 하나</h2></div>
      <p class="lead">RNF Korea의 업무페이지는 하나의 거대한 시스템이 아니라, 사업부마다 성격이 다른 여러 화면이 <b>상담관리 → 각 사업부 처리 화면 → 매출/매입 관리 → 대시보드·주간리뷰</b> 순서로 연결된 구조입니다. 화면은 여러 개지만, 아래 두 정의만은 모든 화면에서 동일하게 적용됩니다.</p>
      <h3>모든 화면에 공통으로 적용되는 정의</h3>
      <table>
        <thead><tr><th>용어</th><th>정의</th><th>적용 화면</th></tr></thead>
        <tbody>
          <tr><td class="k">매출</td><td>세금계산서가 실제로 발행된 건만 매출로 집계합니다 (<span class="mono">tax_invoice = true</span>). 계약이 됐거나 납품이 끝났어도 계산서가 안 나갔으면 매출에 안 잡힙니다.</td><td>운영대시보드 · 주간리뷰 · 매출/매입 관리</td></tr>
          <tr><td class="k">보험 완료</td><td>증권이 실제로 발급된 시점을 완료로 봅니다. 설계요청·상담중 단계는 완료가 아닙니다.</td><td>운영대시보드 · 주간리뷰 · AI비서 실적관리</td></tr>
          <tr><td class="k">타이어·배터리·지게차·수출 상담 4단계</td><td><span class="mono">계약 → 납품 → 계산서발행</span>(중간에 <span class="mono">취소</span> 가능). 상담관리와 AI비서가 같은 4단계 용어를 씁니다.</td><td>상담관리 · AI비서</td></tr>
          <tr><td class="k">할부금융(현대건기(부산경남)·태산통운) 6단계</td><td><span class="mono">접수 → 신용조회 → 승인/보완/거절 → 확정</span>. 확정만 실적으로 집계됩니다.</td><td>현대건기(부산경남) · 태산통운 · 운영대시보드 · 주간리뷰</td></tr>
          <tr><td class="k">문서/케이스 번호</td><td><span class="mono">RNF-YYMM-NNNNNN</span> 형식으로 회사 전체가 하나의 카운터를 공유합니다(매달 초기화). 견적서·거래명세서·RentalOS 딜·수출문의·현대건기(부산경남)/태산통운 케이스번호가 모두 이 방식입니다. 이 통일 이전에 발급된 번호는 예전 형식 그대로 남아있습니다.</td><td>견적서 · 거래명세서 · RentalOS · 수출문의 · 현대건기(부산경남) · 태산통운</td></tr>
        </tbody>
      </table>
      <h3>전체 흐름</h3>
      <div class="flow">
        <span class="step">① 상담 접수</span><span class="arrow">→</span>
        <span class="step">② 사업부 처리</span><span class="arrow">→</span>
        <span class="step">③ 매출/매입 등록</span><span class="arrow">→</span>
        <span class="step">④ 집계 확인</span>
      </div>
      <p>①은 <b>상담관리</b>(또는 AI비서 통합상담 탭)에서 받고, ②는 타이어·배터리·지게차는 AI비서 진흥주문 탭에서, 할부금융은 현대건기(부산경남)·태산통운 전용 화면에서, 등록대행은 나르미에서 각각 처리합니다. ③ 계산서발행 시점에 <b>매출/매입 관리</b>에 자동 또는 수동으로 반영되고, ④ 그 결과를 <b>운영대시보드</b>(현재 스냅샷)와 <b>주간리뷰</b>(주간 단위 흐름)에서 확인합니다.</p>
      <div class="quick">
        <a href="#callmanagement"><div class="qname">📞 상담관리</div><div class="qwho">/work/call-management</div></a>
        <a href="#secretary"><div class="qname">💬 AI비서</div><div class="qwho">/work/secretary</div></a>
        <a href="#financehub"><div class="qname">💵 매출/매입 관리</div><div class="qwho">/work/finance-hub</div></a>
        <a href="#dashboard"><div class="qname">📊 운영대시보드</div><div class="qwho">/work/dashboard</div></a>
        <a href="#weeklyreview"><div class="qname">📈 주간리뷰</div><div class="qwho">/work/weekly-review</div></a>
        <a href="#hyundaicm"><div class="qname">🏗 현대건기(부산경남) 할부금융</div><div class="qwho">/hyundaicm</div></a>
        <a href="#taesan"><div class="qname">🚚 태산통운</div><div class="qwho">/taesan</div></a>
        <a href="#narumi"><div class="qname">🚛 나르미</div><div class="qwho">/narumi</div></a>
        <a href="#rentalos"><div class="qname">🚐 Rental_O/S</div><div class="qwho">/rental-os</div></a>
        <a href="#export"><div class="qname">🌏 수출장비</div><div class="qwho">/export-shop</div></a>
      </div>
    </section>

    <section class="page" id="callmanagement">
      <div class="head">
        <h2><span class="icon">📞</span>상담관리</h2>
        <span class="path">/work/call-management</span>
      </div>
      <div class="meta-row"><span><b>접근권한</b> · 관리자, 나르미·롯데오토리스·보험전담 담당자</span></div>
      <p class="lead">타이어·배터리·지게차·금융·보험·수출, 6개 업종의 상담을 한 화면에서 접수하고 진행상황을 관리하는 화면입니다. 신규 고객 접촉의 첫 진입점입니다.</p>
      <h3>탭 구성</h3>
      <ul class="tick">
        <li><b>상담등록</b> — 신규 상담 접수. 업종(타이어/배터리/지게차/금융/보험/수출)을 먼저 고르면 그에 맞는 입력폼이 나옵니다.</li>
        <li><b>상담내역</b> — 접수된 전체 상담 목록. 업종·단계별로 필터링해서 볼 수 있고, 여기서 단계를 바꾸거나 매출로 연결합니다.</li>
        <li><b>사후관리</b> — "다음 연락 필요"로 체크된 건만 모아서 팔로우업 날짜순으로 보여줍니다.</li>
      </ul>
      <h3>단계 흐름</h3>
      <div class="flow"><span class="step">계약</span><span class="arrow">→</span><span class="step">납품</span><span class="arrow">→</span><span class="step">계산서발행</span></div>
      <p>보험은 예외로 <span class="mono">증권발급</span> 여부 하나로 완료를 판정합니다. 계산서발행 단계로 넘어가려면 세금계산서 이미지를 먼저 첨부해야 하고, 첨부 즉시 매출/매입 관리에도 자동으로 반영됩니다.</p>
      <table>
        <thead><tr><th>업종</th><th>입력 항목 예시</th><th>비고</th></tr></thead>
        <tbody>
          <tr><td class="k">타이어</td><td>차량정보, 타이어 규격(전/후), 유입경로</td><td>발주가 확정되면 진흥주문(AI비서)으로 자동 연동</td></tr>
          <tr><td class="k">배터리</td><td>차종, 전압, 용량(Ah), 수량</td><td></td></tr>
          <tr><td class="k">지게차</td><td>톤수, 형식, 판매방식</td><td></td></tr>
          <tr><td class="k">금융</td><td>금융사, 금융상품, 금액</td><td>하위구분에 "현대건기(부산경남)"·"태산통운"을 고르면 각 전용 화면 실적과 자동으로 구분 집계됩니다</td></tr>
          <tr><td class="k">보험</td><td>보험사, 보험종류</td><td>증권발급 시점에 완료 처리</td></tr>
          <tr><td class="k">수출</td><td>회사명, 지역</td><td></td></tr>
        </tbody>
      </table>
      <div class="note"><b>주의</b> — 수정 저장 시 회사명·지역 입력칸을 비워두면 기존 값이 지워지지 않고 유지됩니다(값이 있는데 굳이 비울 필요 없음). 이미 계산서발행된 건을 취소 처리하지 마세요 — 매출/매입 관리에 이미 반영된 금액과 어긋납니다.</div>
    </section>

    <section class="page" id="secretary">
      <div class="head">
        <h2><span class="icon">💬</span>AI비서</h2>
        <span class="path">/work/secretary</span>
      </div>
      <div class="meta-row"><span><b>접근권한</b> · 관리자 전용</span></div>
      <p class="lead">일정·메모부터 진흥 발주, 실적관리, 수출장비 매물까지 — 관리자가 하루 업무를 처리하는 메인 허브입니다. 상단 탭으로 이동합니다.</p>
      <h3>탭 구성</h3>
      <table>
        <thead><tr><th>탭</th><th>내용</th></tr></thead>
        <tbody>
          <tr><td class="k">💬 채팅</td><td>AI에게 자연어로 업무 지시(주문 등록, 일정 조회 등)</td></tr>
          <tr><td class="k">📅 일정</td><td>캘린더, 구글 캘린더 연동</td></tr>
          <tr><td class="k">📊 업무현황</td><td>전체 업무 진행 스냅샷</td></tr>
          <tr><td class="k">🗂 통합상담</td><td>상담관리와 별개로 관리자가 직접 빠르게 등록하는 상담 입력 (복잡한 업종은 상담관리로 안내)</td></tr>
          <tr><td class="k">📦 주문·상담</td><td>상담 건에 연결된 발주 현황</td></tr>
          <tr><td class="k">🏗 현대건기(부산경남) · 🚐 Rental_O/S</td><td>각 전용 페이지로 바로 이동(클릭 시 새 화면)</td></tr>
          <tr><td class="k">🔧 진흥주문</td><td>타이어 발주 처리 — 아래 별도 설명</td></tr>
          <tr><td class="k">🚛 나르미</td><td>나르미 전용 화면으로 이동</td></tr>
          <tr><td class="k">📋 견적서</td><td>배터리·지게차·할부금융 견적서 작성 및 발송(문자/이메일)</td></tr>
          <tr><td class="k">📈 실적관리</td><td>업종별 확정 실적을 기간별로 모아보기 — 아래 별도 설명</td></tr>
          <tr><td class="k">🌏 수출장비</td><td>수출 매물 등록·문의 확인 — 아래 별도 설명</td></tr>
          <tr><td class="k">💵 매출/매입</td><td>매출/매입 관리 화면으로 이동</td></tr>
          <tr><td class="k">📧 이메일 · 📝 메모</td><td>수신 이메일 요약, 자유 메모</td></tr>
        </tbody>
      </table>
      <h3>🔧 진흥주문 탭 — 타이어 발주 처리</h3>
      <p>타이어 상담이 발주로 이어지면 이 탭에 뜹니다. 진흥(공급사)에 발주를 넣은 건(카톡 웹훅으로 자동 접수되는 경우 포함)과 상담관리에서 넘어온 건이 <b>날짜순으로 한 목록</b>에 섞여 표시됩니다. 상담과 연결이 안 된 발주에는 <span class="mono">상담 연결 없음</span> 배지가, 아직 진흥에 발주가 안 나간 상담에는 <span class="mono">진흥주문 미등록</span> 배지가 붙는데 둘 다 정상적인 케이스입니다(오류 아님).</p>
      <div class="flow"><span class="step">접수(진흥전달)</span><span class="arrow">→</span><span class="step">발송(납품완료)</span><span class="arrow">→</span><span class="step">계산서발행</span><span class="arrow">→</span><span class="step">종결</span></div>
      <p>"종결"이 되려면 <b>납품완료 + 휠반납 + 매출건 연결</b> 세 가지가 다 있어야 합니다. 계산서발행만으로는 종결이 안 됩니다 — 휠반납 체크와 매출연결까지 마쳐야 목록에서 완료로 표시됩니다.</p>
      <h3>📈 실적관리 탭</h3>
      <p>타이어·배터리·지게차·금융(기타)·보험·현대건기(부산경남)·태산통운·나르미·Rental_O/S의 <b>확정된 실적만</b> 기간별로 모아 보여줍니다. 여기 나오는 숫자는 대시보드·주간리뷰와 같은 기준(매출=계산서 발행, 보험=증권발급)으로 계산되니 서로 다르게 보이면 기간 설정을 먼저 확인하세요.</p>
      <h3>🌏 수출장비 탭</h3>
      <p>굴삭기·지게차·고소작업대 매물을 등록/수정하고, <b>매출연결</b>이 아니라 <b>문의 내역</b>을 확인하는 두 가지 뷰를 토글로 전환합니다. 문의 내역은 대기/연락완료/종결 3단계로 처리 상태를 남길 수 있고, 문의가 어떤 매물에서 들어왔는지 배지로 표시됩니다.</p>
    </section>

    <section class="page" id="financehub">
      <div class="head">
        <h2><span class="icon">💵</span>매출/매입 관리</h2>
        <span class="path">/work/finance-hub</span>
      </div>
      <div class="meta-row"><span><b>접근권한</b> · 관리자 전용</span></div>
      <p class="lead">확정된 매출·매입 건을 실제로 등록·관리하는 회계 화면입니다. 세금계산서가 발행된 건만 매출로 잡히는 원칙이 이 화면에서 시작됩니다.</p>
      <h3>탭 구성</h3>
      <table>
        <thead><tr><th>탭</th><th>내용</th></tr></thead>
        <tbody>
          <tr><td class="k">매출 / 매입</td><td>기간별 매출·매입 목록. 거래처, 품목, 금액, 계산서 발행 여부, 입금 확인 여부를 관리</td></tr>
          <tr><td class="k">⚠ 보완필요</td><td>종류가 "기타"로 분류되었거나 정보가 불완전한 건 — 거래처별로 묶어서 종류를 확정해줘야 정식 집계에 들어갑니다</td></tr>
          <tr><td class="k">미청구 확인대기</td><td>지게차·금융·보험 중 완료/확정 단계인데 매출로 등록된 흔적이 안 보이는 건을 거래처명 기준으로 자동으로 찾아 보여줍니다</td></tr>
        </tbody>
      </table>
      <h3>주요 기능</h3>
      <ul class="tick">
        <li><b>계산서 업로드</b> — 세금계산서 이미지를 올리면 내용을 자동 인식해서 기존 매출건과 매칭하거나 신규 등록합니다.</li>
        <li><b>엑셀 일괄등록</b> — 홈택스에서 내려받은 엑셀을 그대로 올리면 매출/매입을 자동 구분해서 일괄 등록합니다.</li>
        <li><b>진흥주문 연결</b> — 매출건 하나에 실제 발주(타이어/배터리/수출 상담 포함)를 연결해 종결 처리합니다. 이미 다른 매출건에 연결된 발주는 선택할 수 없습니다.</li>
        <li><b>+ 신규 매출/매입</b> — 수동 입력. "미청구 확인대기" 카드의 버튼을 누르면 거래처명이 미리 채워진 채로 열립니다.</li>
      </ul>
      <div class="note"><b>미청구 확인대기는 근사치입니다</b> — 거래처명 표기가 조금만 달라도("(주)"유무 등) 이미 등록된 매출이 다시 뜰 수 있습니다. 버튼을 누르기 전에 매출 탭에서 먼저 검색해보세요.</div>
    </section>

    <section class="page" id="dashboard">
      <div class="head">
        <h2><span class="icon">📊</span>운영대시보드</h2>
        <span class="path">/work/dashboard</span>
      </div>
      <div class="meta-row"><span><b>접근권한</b> · 관리자 전용</span></div>
      <p class="lead">지금 시점의 스냅샷을 한눈에 보는 화면입니다. 월간/누적(YTD) 매출, 금융 확정금액(현대건기(부산경남)·태산통운·기타금융 합계), 진흥주문 현황 등을 KPI 카드로 보여줍니다.</p>
      <p>모든 숫자는 개요에서 설명한 공통 정의(매출=세금계산서 발행 기준)를 따르므로, 계약·상담 단계 건은 여기 안 잡힙니다. "지금 얼마나 확정됐는가"를 보는 화면이지 파이프라인 전체를 보는 화면은 아닙니다 — 진행중인 상담 전체 흐름은 상담관리에서 확인하세요.</p>
    </section>

    <section class="page" id="weeklyreview">
      <div class="head">
        <h2><span class="icon">📈</span>주간리뷰</h2>
        <span class="path">/work/weekly-review</span>
      </div>
      <div class="meta-row"><span><b>접근권한</b> · 관리자 전용</span></div>
      <p class="lead">이번 주(월~일) 동안 상담·확정·발주·납품이 얼마나 있었는지 업종별로 정리한 주간 보고 화면입니다.</p>
      <ul class="tick">
        <li><b>매출(품목별)</b> — 대시보드와 동일하게 세금계산서 발행 기준</li>
        <li><b>취급액</b> — 세금계산서 발행 전이라도 이번 주에 확정된 금액(예: 현대건기(부산경남)·태산통운 확정 건)까지 포함한 별도 지표. 매출과 헷갈리지 않도록 두 숫자를 나란히 봅니다</li>
        <li><b>상담/확정/납품 건수</b> — 업종별 이번 주 처리 건수</li>
      </ul>
      <p>월요일 아침에 지난주 실적을 빠르게 훑어볼 때 쓰는 화면입니다.</p>
    </section>

    <section class="page" id="hyundaicm">
      <div class="head">
        <h2><span class="icon">🏗</span>현대건기(부산경남) 할부금융</h2>
        <span class="path">/hyundaicm</span>
      </div>
      <div class="meta-row"><span><b>접근권한</b> · 관리자, 현대건기(부산경남) 담당자, NH캐피탈 담당자·직원</span></div>
      <p class="lead">HD현대건기 부산/경남 대리점이 판매하는 중고 굴삭기 등 건설장비의 할부금융 승인 절차를 처리하는 전용 화면입니다. 화면 코드에 보험·수출 관련 흔적이 남아있지만 <b>실제로는 할부금융 업무만</b> 다룹니다 — 보험·수출 상담은 상담관리로 접수하세요.</p>
      <div class="flow"><span class="step">접수</span><span class="arrow">→</span><span class="step">신용조회</span><span class="arrow">→</span><span class="step">승인 / 보완 / 거절</span><span class="arrow">→</span><span class="step">확정</span></div>
      <p>단계는 <b>한 번에 한 단계씩만</b> 전진하며 건너뛸 수 없습니다. 되돌리기(이전 단계로)는 관리자만 가능합니다. 확정된 건만 실적(대시보드·주간리뷰의 "금융 확정금액")에 잡힙니다 — 이 업무는 중개수수료 구조라 세금계산서를 직접 발행하지 않으므로, 매출/매입 관리가 아니라 이 화면의 확정 건수·금액으로 실적을 확인합니다.</p>
      <h3>서류 업로드 — 역할별로 가능한 범위가 다릅니다</h3>
      <div class="tblwrap">
      <table>
        <thead><tr><th>서류</th><th>업로드</th><th>다운로드/열람</th><th>보관기간</th></tr></thead>
        <tbody>
          <tr><td class="k">신분증·사업자등록증·통장사본 등 기본서류</td><td>관리자, NH캐피탈 담당자(파트너)</td><td>조회 권한자 전체</td><td>확정 후 <b>24시간</b></td></tr>
          <tr><td class="k">차량등록증</td><td>관리자, 현대건기(부산경남) 담당자, NH캐피탈 담당자</td><td>관리자, NH캐피탈 담당자·직원 — <b style="color:var(--st-stop-ink)">업로드한 현대건기(부산경남) 담당자 본인은 다운로드 불가</b></td><td>확정 후 <b>72시간</b></td></tr>
          <tr><td class="k">세금계산서</td><td>관리자, 현대건기(부산경남) 담당자</td><td>조회 권한자 전체(제한 없음)</td><td>확정 후 <b>72시간</b></td></tr>
        </tbody>
      </table>
      </div>
      <p>고객 전화번호도 확정 후 24시간이 지나면 뒷자리가 자동 마스킹됩니다. 자동삭제는 매시간 실행되는 배치가 실제로 파일을 지우는 방식이라, 필요한 서류는 삭제 전에 반드시 받아두세요.</p>
      <h3>그 외 기능</h3>
      <ul class="tick">
        <li><b>보류(재통화 예약)</b> — 재통화 예정일시·담당자·메모를 남기면 카카오 알림이 즉시 발송됩니다.</li>
        <li><b>상환표</b> — 원금·금리·기간이 채워진 건은 상환스케줄을 계산해 PDF/이미지로 받거나 고객에게 SMS로 바로 보낼 수 있습니다.</li>
        <li><b>인센티브 지급</b> — 확정 후 관리자만 처리하는 1회성 버튼입니다.</li>
      </ul>
      <div class="note"><b>알림톡 자동 발송</b> — 접수/상태변경/수정/보류/서류업로드/인센티브지급 시점마다 관계자에게 카카오 알림톡(실패 시 SMS)이 자동으로 갑니다. 화면 우측 상단 톱니바퀴의 "카카오톡 알림 설정" 화면은 <b>실제 알림 발송과 무관</b>합니다 — 연결하지 않아도 알림은 정상적으로 발송되니 신경 쓰지 않아도 됩니다.</div>
    </section>

    <section class="page" id="taesan">
      <div class="head">
        <h2><span class="icon">🚚</span>태산통운</h2>
        <span class="path">/taesan</span>
      </div>
      <div class="meta-row"><span><b>접근권한</b> · 관리자, 태산통운 담당자</span></div>
      <p class="lead">태산통운 소속 차주가 구매하는 화물차(카고/윙바디 특장차)의 할부금융 승인 절차를 처리합니다. 화면 구조는 현대건기(부산경남)과 같지만, <b>태산통운 담당자 계정의 권한이 훨씬 제한적</b>입니다.</p>
      <div class="flow"><span class="step">접수</span><span class="arrow">→</span><span class="step">신용조회</span><span class="arrow">→</span><span class="step">승인 / 보완 / 거절</span><span class="arrow">→</span><span class="step">확정</span></div>
      <h3>태산통운 담당자 계정이 할 수 있는 일 / 없는 일</h3>
      <ul class="tick">
        <li><b>가능</b> — 신규 건 접수 등록, 기본서류 첨부, 차량등록증·세금계산서(지입사 사업자등록증) <b>다운로드</b></li>
        <li><b>불가능</b> — 상태 변경(신용조회 진행·승인/보완/거절·확정 처리 전부), 기존 정보 수정, 삭제, 차량등록증·세금계산서 <b>업로드</b></li>
      </ul>
      <p>즉 태산통운 담당자가 신규 건을 등록하면, 그 이후 진행(신용조회 → 승인/보완/거절 → 확정)은 반드시 <b>관리자</b>가 처리해야 합니다. 접수만 해두고 방치되지 않도록 관리자가 주기적으로 확인이 필요합니다.</p>
      <p>입력 항목은 화물차 특성에 맞게 메이커·톤수·연식·특장(윙바디/카고)이 추가로 있고, 부가세 후불 개념은 없습니다. 확정 처리 화면도 현대건기(부산경남)보다 간소화되어 대출원금만 재확인하면 됩니다. <b>인센티브 지급 기능은 이 화면에는 없습니다.</b></p>
      <div class="note">기본서류·전화번호는 <b>확정 후 24시간</b>, 차량등록증·지입사 사업자등록증은 <b>업로드 후 72시간</b> 지나면 매시간 자동으로 실제 삭제·마스킹됩니다(현대건기(부산경남)과 동일한 방식). 필요한 서류는 기한 전에 미리 받아두세요. (톱니바퀴의 카카오 알림 설정 버튼은 현재 연결된 화면이 없어 눌러도 반응이 없을 수 있지만, 실제 알림 발송에는 영향 없습니다.)</div>
    </section>

    <section class="page" id="narumi">
      <div class="head">
        <h2><span class="icon">🚛</span>나르미</h2>
        <span class="path">/narumi</span>
      </div>
      <div class="meta-row"><span><b>접근권한</b> · 관리자, 보험전담, 나르미모터스 담당자, 롯데오토리스 담당자</span></div>
      <p class="lead">나르미모터스를 통해 판매된 차량의 등록 대행 업무를 관리합니다. 4개 역할이 같은 화면을 보지만 <b>할 수 있는 작업 범위가 역할마다 크게 다릅니다</b> — 가장 헷갈리기 쉬운 부분이니 먼저 확인하세요.</p>
      <div class="tblwrap">
      <table>
        <thead><tr><th>역할</th><th>신규 접수</th><th>진행단계 변경</th><th>차량등록증 업로드</th><th>조회 범위</th></tr></thead>
        <tbody>
          <tr><td class="k">관리자 · 보험전담</td><td>✅</td><td>✅</td><td>✅</td><td>전체</td></tr>
          <tr><td class="k">나르미모터스</td><td>✅ (접수만)</td><td>❌</td><td>❌</td><td>전체(단, 업로드 30일 지난 건 제외)</td></tr>
          <tr><td class="k">롯데오토리스</td><td>❌</td><td>❌</td><td>❌</td><td><b>자사 담당 건만</b> — 조회 전용</td></tr>
        </tbody>
      </table>
      </div>
      <p>나르미모터스 담당자는 "접수 등록" 버튼만 쓸 수 있고, 이후 보험 확인·서류 체크·등록완료 처리·차량등록증 업로드는 전부 관리자 또는 보험전담이 처리해야 합니다.</p>
      <div class="flow"><span class="step">접수</span><span class="arrow">→</span><span class="step">보험</span><span class="arrow">→</span><span class="step">등록서류</span><span class="arrow">→</span><span class="step">등록완료</span><span class="arrow">→</span><span class="step">차량등록증 업로드</span></div>
      <ul class="tick">
        <li><b>보험 단계</b> — "당사에서 가입하나요?"에 <b>Y</b>를 누르면 상담관리의 보험 상담등록 화면으로 자동 이동합니다(고객정보 자동 입력). <b>N</b>이면 그 자리에서 바로 완료 처리됩니다. 이 단계는 카카오 알림이 가지 않습니다.</li>
        <li><b>차량등록증 업로드</b> — 보험·서류·등록완료 3단계가 모두 끝나야 버튼이 열립니다. 업로드하는 순간 그 건은 <b>완전히 잠기고</b>(더 이상 수정·상태변경 불가), 먼저 첨부돼 있던 제작증 파일은 자동 삭제됩니다. 업로드 전에 정보가 맞는지 반드시 확인하세요.</li>
        <li><b>우편발송</b> — 등록완료 이후에만 입력 가능. 등기번호를 저장하면 우체국 조회 링크가 바로 뜹니다.</li>
        <li><b>보류</b> — 등록완료 전 단계에서 토글 가능. 보류/해제는 카카오 알림이 가지 않습니다.</li>
      </ul>
      <h3>개인정보 보관 정책 (매시간 자동 실행)</h3>
      <table>
        <thead><tr><th>항목</th><th>보관 기준</th></tr></thead>
        <tbody>
          <tr><td class="k">고객 전화번호</td><td>입력 후 <b>120시간(5일)</b> 경과 시 뒷 4자리를 영구 마스킹(되돌릴 수 없음). 번호를 수정하면 타이머가 다시 시작됩니다</td></tr>
          <tr><td class="k">차량등록증 파일</td><td>업로드 후 <b>30일</b>까지는 목록에 노출, 30일 지나면 파일 자체를 실제로 삭제(관리자는 "오래된 완료 건 포함" 옵션으로 계속 열람 가능)</td></tr>
        </tbody>
      </table>
      <div class="note">두 정책 모두 별도 조작 없이 자동 실행됩니다. 급하게 필요한 자료는 기한 전에 미리 받아두세요. 알림톡은 접수·등록서류·등록완료·차량등록증 업로드·우편발송 시점에 <b>관리자 번호로만</b> 발송됩니다(나르미모터스·롯데오토리스 계정으로는 가지 않습니다).</div>
    </section>

    <section class="page" id="rentalos">
      <div class="head">
        <h2><span class="icon">🚐</span>Rental_O/S (렌탈 딜 아웃소싱)</h2>
        <span class="path">/rental-os</span>
      </div>
      <div class="meta-row"><span><b>접근권한</b> · 관리자, RentalOS 파트너 담당자(1개 계정)</span></div>
      <p class="lead">렌탈 딜을 외부 협력사에 연결·중개하는 딜을 등록하고 진행상황을 추적하는 미니 CRM입니다. 접근 가능한 계정이 가장 적지만, <b>그 파트너 계정도 관리자와 동일하게 삭제까지 포함한 전체 권한</b>을 갖습니다.</p>
      <div class="flow"><span class="step">접수</span><span class="arrow">→</span><span class="step">진행중</span><span class="arrow">→</span><span class="step">확정 / 반려</span></div>
      <ul class="tick">
        <li>신규 등록 시 딜 번호(<span class="mono">RNF-YYMM-NNNNNN</span>, 회사 전체 공유 통합번호)가 자동으로 매겨집니다.</li>
        <li>"반려" 처리 시 사유 입력이 필수입니다.</li>
        <li>확정/반려로 종료된 딜을 다시 진행중으로 되돌리는 <b>재오픈은 관리자만</b> 가능합니다.</li>
        <li>첨부파일·상태변경·메모 이력은 딜 카드 안의 히스토리 타임라인에 전부 자동으로 남습니다.</li>
        <li>딜을 삭제하면 첨부파일까지 함께 완전히 삭제되며 <b>복구할 수 없습니다.</b></li>
      </ul>
      <div class="note"><b>알림은 신규 등록 시에만</b> 관리자 번호로 발송되고, 상태변경·수정·파일첨부 시에는 알림이 가지 않습니다. 또한 전용 알림 템플릿이 아직 없어 현대건기(부산경남) 템플릿을 재사용 중이라 메시지 항목명이 "금융사"/"할부원금"처럼 할부금융 용어로 표시됩니다(내용 자체는 정상 발송이니 문구만 참고). 업무시간(평일 09~19시) 외에 등록된 건은 다음 영업일 09시에 모아서 발송됩니다.</div>
    </section>

    <section class="page" id="export">
      <div class="head">
        <h2><span class="icon">🌏</span>수출장비</h2>
        <span class="path">/export-shop</span>
      </div>
      <div class="meta-row"><span><b>접근권한</b> · 매물 등록: 관리자·현대건기(부산경남) 담당자 / 문의 확인: AI비서 접근 권한자</span></div>
      <p class="lead">고객이 직접 보는 <b>공개 쇼핑몰</b>과, 담당자가 매물을 등록하고 문의를 확인하는 <b>내부 관리</b> 두 부분으로 나뉩니다. 다른 업무와 달리 로그인 없이 접근하는 공개 페이지가 절반을 차지합니다.</p>
      <h3>공개 쇼핑몰 (고객용, 로그인 불필요)</h3>
      <p>굴삭기·지게차·고소작업대 매물을 카테고리별로 둘러보고, 매물 상세의 "Request Quote →"를 누르면 해당 매물 정보가 자동으로 채워진 문의 폼(<span class="mono">/export-shop/inquiry</span>)으로 이동합니다. 상세 모달의 "🔗 공유" 버튼은 그 매물로 바로 스크롤·강조되는 링크를 복사합니다.</p>
      <h3>내부 관리 (AI비서 › 수출장비 탭)</h3>
      <p>매물 등록/수정과 별개로, 문의 내역을 <span class="mono">대기 → 연락완료 → 종결</span>로 처리 상태를 남길 수 있습니다. 어떤 문의가 어떤 매물에서 들어왔는지 배지로 표시되니 응답할 때 매물 정보를 다시 물어볼 필요가 없습니다. 매물 등록 시 한국어 설명만 입력하면 영문 설명이 자동 번역되는데, 저장 전 "미리 번역 확인" 버튼으로 한 번 검토하는 걸 권장합니다.</p>
      <div class="note">
        <b>매물이 공개 쇼핑몰에 안 보일 때 확인할 것</b>
        <ul class="tick" style="margin-top:8px;">
          <li><b>카테고리가 "굴삭기"인지</b> — 공개 쇼핑몰의 DB 매물 목록은 <span class="mono">카테고리 = 굴삭기</span>인 것만 불러옵니다. 지게차·고소작업대로 등록한 매물은 내부 탭에서는 보여도 공개 페이지에는 노출되지 않습니다(지게차·미니굴삭기는 이 화면과 별개인 구글 스프레드시트로 관리 중입니다).</li>
          <li><b>게시 상태가 "Active"인지</b> — "Sold"나 "Draft"로 바꾸면 SOLD 뱃지가 붙는 게 아니라 공개 목록에서 <b>완전히 사라집니다.</b> 판매완료를 표시하고 싶어도 실제로는 숨김 처리와 같은 효과이니 참고하세요.</li>
        </ul>
      </div>
      <div class="note"><b>신규 문의는 자동 알림이 없습니다</b> — 카카오톡·SMS 등 어떤 알림도 발송되지 않고 표에만 저장됩니다. AI비서 "문의 내역" 탭의 빨간 배지(대기 건수)를 <b>담당자가 직접, 주기적으로 확인</b>해야 놓치지 않습니다.</div>
    </section>

    <section class="page" id="roles">
      <div class="head"><h2><span class="icon">🗝</span>접근권한 요약표</h2></div>
      <p class="lead">화면별로 누가 들어갈 수 있는지 정리했습니다. 각 계정은 자기 담당 화면만 보이고, 다른 사업부 화면은 보이지 않습니다.</p>
      <div class="tblwrap">
      <table>
        <thead><tr><th>화면</th><th>경로</th><th>접근 가능</th></tr></thead>
        <tbody>
          <tr><td class="k">상담관리</td><td class="mono">/work/call-management</td><td>관리자, 나르미모터스, 롯데오토리스, 보험전담, AI비서(보험)</td></tr>
          <tr><td class="k">AI비서</td><td class="mono">/work/secretary</td><td>관리자 전용</td></tr>
          <tr><td class="k">AI비서(Ins)</td><td class="mono">/work/secretary-ins</td><td>AI비서(보험) 계정 전용</td></tr>
          <tr><td class="k">매출/매입 관리</td><td class="mono">/work/finance-hub</td><td>관리자 전용</td></tr>
          <tr><td class="k">운영대시보드</td><td class="mono">/work/dashboard</td><td>관리자 전용</td></tr>
          <tr><td class="k">주간리뷰</td><td class="mono">/work/weekly-review</td><td>관리자 전용</td></tr>
          <tr><td class="k">현대건기(부산경남)</td><td class="mono">/hyundaicm</td><td>관리자, 현대건기(부산경남) 담당자, NH캐피탈 담당자·직원</td></tr>
          <tr><td class="k">태산통운</td><td class="mono">/taesan</td><td>관리자, 태산통운 담당자</td></tr>
          <tr><td class="k">나르미</td><td class="mono">/narumi</td><td>관리자, 나르미모터스, 롯데오토리스, 보험전담</td></tr>
          <tr><td class="k">Rental_O/S</td><td class="mono">/rental-os</td><td>관리자, RentalOS 파트너 1개 계정</td></tr>
          <tr><td class="k">수출장비 (내부관리)</td><td class="mono">AI비서 내 탭</td><td>AI비서 접근 권한자와 동일(관리자)</td></tr>
        </tbody>
      </table>
      </div>
      <p style="margin-top:1rem;font-size:13px;color:var(--ink-faint);">이 표는 "화면에 들어갈 수 있는가"만 나타냅니다. 들어간 뒤 실제로 뭘 할 수 있는지는 역할마다 다릅니다(예: 나르미모터스는 접수만, 태산통운은 접수+다운로드만, 롯데오토리스는 조회만 가능) — 위 각 섹션의 역할별 표를 확인하세요. 계정별 정확한 로그인 이메일은 문서에 남기지 않았습니다 — 본인 계정 로그인이 안 되면 관리자에게 문의하세요.</p>
    </section>

    <footer class="end">RNF Korea 내부 업무용 문서 · 실제 화면 구성은 업데이트에 따라 조금씩 달라질 수 있습니다</footer>
  </main>
</div>
`;

export default function WorkManualPage() {
  const navigate = useNavigate();
  const { isAdmin, isSubAdmin, loading } = useAuth() as any;
  const isAdminLevel = isAdmin || isSubAdmin;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdminLevel) {
    navigate("/", { replace: true });
    return null;
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate("/work/secretary")}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl border border-gray-200 text-gray-500 text-xs font-semibold hover:border-gray-300 hover:text-gray-700 transition-all"
          >
            ← AI비서
          </button>
          <p className="text-sm font-semibold text-[#0a192f]">📘 업무 매뉴얼</p>
          <span style={{ width: 70 }} />
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: MANUAL_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: MANUAL_BODY_HTML }} />
    </div>
  );
}
